import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { mcTokenAuthorized } from "@/lib/mc/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/mc/tiers — the in-game tier system (Skript "TCC TIER SYSTEM") pushes
// its full state here, so a tester's /settier shows up on the website without
// anyone touching the site. The push is authoritative for the modes it contains:
// rows missing from it are cleared, and every change lands in TierHistory.
const schema = z.object({
  players: z
    .array(z.object({ uuid: z.string().min(8).max(64), name: z.string().min(1).max(16) }))
    .max(5000)
    .default([]),
  tiers: z
    .array(
      z.object({
        uuid: z.string().min(8).max(64),
        mode: z.string().min(2).max(24),
        tier: z.string().min(1).max(12),
      }),
    )
    .max(20000),
  source: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!mcTokenAuthorized(req)) return jsonError("unauthorized", 401);
    const { players, tiers, source } = await parseBody(req, schema);

    const nameByUuid = new Map(players.map((p) => [p.uuid.toLowerCase(), p.name]));
    const categories = await prisma.tierCategory.findMany({ include: { tiers: true } });
    const catByKey = new Map(categories.map((c) => [c.key.toLowerCase(), c]));

    let linked = 0;
    const changes: { uuid: string; name: string; mode: string; from: string | null; to: string }[] = [];
    const seen = new Set<string>(); // `${accountId}:${categoryId}`

    for (const entry of tiers) {
      const mode = entry.mode.toLowerCase();
      const cat = catByKey.get(mode);
      if (!cat) continue; // unknown mode → ignore rather than invent a category
      const tier = cat.tiers.find((t) => t.name.toLowerCase() === entry.tier.toLowerCase());
      if (!tier) continue;

      const uuid = entry.uuid.toLowerCase();
      const name = nameByUuid.get(uuid) ?? entry.uuid.slice(0, 16);
      const account = await prisma.minecraftAccount.upsert({
        where: { uuid },
        create: { uuid, username: name, linkedAt: new Date() },
        update: { username: name },
      });
      linked++;

      const existing = await prisma.playerTier.findUnique({
        where: { minecraftAccountId_categoryId: { minecraftAccountId: account.id, categoryId: cat.id } },
        include: { tier: true },
      });
      seen.add(`${account.id}:${cat.id}`);

      if (!existing) {
        await prisma.playerTier.create({ data: { minecraftAccountId: account.id, categoryId: cat.id, tierId: tier.id } });
        await prisma.tierHistory.create({ data: { minecraftAccountId: account.id, categoryId: cat.id, toTierId: tier.id, note: `in-game ${source ?? "sync"}` } });
        changes.push({ uuid, name, mode, from: null, to: tier.name });
      } else if (existing.tierId !== tier.id) {
        await prisma.playerTier.update({ where: { id: existing.id }, data: { tierId: tier.id } });
        await prisma.tierHistory.create({
          data: { minecraftAccountId: account.id, categoryId: cat.id, fromTierId: existing.tierId, toTierId: tier.id, note: `in-game ${source ?? "sync"}` },
        });
        changes.push({ uuid, name, mode, from: existing.tier.name, to: tier.name });
      }
    }

    // Clear assignments for the modes covered by this push that no longer exist
    // in game (a /demoteall or a reset must not linger on the site).
    const pushedModes = [...new Set(tiers.map((t) => t.mode.toLowerCase()))];
    const pushedCatIds = pushedModes.map((m) => catByKey.get(m)?.id).filter((id): id is string => Boolean(id));
    let cleared = 0;
    if (pushedCatIds.length > 0) {
      const stale = await prisma.playerTier.findMany({ where: { categoryId: { in: pushedCatIds } } });
      for (const row of stale) {
        if (seen.has(`${row.minecraftAccountId}:${row.categoryId}`)) continue;
        await prisma.tierHistory.create({
          data: { minecraftAccountId: row.minecraftAccountId, categoryId: row.categoryId, fromTierId: row.tierId, note: `removed in game (${source ?? "sync"})` },
        });
        await prisma.playerTier.delete({ where: { id: row.id } });
        cleared++;
      }
    }

    if (changes.length > 0 || cleared > 0) {
      await audit({
        actorName: "bridge",
        action: "tiers.sync",
        target: source ?? "in-game",
        detail: { changes: changes.slice(0, 25), cleared, applied: linked },
      });
    }

    return jsonOk({ applied: linked, changed: changes.length, cleared, changes: changes.slice(0, 25) });
  } catch (err) {
    return handleApiError(err);
  }
}
