import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { createLinkCode, deepLink, telegramConfigured, botUsername, linkExpiryHint } from "@/lib/telegram";

const schema = z.object({ action: z.enum(["start", "unlink", "status"]).default("status") });

// Telegram is REQUIRED for members — it is where rank-expiry notices go.
// GET  /api/account/telegram  -> status (+ a fresh code/deep link when starting)
// POST /api/account/telegram  -> { action: "start" | "unlink" }
export async function GET() {
  try {
    const auth = await requireAuth();
    return jsonOk({
      configured: telegramConfigured(),
      bot: botUsername(),
      linked: Boolean(auth.user.telegramId),
      username: auth.user.telegramUsername,
      linkedAt: auth.user.telegramLinkedAt,
      required: telegramConfigured() && !auth.user.telegramId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "telegram-link", 10, 60_000);
    const auth = await requireAuth();
    const { action } = await parseBody(req, schema);

    if (action === "start") {
      if (!telegramConfigured()) {
        return jsonOk({ ok: false, configured: false, error: "ربات تلگرام روی سایت تنظیم نشده است؛ به پشتیبانی بگو." });
      }
      const { code, deepLink: link, expiresAt } = await createLinkCode(auth.user.id);
      return jsonOk({ ok: true, code, deepLink: link, expiresAt, hint: linkExpiryHint(), bot: botUsername() });
    }

    if (action === "unlink") {
      await prisma.user.update({
        where: { id: auth.user.id },
        data: { telegramId: null, telegramUsername: null, telegramLinkedAt: null },
      });
      return jsonOk({ ok: true, linked: false, deepLink: deepLink("link") });
    }

    return jsonOk({ ok: true, linked: Boolean(auth.user.telegramId), bot: botUsername() });
  } catch (err) {
    return handleApiError(err);
  }
}
