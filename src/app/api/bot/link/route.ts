import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { timingSafeEqualStr } from "@/lib/crypto";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { linkByCode } from "@/lib/telegram";

function authorized(req: NextRequest): boolean {
  const expected = process.env.BOT_API_TOKEN || "";
  if (!expected) return false;
  const got = req.headers.get("x-bot-token") ?? "";
  return got.length > 0 && timingSafeEqualStr(got, expected);
}

const schema = z.object({
  code: z.string().min(4).max(40),
  telegramId: z.string().min(3).max(32),
  telegramUsername: z.string().max(64).optional(),
});

// GET /api/bot/link?telegramId=…   -> who is this Telegram account, and what do
//                                     they own (rank + expiry) — used by /me
export async function GET(req: NextRequest) {
  try {
    if (!authorized(req)) return jsonError("unauthorized", 401);
    const telegramId = new URL(req.url).searchParams.get("telegramId");
    if (!telegramId) return jsonError("telegramId required", 400);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, username: true, banned: true },
    });
    if (!user) return jsonOk({ linked: false });

    const [account, products] = await Promise.all([
      prisma.minecraftAccount.findFirst({
        where: { userId: user.id, linkedAt: { not: null } },
        select: { username: true, uuid: true },
      }),
      prisma.userProduct.findMany({
        where: { userId: user.id, active: true },
        orderBy: { expiresAt: "asc" },
        include: { product: { select: { name: true } } },
      }),
    ]);

    const now = Date.now();
    return jsonOk({
      linked: true,
      username: user.username,
      banned: user.banned,
      account,
      ranks: products.map((p) => ({
        name: p.product.name,
        rankKey: p.rankKey,
        expiresAt: p.expiresAt,
        daysLeft: p.expiresAt ? Math.max(0, Math.ceil((p.expiresAt.getTime() - now) / 86_400_000)) : null,
        expired: p.expiresAt ? p.expiresAt.getTime() <= now : false,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/bot/link — the bot forwards `/start <code>` here.
export async function POST(req: NextRequest) {
  try {
    if (!authorized(req)) return jsonError("unauthorized", 401);
    const body = await parseBody(req, schema);
    const result = await linkByCode(body.code, body.telegramId, body.telegramUsername ?? null);
    if (!result.ok) return jsonError(result.error, 400);
    return jsonOk({ ok: true, username: result.username });
  } catch (err) {
    return handleApiError(err);
  }
}
