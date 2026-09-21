import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { mcTokenAuthorized } from "@/lib/mc/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  code: z.string().min(6).max(12),
  uuid: z.string().min(8).max(64),
  username: z.string().min(3).max(16),
});

// POST /api/account/link/confirm — called BY THE BRIDGE PLUGIN (not the browser).
// Authenticates with the shared token; the plugin confirms the player typed
// /site connect <code> in-game, so ownership is proven by the server itself.
//
// Two real-world cases are handled:
//  1. The player typed a name the website has never seen → the pending row is
//     completed with the real uuid/username.
//  2. The in-game tier sync already created a row for this uuid (userId null) →
//     the website link is moved onto THAT row instead of leaving a duplicate,
//     which is what makes the linked account own the player's existing tiers.
export async function POST(req: NextRequest) {
  try {
    if (!mcTokenAuthorized(req)) return jsonError("Forbidden", 403);

    const { code, uuid, username } = await parseBody(req, schema);

    const pending = await prisma.minecraftAccount.findFirst({
      where: { linkCode: code.toUpperCase(), linkExpires: { gte: new Date() } },
    });
    if (!pending) return jsonError("کد نامعتبر یا منقضی شده است. یک کد تازه از پنل کاربری بگیر.", 404);

    const realRow = await prisma.minecraftAccount.findUnique({ where: { uuid } });

    if (realRow && realRow.userId && realRow.userId !== pending.userId) {
      return jsonError("این حساب ماینکرفت قبلاً به یک حساب کاربری دیگر وصل شده است.", 409);
    }

    const target = realRow ?? pending;
    const nameOwner = await prisma.minecraftAccount.findFirst({ where: { username, NOT: { id: target.id } } });

    const linked = await prisma.$transaction(async (tx) => {
      // release the username if a stale pending row still holds it
      if (nameOwner && nameOwner.id === pending.id && realRow) {
        await tx.minecraftAccount.update({ where: { id: pending.id }, data: { username: `pending-${pending.id.slice(-8)}` } });
      }
      const row = await tx.minecraftAccount.update({
        where: { id: target.id },
        data: {
          uuid,
          username,
          userId: pending.userId ?? target.userId ?? null,
          linkCode: null,
          linkExpires: null,
          linkedAt: new Date(),
        },
      });
      // the placeholder used only for the code is no longer needed
      if (realRow && realRow.id !== pending.id) {
        const placeholder = await tx.minecraftAccount.findUnique({
          where: { id: pending.id },
          include: { _count: { select: { playerTiers: true, tierHistory: true } } },
        });
        if (placeholder && placeholder._count.playerTiers === 0) {
          await tx.minecraftAccount.delete({ where: { id: pending.id } }).catch(() => undefined);
        }
      }
      return row;
    });

    await prisma.playerActivity.create({
      data: { accountId: linked.id, type: "LINK", detail: `linked to website user ${linked.userId}` },
    });
    await audit({ actorName: `bridge:${username}`, action: "account.link", target: uuid });

    return jsonOk({ linked: true, userId: linked.userId, accountId: linked.id });
  } catch (err) {
    return handleApiError(err);
  }
}
