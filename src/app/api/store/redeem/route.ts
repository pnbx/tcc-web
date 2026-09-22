import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { checkCode, reserveCode, myRedemptions } from "@/lib/redeem";
import { generateOrderNumber, dispatchProductCommands } from "@/lib/payments";
import { rankByKey } from "@/lib/ranks";
import { notifyUser } from "@/lib/telegram";
import { audit } from "@/lib/audit";

const schema = z.object({
  code: z.string().min(4).max(40),
});

// GET /api/store/redeem — my redemption history + unused discount credits
export async function GET() {
  try {
    const auth = await requireAuth();
    const [history, credits] = await Promise.all([
      myRedemptions(auth.user.id),
      prisma.redeemRedemption.findMany({
        where: { userId: auth.user.id, orderId: null, discountPercent: { gt: 0 } },
        include: { code: { select: { code: true, label: true } } },
      }),
    ]);
    return jsonOk({
      history,
      credits: credits.map((c) => ({ id: c.id, percent: c.discountPercent, code: c.code.code, label: c.code.label })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/store/redeem — spend a code.
//  * a rank code grants the rank through a zero-amount PAID order, so the normal
//    fulfilment (permissions, expiry tracking, Telegram receipt) runs unchanged,
//  * a discount code becomes a credit that checkout applies automatically.
export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "redeem", 10, 60_000);
    const auth = await requireAuth();
    const { code } = await parseBody(req, schema);

    const check = await checkCode(code, auth.user.id);
    if (!check.ok) return jsonError(check.error, 400);
    const row = check.code;

    // ── rank (or bundle rank) reward ──
    if (row.rankKey) {
      const rank = rankByKey(row.rankKey);
      if (!rank) return jsonError("این کد به رنک نامعتبر اشاره می‌کند.", 400);

      // find the product that sells this rank (self-heal its rankKey link)
      let product = await prisma.product.findFirst({ where: { rankKey: row.rankKey, available: true } });
      if (!product) {
        product =
          (await prisma.product.findFirst({ where: { slug: `rank-${row.rankKey}`, available: true } })) ??
          (await prisma.product.findFirst({ where: { name: { contains: rank.name } , available: true } }));
        if (product && !product.rankKey) {
          await prisma.product.update({ where: { id: product.id }, data: { rankKey: row.rankKey } });
        }
      }
      if (!product) return jsonError("محصول این رنک در استور پیدا نشد؛ به پشتیبانی بگو.", 500);

      const days = (row.months ?? 1) * 30;
      const order = await prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: auth.user.id,
          status: "PAID",
          totalCents: 0,
          currency: "IRT",
          paidAt: new Date(),
          provider: "redeem",
          providerRef: row.code,
          items: {
            create: [
              {
                productId: product.id,
                quantity: 1,
                unitPriceCents: 0,
                durationMonths: row.months ?? 1,
                durationDays: days,
                durationLabel: row.months ? `${row.months} ماهه (کد ریدیم)` : "کد ریدیم",
                redeemCode: row.code,
              },
            ],
          },
        },
      });

      await reserveCode({
        codeId: row.id,
        userId: auth.user.id,
        orderId: order.id,
        discountPercent: row.discountPercent,
        rankKey: row.rankKey,
        months: row.months,
      });

      await dispatchProductCommands({ orderId: order.id, userId: auth.user.id }).catch((err) =>
        console.error("[redeem.dispatch]", err),
      );

      await audit({
        actorName: auth.user.username,
        action: "store.redeem_rank",
        target: row.code,
        detail: { rank: row.rankKey, months: row.months, order: order.orderNumber },
      });

      await notifyUser(
        auth.user.id,
        `🎁 <b>کد ریدیم فعال شد</b>\nرنک <b>${rank.name}</b>${row.months ? ` برای ${row.months} ماه` : ""} به حسابت اضافه شد.\nکد: <code>${row.code}</code>`,
      ).catch(() => false);

      return jsonOk({
        ok: true,
        kind: "RANK",
        rank: rank.name,
        months: row.months,
        orderNumber: order.orderNumber,
        message: `رنک ${rank.name} فعال شد${row.months ? ` برای ${row.months} ماه` : ""}.`,
      });
    }

    // ── discount credit ──
    if (row.discountPercent > 0) {
      await reserveCode({
        codeId: row.id,
        userId: auth.user.id,
        orderId: null,
        discountPercent: row.discountPercent,
      });
      await audit({ actorName: auth.user.username, action: "store.redeem_discount", target: row.code, detail: { percent: row.discountPercent } });
      return jsonOk({
        ok: true,
        kind: "DISCOUNT",
        percent: row.discountPercent,
        message: `${row.discountPercent}٪ تخفیف ذخیره شد؛ در خرید بعدی خودکار اعمال می‌شود.`,
      });
    }

    return jsonError("این کد پاداشی ندارد.", 400);
  } catch (err) {
    return handleApiError(err);
  }
}
