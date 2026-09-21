import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

// ── Payment provider abstraction ────────────────────────────────────────────
// Payments are ALWAYS verified server-side: the frontend can create an order
// and redirect the user to the provider, but only a verified provider callback
// (or an admin refund flow) can mark an order PAID and trigger commands.

export type PaymentProvider = {
  readonly key: string;
  /** Create a provider-side payment session; returns the redirect URL. */
  createPayment(input: {
    orderNumber: string;
    amountCents: number;
    currency: string;
    description: string;
    callbackUrl: string;
  }): Promise<{ redirectUrl: string; providerRef?: string }>;
  /** Verify a callback/status check. Must hit the provider server-to-server. */
  verifyPayment(input: { providerRef: string; amountCents: number }): Promise<{ verified: boolean; raw?: unknown }>;
};

class NullProvider implements PaymentProvider {
  readonly key = "none";
  async createPayment(): Promise<{ redirectUrl: string; providerRef?: string }> {
    throw new Error(
      "درگاه پرداخت پیکربندی نشده است. متغیرهای PAYMENT_PROVIDER_* را در .env تنظیم کنید.",
    );
  }
  async verifyPayment(): Promise<{ verified: boolean }> {
    return { verified: false };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const key = process.env.PAYMENT_PROVIDER || "none";
  if (key === "zibal") {
    return new ZibalProvider(
      process.env.PAYMENT_PROVIDER_MERCHANT_ID || "",
      process.env.ZIBAL_RELAY_URL || null,
      process.env.ZIBAL_RELAY_SECRET || null,
    );
  }
  if (key === "zarinpal") {
    return new ZarinpalProvider(
      process.env.ZARINPAL_MERCHANT_ID || process.env.PAYMENT_PROVIDER_MERCHANT_ID || "",
      process.env.ZARINPAL_SANDBOX === "true",
    );
  }
  return new NullProvider();
}

// ── Zarinpal (payment.zarinpal.com, API v4) ─────────────────────────────────
// Same redirect flow as the sibling Azura project, which is proven in
// production: request → Authority → StartPay page → verify. Unlike Zibal there
// is no merchant IP allowlist, so it works from any host (Vercel included).
const ZARINPAL_PROD = "https://payment.zarinpal.com";
const ZARINPAL_SANDBOX_BASE = "https://sandbox.zarinpal.com";
const ZARINPAL_START_PROD = "https://www.zarinpal.com";

export class ZarinpalProvider implements PaymentProvider {
  readonly key = "zarinpal";

  constructor(
    private readonly merchantId: string,
    private readonly sandbox = false,
  ) {}

  private apiBase(): string {
    return this.sandbox ? ZARINPAL_SANDBOX_BASE : ZARINPAL_PROD;
  }

  private startBase(): string {
    return this.sandbox ? ZARINPAL_SANDBOX_BASE : ZARINPAL_START_PROD;
  }

  private headers() {
    return { "Content-Type": "application/json", "User-Agent": "TCC-Web/1.0 (+https://site.tccmc.ir)" };
  }

  async createPayment(input: {
    orderNumber: string;
    amountCents: number;
    currency: string;
    description: string;
    callbackUrl: string;
  }): Promise<{ redirectUrl: string; providerRef?: string }> {
    if (!this.merchantId) {
      throw new Error("درگاه زرین‌پال پیکربندی نشده است. ZARINPAL_MERCHANT_ID را تنظیم کنید.");
    }
    const res = await fetch(`${this.apiBase()}/pg/v4/payment/request.json`, {
      method: "POST",
      headers: this.headers(),
      cache: "no-store",
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: input.amountCents, // DB amounts are already Toman
        currency: "IRT",
        callback_url: input.callbackUrl,
        description: input.description,
      }),
    });
    const data = (await res.json()) as {
      data?: { code?: number; message?: string; authority?: string };
      errors?: { code?: number; message?: string } | unknown[];
    };
    const code = data.data?.code;
    if (code !== 100 || !data.data?.authority) {
      const message = data.data?.message ?? (Array.isArray(data.errors) ? "بدون توضیح" : (data.errors?.message ?? "بدون توضیح"));
      throw new Error(`زرین‌پال: درخواست پرداخت رد شد (کد ${code ?? "?"} — ${message})`);
    }
    return {
      redirectUrl: `${this.startBase()}/pg/StartPay/${data.data.authority}`,
      providerRef: data.data.authority,
    };
  }

  async verifyPayment(input: { providerRef: string; amountCents: number }): Promise<{ verified: boolean; raw?: unknown }> {
    if (!this.merchantId || !input.providerRef) return { verified: false };
    const res = await fetch(`${this.apiBase()}/pg/v4/payment/verify.json`, {
      method: "POST",
      headers: this.headers(),
      cache: "no-store",
      body: JSON.stringify({ merchant_id: this.merchantId, amount: input.amountCents, authority: input.providerRef }),
    });
    const data = (await res.json()) as { data?: { code?: number; ref_id?: number; amount?: number }; errors?: unknown };
    // 100 = verified now, 101 = already verified (duplicate callback).
    const code = data.data?.code;
    const verified = code === 100 || code === 101;
    const amountOk = data.data?.amount == null || data.data.amount === input.amountCents;
    return { verified: verified && amountOk, raw: data };
  }
}

