import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";

// GET /api/admin/players?q=&page= — combined website users + MC accounts
export async function GET(req: NextRequest) {
  try {
    await requirePermission("players.view");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = 25;

    const [users, accounts, total] = await Promise.all([
      prisma.user.findMany({
        where: q ? { usernameLower: { contains: q.toLowerCase() } } : undefined,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, username: true, displayName: true, banned: true, banReason: true,
          createdAt: true, lastLoginAt: true,
          roles: { include: { role: { select: { name: true } } } },
          minecraftAccounts: { select: { username: true, uuid: true, linkedAt: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      q
        ? prisma.minecraftAccount.findMany({
            where: { username: { contains: q } },
            take: 25,
            include: { playerStatistics: true, user: { select: { username: true } } },
          })
        : Promise.resolve([]),
      prisma.user.count({ where: q ? { usernameLower: { contains: q.toLowerCase() } } : undefined }),
    ]);

    return jsonOk({ users, accounts, total, page });
  } catch (err) {
    return handleApiError(err);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ban"), userId: z.string(), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("unban"), userId: z.string() }),
  z.object({ action: z.literal("setRoles"), userId: z.string(), roles: z.array(z.string()).max(5) }),
  z.object({ action: z.literal("unlink"), minecraftAccountId: z.string() }),
]);

// POST /api/admin/players — moderation actions (players.ban / users.roles / players.link)
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req, actionSchema);
    const ip = req.headers.get("x-forwarded-for");

    if (body.action === "ban" || body.action === "unban") {
      const auth = await requirePermission("players.ban");
      const user = await prisma.user.update({
        where: { id: body.userId },
        data: {
          banned: body.action === "ban",
          banReason: body.action === "ban" ? (body.reason ?? null) : null,
        },
      });
      if (body.action === "ban") {
        await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await audit({
        actorId: auth.user.id,
        actorName: auth.user.username,
        action: `players.${body.action}`,
        target: user.username,
        detail: body.action === "ban" ? { reason: body.reason } : undefined,
        ip,
      });
      return jsonOk({ ok: true });
    }

    if (body.action === "setRoles") {
      const auth = await requirePermission("users.roles");
      const roles = await prisma.role.findMany({ where: { name: { in: body.roles } } });
      await prisma.userRole.deleteMany({ where: { userId: body.userId } });
      for (const role of roles) {
        await prisma.userRole.create({ data: { userId: body.userId, roleId: role.id, assignedBy: auth.user.id } });
      }
      await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "users.roles", target: body.userId, detail: { roles: body.roles }, ip });
      return jsonOk({ ok: true });
    }

    // unlink
    const auth = await requirePermission("players.link");
    const acc = await prisma.minecraftAccount.findUnique({ where: { id: body.minecraftAccountId } });
    if (!acc) return jsonError("not found", 404);
    await prisma.minecraftAccount.update({
      where: { id: acc.id },
      data: { userId: acc.userId, linkedAt: null, linkCode: null, linkExpires: null },
    });
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "players.unlink", target: acc.username, ip });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
