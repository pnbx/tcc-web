import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";

// GET /api/tiers?category=&tier=&q=&sort=rating|kills|kd|name
// Returns categories with tiers and assigned players — the public tier list.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const categoryKey = url.searchParams.get("category") ?? undefined;
    const tierName = url.searchParams.get("tier") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;
    const sort = url.searchParams.get("sort") ?? "position";

    const categories = await prisma.tierCategory.findMany({
      where: categoryKey ? { key: categoryKey } : undefined,
      orderBy: { position: "asc" },
      include: {
        tiers: {
          where: tierName ? { name: tierName } : undefined,
          orderBy: { position: "asc" },
          include: {
            players: {
              include: {
                account: {
                  include: {
                    playerStatistics: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    let result = categories.map((cat) => ({
      id: cat.id,
      key: cat.key,
      name: cat.name,
      position: cat.position,
      tiers: cat.tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        position: tier.position,
        players: tier.players
          .filter((pt) =>
            q ? pt.account.username.toLowerCase().includes(q.toLowerCase()) : true
          )
          .map((pt) => ({
            username: pt.account.username,
            uuid: pt.account.uuid,
            region: pt.region,
            points: pt.points,
            note: pt.note,
            updatedAt: pt.updatedAt,
            stats: pt.account.playerStatistics
              ? {
                  kills: pt.account.playerStatistics.kills,
                  deaths: pt.account.playerStatistics.deaths,
                  wins: pt.account.playerStatistics.wins,
                  losses: pt.account.playerStatistics.losses,
                }
              : null,
          })),
      })),
    }));

    if (sort !== "position") {
      const byStat = (a: { stats?: { kills: number; deaths: number } | null }, b: { stats?: { kills: number; deaths: number } | null }) => {
        const av = a.stats ? (sort === "kd" ? a.stats.kills / Math.max(1, a.stats.deaths) : a.stats.kills) : -1;
        const bv = b.stats ? (sort === "kd" ? b.stats.kills / Math.max(1, b.stats.deaths) : b.stats.kills) : -1;
        return bv - av;
      };
      for (const cat of result) {
        for (const tier of cat.tiers) {
          tier.players.sort(byStat);
        }
      }
    }

    result = result.filter((c) => c.tiers.length > 0);
    return jsonOk({ categories: result });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("category"),
    key: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
    name: z.string().min(2).max(60),
  }),
  z.object({
    type: z.literal("tier"),
    categoryKey: z.string().min(2).max(30),
    name: z.string().min(2).max(10),
    color: z.string().max(9).optional(),
  }),
]);

// POST /api/tiers — create category or tier (tiers.create)
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission("tiers.create");
    const body = await parseBody(req, createSchema);

    if (body.type === "category") {
      const count = await prisma.tierCategory.count();
      const cat = await prisma.tierCategory.create({
        data: { key: body.key, name: body.name, position: count },
      });
      await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "tiers.create", target: cat.key });
      return jsonOk({ id: cat.id });
    }

    const cat = await prisma.tierCategory.findUnique({ where: { key: body.categoryKey } });
    if (!cat) return handleApiError(new Error("category not found"));
    const count = await prisma.tier.count({ where: { categoryId: cat.id } });
    const tier = await prisma.tier.create({
      data: { categoryId: cat.id, name: body.name.toUpperCase(), position: count, color: body.color },
    });
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "tiers.create", target: `${cat.key}/${tier.name}` });
    return jsonOk({ id: tier.id });
  } catch (err) {
    return handleApiError(err);
  }
}
