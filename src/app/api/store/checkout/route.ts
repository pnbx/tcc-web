import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { getPaymentProvider, generateOrderNumber } from "@/lib/payments";
import { sanitizeMiniMessage, prefixCommand } from "@/lib/prefix-studio";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  items: z
    .array(z.object({ slug: z.string().min(2).max(60), quantity: z.number().int().min(1).max(10).default(1) }))
    .min(1)
    .max(20),
  targetUsername: z.string().max(16).optional(),
  // AI prefix studio: the approved MiniMessage design, sanitised server-side
  customPrefix: z.string().max(200).optional(),
});

// POST /api/store/checkout — creates the order and a PENDING payment, then
// returns the provider redirect. Prices are re-read from the DB here; the
// frontend never gets to name its own price.
export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "checkout", 10, 60_000);
    const auth = await requireAuth();
    const settings = await getSettings();
    if (!settings.storeEnabled) return jsonError("استور در حال حاضر غیرفعال است.", 503);

    const body = await parseBody(req, schema);

    const slugs = body.items.map((i) => i.slug);
    const products = await prisma.product.findMany({ where: { slug: { in: slugs }, available: true } });
    if (products.length !== new Set(slugs).size) {
      return jsonError("برخی محصولات نامعتبر یا ناموجود هستند.", 400);
    }

    const customPrefix = body.customPrefix ? sanitizeMiniMessage(body.customPrefix) : null;
    let totalCents = 0;
    const orderItems: { productId: string; quantity: number; unitPriceCents: number; targetUsername: string | null; customCommands: string | null }[] = [];
    for (const item of body.items) {
      const p = products.find((x) => x.slug === item.slug)!;
      totalCents += p.priceCents * item.quantity;
      orderItems.push({
        productId: p.id,
        quantity: item.quantity,
        unitPriceCents: p.priceCents,
        targetUsername: body.targetUsername ?? null,
        customCommands: customPrefix ? JSON.stringify([prefixCommand({ miniMessage: customPrefix })]) : null,
      });
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: auth.user.id,
        status: "PENDING",
        totalCents,
        currency: "IRT",
        items: { create: orderItems },
      },
    });

    const provider = getPaymentProvider();
    try {
      // The provider must send the user back to the verify API (which then
      // redirects to the result page) — never to a page that trusts the query.
      //
      // PAYMENT_CALLBACK_URL wins when set: Zibal only accepts a callback on the
      // domain the merchant was registered under (result 106), so that domain can
      // forward here while the site keeps its own callback route.
      const base = process.env.PAYMENT_PROVIDER_CALLBACK_BASE || new URL(req.url).origin;
      const callbackBase = process.env.PAYMENT_CALLBACK_URL?.trim() || `${base}/api/store/callback`;
      const session = await provider.createPayment({
        orderNumber: order.orderNumber,
        amountCents: totalCents,
        currency: "IRT",
        description: `TCC Store — ${order.orderNumber}`,
        callbackUrl: `${callbackBase}${callbackBase.includes("?") ? "&" : "?"}order=${encodeURIComponent(order.orderNumber)}`,
      });

      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: provider.key,
          providerRef: session.providerRef ?? null,
          amountCents: totalCents,
          currency: "IRT",
          status: "PENDING",
        },
      });

      // Send the buyer through an azuraai.ir host first: the gateway validates the
      // referrer domain, and the merchant is registered for azuraai.ir.
      // PAYMENT_HOP_URL overrides the hop (e.g. https://azuraai.ir/payment/tcc when a
      // Cloudflare redirect rule forwards it to this app).
      const hopBase = process.env.PAYMENT_HOP_URL?.trim() || `${new URL(callbackBase).origin}/pay/start`;
      const redirectUrl = `${hopBase}${hopBase.includes("?") ? "&" : "?"}to=${encodeURIComponent(session.redirectUrl)}`;

      return jsonOk({ orderNumber: order.orderNumber, redirectUrl });
    } catch (err) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      return jsonError((err as Error).message, 503);
    }
  } catch (err) {
    return handleApiError(err);
  }
}
