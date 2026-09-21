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
// /tccweb link <code> in-game, so ownership is proven by the server itself.
export async function POST(req: NextRequest) {
  try {
    if (!mcTokenAuthorized(req)) return jsonError("Forbidden", 403);

    const { code, uuid, username } = await parseBody(req, schema);

    const record = await prisma.minecraftAccount.findFirst({
      where: { linkCode: code.toUpperCase(), linkExpires: { gte: new Date() } },
    });
    if (!record) return jsonError("کد نامعتبر یا منقضی شده است.", 404);

    const linked = await prisma.minecraftAccount.update({
      where: { id: record.id },
      data: { uuid, username, linkCode: null, linkExpires: null, linkedAt: new Date() },
    });

    await prisma.playerActivity.create({
      data: { accountId: linked.id, type: "LINK", detail: `linked to website user ${record.userId}` },
    });
    await audit({ actorName: `bridge:${username}`, action: "account.link", target: uuid });

    return jsonOk({ linked: true, userId: linked.userId });
  } catch (err) {
    return handleApiError(err);
  }
}
