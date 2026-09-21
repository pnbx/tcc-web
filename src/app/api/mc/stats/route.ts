import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { mcTokenAuthorized } from "@/lib/mc/auth";

export const dynamic = "force-dynamic";

// POST /api/mc/stats — the bridge plugin reports cumulative per-player stats it
// reads from PlaceholderAPI (`%statistic_player_kills%`, `%statistic_deaths%`,
// `%statistic_time_played%`, …), so profiles show the numbers a player has
// accumulated on this server instead of a dash.
const schema = z.object({
  players: z
    .array(
      z.object({
        uuid: z.string().min(8).max(64),
        username: z.string().min(1).max(16),
        kills: z.number().int().min(0).max(100_000_000).nullable().optional(),
        deaths: z.number().int().min(0).max(100_000_000).nullable().optional(),
        playtimeMinutes: z.number().int().min(0).max(100_000_000).nullable().optional(),
        mobKills: z.number().int().min(0).max(100_000_000).nullable().optional(),
        lastSeen: z.string().max(40).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
  source: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!mcTokenAuthorized(req)) return jsonError("unauthorized", 401);
    const { players, source } = await parseBody(req, schema);

    let updated = 0;
    for (const p of players) {
      const uuid = p.uuid.toLowerCase();
      const account = await prisma.minecraftAccount.upsert({
        where: { uuid },
        create: { uuid, username: p.username },
        update: { username: p.username },
      });

      const raw = JSON.stringify({ mobKills: p.mobKills ?? null, source: source ?? "placeholderapi" });
      const lastSeen = p.lastSeen ? new Date(p.lastSeen) : new Date();
      const data = {
        kills: p.kills ?? 0,
        deaths: p.deaths ?? 0,
        playtimeMinutes: p.playtimeMinutes ?? 0,
        lastSeen,
        raw,
      };
      await prisma.playerStatistics.upsert({
        where: { minecraftAccountId: account.id },
        create: { minecraftAccountId: account.id, ...data },
        update: data,
      });
      updated++;
    }

    return jsonOk({ updated });
  } catch (err) {
    return handleApiError(err);
  }
}