// ── Zibal (gateway.zibal.ir) ────────────────────────────────────────────────
// The merchant account lives under the domain the gateway was registered on;
// the hosted payment page is branded with it. DB prices are Toman (IRT) while
// Zibal speaks Rial, so every amount crosses the boundary ×10.

/** Zibal (or its relay) can answer with an HTML error page; surface that clearly. */
async function readJson(res: Response, relayUrl?: string | null): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    const via = relayUrl ? " (از طریق رله)" : "";
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(`زیبال${via}: پاسخ نامعتبر (HTTP ${res.status}) — ${snippet}`);
  }
}

export class ZibalProvider implements PaymentProvider {
  readonly key = "zibal";
  // Set PAYMENT_PROVIDER_MERCHANT_ID to "zibal" to use the sandbox gateway.
  //
  // Zibal enforces a merchant IP allowlist, while Vercel has no fixed egress IP.
  // When ZIBAL_RELAY_URL is set we POST through a tiny PHP relay hosted on the
  // project's cPanel host (see deploy/zibal-relay/), so Zibal only ever sees that
  // host's static IP. Without it we fall back to calling Zibal directly.
  constructor(
    private readonly merchant: string,
    private readonly relayUrl?: string | null,
    private readonly relaySecret?: string | null,
  ) {}

  /** Resolve a Zibal endpoint — direct, or through the static-IP relay. */
  private endpoint(ep: "request" | "verify" | "inquiry"): string {
    const relay = this.relayUrl?.trim();
    if (!relay) return `https://gateway.zibal.ir/v1/${ep}`;
    let base = relay.replace(/\/+$/, "");
    if (!/\.php$/.test(base)) base += "/relay.php";
    return `${base}?ep=${ep}`;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // Zibal's CDN (ArvanCloud) rejects requests without a browser-ish UA.
      "User-Agent": "TCC-Web/1.0 (+https://site.tccmc.ir)",
    };
    if (this.relaySecret) headers["x-relay-secret"] = this.relaySecret;
    return headers;
  }

  async createPayment(input: {
    orderNumber: string;
    amountCents: number;
    currency: string;
    description: string;
    callbackUrl: string;
  }): Promise<{ redirectUrl: string; providerRef?: string }> {
    if (!this.merchant) {
      throw new Error("درگاه زیبال پیکربندی نشده است. PAYMENT_PROVIDER_MERCHANT_ID را در .env تنظیم کنید.");
    }
    const res = await fetch(this.endpoint("request"), {
      method: "POST",
      headers: this.headers(),
      cache: "no-store",
      body: JSON.stringify({
        merchant: this.merchant,
        amount: input.amountCents * 10, // Toman → Rial
        callbackUrl: input.callbackUrl,
        description: input.description,
        orderId: input.orderNumber,
      }),
    });
    const data = (await readJson(res, this.relayUrl)) as { trackId?: number; result?: number; message?: string };
    if (data.result !== 100 || !data.trackId) {
      throw new Error(`زیبال: درخواست پرداخت رد شد (کد ${data.result ?? "?"} — ${data.message ?? "بدون توضیح"})`);
    }
    return {
      redirectUrl: `https://gateway.zibal.ir/start/${data.trackId}`,
      providerRef: String(data.trackId),
    };
  }

  async verifyPayment(input: { providerRef: string; amountCents: number }): Promise<{ verified: boolean; raw?: unknown }> {
    if (!this.merchant || !input.providerRef) return { verified: false };
    const res = await fetch(this.endpoint("verify"), {
      method: "POST",
      headers: this.headers(),
      cache: "no-store",
      body: JSON.stringify({ merchant: this.merchant, trackId: Number(input.providerRef) }),
    });
    const data = (await readJson(res, this.relayUrl)) as { result?: number; message?: string; status?: number; amount?: number };
    // result 100 = verified now, 201 = verified earlier (duplicate callback).
    // status 1 = paid. The echoed amount is Rial — cross-check against the order.
    const paid = data.result === 100 || data.result === 201;
    const amountOk = data.amount == null || data.amount === input.amountCents * 10;
    return { verified: paid && data.status === 1 && amountOk, raw: data };
  }
}

