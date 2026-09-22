import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rankByKey } from "@/lib/ranks";

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
//
// Ranks additionally get:
//   * `lp group <rank> permission set <node> true` for every node in the rank
//     profile — this is what makes the rank actually *do* something in game,
//   * `lp user <uuid> parent addtemp <rank> <days>d` for the purchased period,
//     where <days> already includes the time left on an existing grant, so
//     renewing never burns the days a member paid for earlier.

function safeJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

/** The LuckPerms commands that make a rank real (idempotent).
 *  The rank profile is read from the database first, so an owner/developer can
 *  tune a rank's permissions in the panel without a code change; the code table
 *  in lib/ranks.ts is the fallback and the seeding source. */
export async function rankPermissionCommands(rankKey: string): Promise<string[]> {
  const fallback = rankByKey(rankKey);
  const profile = await prisma.rankProfile.findUnique({ where: { key: rankKey } }).catch(() => null);

  const nodes = profile ? safeJsonArray(profile.permissions) : (fallback?.permissions ?? []);
  const extra = profile ? safeJsonArray(profile.commands) : (fallback?.commands ?? []);

  return [...nodes.map((node) => `lp group ${rankKey} permission set ${node} true`), ...extra];
}

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
  const granted: string[] = [];

  for (const item of order.items) {
    const product = item.product;
    const customCommands = safeJsonArray(item.customCommands);
    const baseCommands = safeJsonArray(product.commands);
    const rank = product.rankKey ? rankByKey(product.rankKey) : undefined;

    // ── how long does this grant last? ──
    // Duration products carry the chosen period; renewals extend the running one.
    let expiresAt: Date | null = null;
    if (item.durationDays && item.durationDays > 0) {
      const existing = await prisma.userProduct.findFirst({
        where: { userId: order.userId, productId: product.id, active: true, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: "desc" },
      });
      const base = existing?.expiresAt ?? new Date();
      expiresAt = new Date(base.getTime() + item.durationDays * 86400000);
      if (existing) {
        await prisma.userProduct.update({ where: { id: existing.id }, data: { expiresAt } });
      }
    } else if (product.duration && product.duration !== "permanent") {
      expiresAt = parseDuration(product.duration);
    }

    const already = await prisma.userProduct.findFirst({
      where: { userId: order.userId, productId: product.id, orderId: order.id },
    });
    if (!already) {
      await prisma.userProduct.create({
        data: {
          userId: order.userId,
          productId: product.id,
          orderId: order.id,
          expiresAt,
          active: true,
          durationMonths: item.durationMonths ?? null,
          rankKey: product.rankKey ?? null,
        },
      });
    }

    // ── which commands run? ──
    // A design-only product (prefix / custom tag) REPLACES the commands; a rank
    // with a custom tag keeps its grant commands and appends the tag command.
    let commands = customCommands.length > 0 ? (rank ? [...baseCommands, ...customCommands] : customCommands) : baseCommands;

    if (rank) {
      const grantDays = expiresAt
        ? Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000) + 1)
        : 0;
      const grant = grantDays > 0 ? `lp user {uuid} parent addtemp ${rank.key} ${grantDays}d` : `lp user {uuid} parent add ${rank.key}`;
      commands = [...(await rankPermissionCommands(rank.key)), grant, ...commands];
      granted.push(`${rank.name}${item.durationLabel ? ` (${item.durationLabel})` : ""}`);
    }

    if (!account || account.uuid.startsWith("pending-")) {
      errors.push(`حساب ماینکرفت متصل نیست؛ ${product.name} ذخیره شد و به‌محض اتصال حساب اعمال می‌شود.`);
      continue;
    }

    const applied: string[] = [];
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
          applied.push(cmd);
          await settleCommand(queueId, true, "executed directly via adapter");
        }
      } catch {
        // Unreachable is expected on hosts that drop foreign traffic — the
        // plugin will pick the queued command up instead.
      }
    }

    if (applied.length > 0) {
      await prisma.userProduct.updateMany({
        where: { userId: order.userId, productId: product.id, orderId: order.id },
        data: { grantedBy: order.orderNumber },
      });
    }
  }

  await audit({
    actorName: "system",
    action: "store.dispatch",
    target: order.orderNumber,
    detail: { dispatched, errors, granted },
  });

  // Receipt in Telegram — the channel members are required to connect.
  const { notifyUser } = await import("@/lib/telegram");
  const lines = order.items
    .map((i) => `• ${i.product.name}${i.durationLabel ? ` — ${i.durationLabel}` : ""}`)
    .join("\n");
  await notifyUser(
    order.userId,
    `🧾 <b>خرید شما ثبت شد</b>\n${lines}\n\nمبلغ: <b>${order.totalCents.toLocaleString("fa-IR")}</b> تومان\nشماره سفارش: <code>${order.orderNumber}</code>`,
  ).catch(() => false);

  return { dispatched, errors };
}

/**
 * Grants that were stored while no Minecraft account was linked yet.
 * Called right after a member connects their account, so a paid rank that was
 * parked never stays unapplied.
 */
export async function syncPendingGrants(userId: string): Promise<{ applied: number; errors: string[] }> {
  const { getMinecraft } = await import("@/lib/mc");
  const { enqueueCommand, settleCommand } = await import("@/lib/mc/queue");
  const mc = getMinecraft();

  const account = await prisma.minecraftAccount.findFirst({ where: { userId, linkedAt: { not: null } } });
  if (!account) return { applied: 0, errors: ["no linked account"] };

  const pending = await prisma.userProduct.findMany({
    where: { userId, active: true, grantedBy: null },
    include: { product: true },
  });

  let applied = 0;
  const errors: string[] = [];
  for (const up of pending) {
    const rank = up.rankKey ? rankByKey(up.rankKey) : undefined;
    const commands = safeJsonArray(up.product.commands);
    let list = commands;
    if (rank) {
      const days = up.expiresAt ? Math.max(1, Math.ceil((up.expiresAt.getTime() - Date.now()) / 86_400_000) + 1) : 0;
      const grant = days > 0 ? `lp user {uuid} parent addtemp ${rank.key} ${days}d` : `lp user {uuid} parent add ${rank.key}`;
      list = [...(await rankPermissionCommands(rank.key)), grant, ...commands];
    }
    for (const raw of list) {
      const cmd = raw
        .replaceAll("{uuid}", account.uuid)
        .replaceAll("{username}", account.username)
        .replaceAll("{player}", account.username);
      const queueId = await enqueueCommand(cmd, `pending:${up.id}`);
      try {
        const res = await mc.execCommand(cmd);
        if (res.ok) {
          applied += 1;
          await settleCommand(queueId, true, "pending grant applied");
        }
      } catch {
        errors.push(cmd);
      }
    }
    await prisma.userProduct.update({ where: { id: up.id }, data: { grantedBy: `pending:${new Date().toISOString()}` } });
  }
  return { applied, errors };
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
