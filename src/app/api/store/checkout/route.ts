import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { getPaymentProvider, generateOrderNumber, dispatchProductCommands } from "@/lib/payments";
import { sanitizeMiniMessage, prefixCommand } from "@/lib/prefix-studio";
import { tagCommand, type TagDesign } from "@/lib/rank-studio";
import { priceCart } from "@/lib/store-cart";
import { reserveCode } from "@/lib/redeem";
import { mustConnectTelegram } from "@/lib/telegram";
import { rankByKey } from "@/lib/ranks";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().min(2).max(60),
        quantity: z.number().int().min(1).max(10).default(1),
        months: z.number().int().min(1).max(24).optional(),
        customTag: z.string().max(24).optional(),
        customDesign: z.string().max(4000).optional(),
      }),
    )
    .min(1)
    .max(20),
  targetUsername: z.string().max(16).optional(),
  customPrefix: z.string().max(200).optional(),
  redeemCode: z.string().max(40).optional(),
  /** review step: price everything, create nothing */
  preview: z.boolean().optional(),
});

// POST /api/store/checkout
//   { preview: true }  -> the authoritative review breakdown (what the member
//                         sees before confirming; no order is created)
//   otherwise          -> create the order + provider session and return the
//                         gateway redirect (a 100%-discounted order is granted
//                         immediately without touching the gateway)
export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "checkout", 12, 60_000);
    const auth = await requireAuth();
    const settings = await getSettings();
    if (!settings.storeEnabled) return jsonError("استور در حال حاضر غیرفعال است.", 503);

    const body = await parseBody(req, schema);

    // Telegram is required for members: expiry notices are delivered there.
    if (mustConnectTelegram(auth.user) && !body.preview) {
      return jsonError("برای خرید باید اول حساب تلگرامت را وصل کنی.", 428);
    }

    const priced = await priceCart(
      body.items.map((i) => ({
        slug: i.slug,
        quantity: i.quantity,
        months: i.months,
        customTag: i.customTag ?? null,
        customDesign: i.customDesign ?? null,
      })),
      { userId: auth.user.id, codeRaw: body.redeemCode ?? null },
    );
    if (!priced.ok) return jsonError(priced.error, 400);
    const quote = priced.priced;

    // ── review step ──
    if (body.preview) {
      return jsonOk({
        preview: true,
        ...quote,
        telegramLinked: !mustConnectTelegram(auth.user),
        account: await prisma.minecraftAccount.findFirst({
          where: { userId: auth.user.id, linkedAt: { not: null } },
          select: { username: true, uuid: true },
        }),
      });
    }

    // ── custom designs → exact console commands ──
    const customCommands: string[] = [];
    const prefix = body.customPrefix ? sanitizeMiniMessage(body.customPrefix) : null;
    if (prefix) customCommands.push(prefixCommand({ miniMessage: prefix }));

    let customTag: string | null = null;
    if (body.items[0]?.customTag && body.items[0]?.customDesign) {
      try {
        const design = JSON.parse(body.items[0].customDesign) as TagDesign;
        customTag = design.tag.slice(0, 24);
        const rankOrder = quote.lines[0]?.rankKey ? rankByKey(quote.lines[0].rankKey!)?.order ?? 1 : 1;
        customCommands.push(tagCommand({ miniMessage: sanitizeMiniMessage(design.miniMessage) }, rankOrder));
      } catch {
        /* a malformed design simply means no custom tag — never trust the client */
      }
    }

    const orderItems = quote.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      targetUsername: body.targetUsername ?? null,
      customCommands: customCommands.length ? JSON.stringify(customCommands) : null,
      durationMonths: line.months,
      durationDays: line.days && line.days > 0 ? line.days * line.quantity : null,
      durationLabel: line.label,
      customTag,
      customDesign: body.items[0]?.customDesign ?? null,
      redeemCode: quote.code?.code ?? null,
    }));

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: auth.user.id,
        status: quote.totalCents === 0 ? "PAID" : "PENDING",
        totalCents: quote.totalCents,
        currency: "IRT",
        items: { create: orderItems },
        paidAt: quote.totalCents === 0 ? new Date() : null,
      },
    });

    // Spend the discount: an already-redeemed credit is attached to this order,
    // an inline code is consumed now.
    if (quote.creditRedemptionId) {
      await prisma.redeemRedemption.update({ where: { id: quote.creditRedemptionId }, data: { orderId: order.id } });
    } else if (quote.code && quote.code.id) {
      await reserveCode({
        codeId: quote.code.id,
        userId: auth.user.id,
        orderId: order.id,
        discountPercent: quote.discountPercent,
      });
    }

    await audit({
      actorName: auth.user.username,
      action: "store.order_created",
      target: order.orderNumber,
      detail: { total: quote.totalCents, items: quote.lines.length, discount: quote.discountPercent },
    });

    // ── fully discounted order: grant now, no gateway ──
    if (quote.totalCents === 0) {
      dispatchProductCommands({ orderId: order.id, userId: order.userId, targetUsername: orderItems[0]?.targetUsername }).catch(
        (err) => console.error("[store.dispatch.free]", err),
      );
      return jsonOk({ orderNumber: order.orderNumber, free: true, resultUrl: `/store/result/${order.orderNumber}` });
    }

    const provider = getPaymentProvider();
    try {
      const base = process.env.PAYMENT_PROVIDER_CALLBACK_BASE || new URL(req.url).origin;
      const callbackBase = process.env.PAYMENT_CALLBACK_URL?.trim() || `${base}/api/store/callback`;
      const session = await provider.createPayment({
        orderNumber: order.orderNumber,
        amountCents: quote.totalCents,
        currency: "IRT",
        description: `TCC Store — ${order.orderNumber}`,
        callbackUrl: `${callbackBase}${callbackBase.includes("?") ? "&" : "?"}order=${encodeURIComponent(order.orderNumber)}`,
      });

      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: provider.key,
          providerRef: session.providerRef ?? null,
          amountCents: quote.totalCents,
          currency: "IRT",
          status: "PENDING",
        },
      });

      const hopBase = process.env.PAYMENT_HOP_URL?.trim() || `${new URL(callbackBase).origin}/pay/start`;
      const redirectUrl = `${hopBase}${hopBase.includes("?") ? "&" : "?"}to=${encodeURIComponent(session.redirectUrl)}`;

      return jsonOk({ orderNumber: order.orderNumber, redirectUrl, totalCents: quote.totalCents });
    } catch (err) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      return jsonError((err as Error).message, 503);
    }
  } catch (err) {
    return handleApiError(err);
  }
}
