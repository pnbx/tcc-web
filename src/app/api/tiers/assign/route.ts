import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  username: z.string().min(3).max(16),
  categoryKey: z.string().min(2),
  tierName: z.string().min(2),
  region: z.string().max(10).optional(),
  points: z.number().int().optional(),
  note: z.string().max(500).optional(),
});

// POST /api/tiers/assign — assign/change a player's tier (tiers.assign).
// Writes PlayerTier + TierHistory in one transaction.
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission("tiers.assign");
    const body = await parseBody(req, schema);

    const account = await prisma.minecraftAccount.findUnique({ where: { username: body.username } });
    if (!account) return handleApiError(new Error("player not found"));

    const category = await prisma.tierCategory.findUnique({ where: { key: body.categoryKey } });
    if (!category) return handleApiError(new Error("category not found"));

    // Real tier names are lowercase (ht1…lt5) — match case-insensitively so both
    // the site and the in-game /settier naming work.
    const tier = await prisma.tier.findFirst({
      where: { categoryId: category.id, name: { equals: body.tierName.trim(), mode: "insensitive" } },
    });
    if (!tier) return jsonError(`تیر «${body.tierName}» در حالت ${body.categoryKey} پیدا نشد.`, 404);

    const previous = await prisma.playerTier.findUnique({
      where: { minecraftAccountId_categoryId: { minecraftAccountId: account.id, categoryId: category.id } },
    });

    const result = await prisma.$transaction(async (tx) => {
      const pt = await tx.playerTier.upsert({
        where: { minecraftAccountId_categoryId: { minecraftAccountId: account.id, categoryId: category.id } },
        create: {
          minecraftAccountId: account.id,
          categoryId: category.id,
          tierId: tier.id,
          region: body.region,
          points: body.points,
          note: body.note,
          assignedById: auth.user.id,
        },
        update: {
          tierId: tier.id,
          region: body.region,
          points: body.points,
          note: body.note,
          assignedById: auth.user.id,
        },
      });

      await tx.tierHistory.create({
        data: {
          minecraftAccountId: account.id,
          categoryId: category.id,
          fromTierId: previous?.tierId ?? null,
          toTierId: tier.id,
          note: body.note,
          createdById: auth.user.id,
        },
      });

      await tx.playerActivity.create({
        data: {
          accountId: account.id,
          type: "TIER_CHANGE",
          detail: `${category.key}: ${previous?.tierId ?? "—"} → ${tier.name}`,
        },
      });

      return pt;
    });

    await audit({
      actorId: auth.user.id,
      actorName: auth.user.username,
      action: "tiers.assign",
      target: `${body.username}@${body.categoryKey}`,
      detail: { tier: body.tierName, previousTierId: previous?.tierId ?? null },
    });

    // Mirror the change in game: the in-game tier system owns the player's
    // suffix/TAB display, so the site hands it the same /settier command. The
    // bridge agent runs it within ~10s and the periodic tier sync confirms it.
    let queuedInGame = false;
    if (account.username && !account.uuid.startsWith("pending-")) {
      try {
        const { enqueueCommand } = await import("@/lib/mc/queue");
        await enqueueCommand(
          `settier ${account.username} ${category.key} ${tier.name.toLowerCase()}`,
          `tester:${auth.user.username}`,
        );
        queuedInGame = true;
      } catch {
        // best effort: the site-side assignment already succeeded
      }
    }

    return jsonOk({ assignment: result.id, queuedInGame });
  } catch (err) {
    return handleApiError(err);
  }
}
