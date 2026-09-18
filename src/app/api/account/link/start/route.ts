import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { randomToken } from "@/lib/crypto";

const schema = z.object({ username: z.string().min(3).max(16).regex(/^[A-Za-z0-9_]+$/) });

// POST /api/account/link/start  { username }
// Mints a one-time code that the player confirms in-game with /tccweb link <code>.
// The bridge verifies the player is online and owns the account before the
// website stores the link. This keeps Minecraft passwords entirely out of the
// website — the game server is the only party that can prove ownership.
export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "link-start", 5, 60_000);
    const auth = await requireAuth();
    const { username } = await parseBody(req, schema);

    const existing = await prisma.minecraftAccount.findUnique({ where: { username } });
    if (existing && existing.userId && existing.linkedAt) {
      return jsonError("این حساب ماینکرفت قبلاً به حساب دیگری متصل شده است.", 409);
    }

    const code = randomToken(4).slice(0, 8).toUpperCase();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    const record = existing ?? await prisma.minecraftAccount.create({
      data: { username, uuid: `pending-${randomToken(8)}`, userId: auth.user.id },
    });

    await prisma.minecraftAccount.update({
      where: { id: record.id },
      data: { userId: auth.user.id, linkCode: code, linkExpires: expires, linkedAt: null },
    });

    return jsonOk({
      code,
      expiresAt: expires.toISOString(),
      instruction: `در بازی وارد شوید و دستور /tccweb link ${code} را اجرا کنید.`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
