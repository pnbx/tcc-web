import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, jsonOk } from "@/lib/api";

// GET /api/players?q=&page=&limit=&tier=&sort=kills|kd|playtime|name
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 24)));
    const tier = url.searchParams.get("tier") ?? undefined;

    const where = {
      linkedAt: { not: null },
      ...(q ? { username: { contains: q } } : {}),
      ...(tier ? { playerTiers: { some: { tier: { name: tier } } } } : {}),
    };

    const [accounts, total] = await Promise.all([
      prisma.minecraftAccount.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          playerStatistics: true,
          playerTiers: { include: { tier: true, category: true } },
        },
      }),
      prisma.minecraftAccount.count({ where }),
    ]);

    const players = accounts.map((a) => ({
      username: a.username,
      uuid: a.uuid,
      rank: a.rank,
      stats: a.playerStatistics
        ? {
            kills: a.playerStatistics.kills,
            deaths: a.playerStatistics.deaths,
            wins: a.playerStatistics.wins,
            losses: a.playerStatistics.losses,
            playtimeMinutes: a.playerStatistics.playtimeMinutes,
            lastSeen: a.playerStatistics.lastSeen,
          }
        : null,
      tiers: a.playerTiers.map((pt) => ({
        category: pt.category.key,
        categoryName: pt.category.name,
        tier: pt.tier.name,
        position: pt.tier.position,
      })),
    }));

    const sort = url.searchParams.get("sort");
    if (sort && sort !== "name") {
      players.sort((a, b) => {
        const av = a.stats ? (sort === "kd" ? a.stats.kills / Math.max(1, a.stats.deaths) : sort === "playtime" ? a.stats.playtimeMinutes : a.stats.kills) : -1;
        const bv = b.stats ? (sort === "kd" ? b.stats.kills / Math.max(1, b.stats.deaths) : sort === "playtime" ? b.stats.playtimeMinutes : b.stats.kills) : -1;
        return bv - av;
      });
    } else {
      players.sort((a, b) => a.username.localeCompare(b.username));
    }

    return jsonOk({ players, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return handleApiError(err);
  }
}