// ── Command dispatch after verified payment ────────────────────────────────
// Never trusted from the browser. Placeholders: {uuid}, {username}, {player}.
//
// Every command is queued first (McCommand) so it survives a network where the
// site cannot reach the game host directly; the bridge plugin collects it via
// /api/mc/poll. We then try the direct adapter (panel/RCON/bridge) as a fast
// path — whichever wins, exactly one execution happens because the queue row is
// settled as soon as a direct execution succeeds.

export async function dispatchProductCommands(input: {
  orderId: string;
  userId: string;
  targetUsername?: string | null;
}): Promise<{ dispatched: number; errors: string[] }> {
  const { getMinecraft } = await import("@/lib/mc");
  const { enqueueCommand, settleCommand } = await import("@/lib/mc/queue");
  const mc = getMinecraft();

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order || order.status !== "PAID") return { dispatched: 0, errors: ["order not in PAID state"] };

  // Resolve the target MC account: explicit target, else the user's linked account.
  const account = input.targetUsername
    ? await prisma.minecraftAccount.findUnique({ where: { username: input.targetUsername } })
    : await prisma.minecraftAccount.findFirst({ where: { userId: order.userId, linkedAt: { not: null } } });

  const errors: string[] = [];
  let dispatched = 0;

  for (const item of order.items) {
    let commands: string[] = [];
    try {
      // the prefix studio stores the exact command for the approved design
      commands = JSON.parse(item.customCommands ?? item.product.commands) as string[];
    } catch {
      commands = [];
    }

    const expiresAt =
      item.product.duration && item.product.duration !== "permanent"
        ? parseDuration(item.product.duration)
        : null;

    await prisma.userProduct.create({
      data: {
        userId: order.userId,
        productId: item.product.id,
        orderId: order.id,
        expiresAt,
        active: true,
      },
    });

    if (!account || account.uuid.startsWith("pending-")) {
      errors.push(`حساب ماینکرفت متصل نیست؛ ${item.product.name} به حساب کاربری ذخیره شد.`);
      continue;
    }

    for (const raw of commands) {
      const cmd = raw
        .replaceAll("{uuid}", account.uuid)
        .replaceAll("{username}", account.username)
        .replaceAll("{player}", account.username);

      // Queue first: guaranteed delivery through the plugin poll.
      const queueId = await enqueueCommand(cmd, `store:${order.orderNumber}`);

      // Fast path: run it right now if the site can reach the server.
      try {
        const res = await mc.execCommand(cmd);
        if (res.ok) {
          dispatched += 1;
          await settleCommand(queueId, true, "executed directly via adapter");
        }
      } catch {
        // Unreachable is expected on hosts that drop foreign traffic — the
        // plugin will pick the queued command up instead.
      }
    }
  }

  await audit({
    actorName: "system",
    action: "store.dispatch",
    target: order.orderNumber,
    detail: { dispatched, errors },
  });

  return { dispatched, errors };
}

function parseDuration(duration: string): Date | null {
  const m = /^(\d+)([dhm])$/.exec(duration);
  if (!m) return null;
  const n = Number(m[1]);
  const unitMs = m[2] === "d" ? 86400000 : m[2] === "h" ? 3600000 : 60000;
  return new Date(Date.now() + n * unitMs);
}

export function generateOrderNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return `TCC-${stamp}-${rand}`;
}
