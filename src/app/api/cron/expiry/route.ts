import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { enqueueCommand, settleCommand } from "@/lib/mc/queue";
import { notifyUser, telegramConfigured } from "@/lib/telegram";
import { rankName } from "@/lib/ranks";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const NOTICE_WINDOW_DAYS = 3;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return true; // not configured yet: allow (the endpoint is harmless)
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const qs = new URL(req.url).searchParams.get("secret") || "";
  return bearer === secret || qs === secret;
}

// GET /api/cron/expiry  (hourly via vercel.json)
//  1. warns members whose rank ends within 3 days (Telegram — that is why
//     linking Telegram is mandatory),
//  2. revokes ranks that actually ended: the LuckPerms parent is removed on the
//     game server and the UserProduct is closed.
export async function GET(req: NextRequest) {
  try {
    if (!authorized(req)) return jsonError("unauthorized", 401);

    const now = new Date();
    const soon = new Date(now.getTime() + NOTICE_WINDOW_DAYS * 86_400_000);

    // ── 1. "expiring soon" notices ──
    const expiring = await prisma.userProduct.findMany({
      where: { active: true, revokedAt: null, expiresAt: { gt: now, lte: soon }, expiryNoticeAt: null },
      include: { product: { select: { name: true } }, user: { select: { id: true, username: true, telegramId: true } } },
      take: 200,
    });

    let warned = 0;
    for (const up of expiring) {
      if (up.user.telegramId) {
        const days = Math.max(1, Math.ceil((up.expiresAt!.getTime() - now.getTime()) / 86_400_000));
        await notifyUser(
          up.user.id,
          `⏳ <b>${up.product.name} شما ${days} روز دیگر تمام می‌شود</b>\n` +
            `برای تمدید: <a href="https://site.tccmc.ir/store">site.tccmc.ir/store</a>\n` +
            `اگر تمدید نکنی، رنک خودکار برداشته می‌شود.`,
        ).catch(() => false);
      }
      await prisma.userProduct.update({ where: { id: up.id }, data: { expiryNoticeAt: now } });
      warned += 1;
    }

    // ── 2. real expiry ──
    const expired = await prisma.userProduct.findMany({
      where: { active: true, revokedAt: null, expiresAt: { lte: now } },
      include: { product: { select: { name: true } }, user: { select: { id: true, username: true } } },
      take: 300,
    });

    const { getMinecraft } = await import("@/lib/mc");
    const mc = getMinecraft();
    let revoked = 0;

    for (const up of expired) {
      const account = await prisma.minecraftAccount.findFirst({
        where: { userId: up.userId, linkedAt: { not: null } },
        select: { uuid: true, username: true },
      });

      if (account && up.rankKey && !account.uuid.startsWith("pending-")) {
        const cmd = `lp user ${account.uuid} parent remove ${up.rankKey}`;
        const queueId = await enqueueCommand(cmd, "expiry");
        try {
          const res = await mc.execCommand(cmd);
          if (res.ok) await settleCommand(queueId, true, "expired via cron");
        } catch {
          /* queued for the plugin instead */
        }
      }

      await prisma.userProduct.update({
        where: { id: up.id },
        data: { active: false, revokedAt: now },
      });

      if (up.user.id) {
        await notifyUser(
          up.user.id,
          `⌛ <b>${up.product.name} شما تمام شد</b>\n` +
            (up.rankKey ? `رنک ${rankName(up.rankKey)} از حسابت برداشته شد.\n` : "") +
            `برای فعال‌سازی دوباره: <a href="https://site.tccmc.ir/store">site.tccmc.ir/store</a>`,
        ).catch(() => false);
      }
      revoked += 1;
    }

    if (warned || revoked) {
      await audit({
        actorName: "system",
        action: "store.expiry_run",
        target: "cron",
        detail: { warned, revoked },
      });
    }

    return jsonOk({ ok: true, warned, revoked, telegram: telegramConfigured(), at: now.toISOString() });
  } catch (err) {
    return handleApiError(err);
  }
}
