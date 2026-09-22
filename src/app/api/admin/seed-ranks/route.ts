import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { RANKS, DURATIONS, SELLABLE_RANKS, durationPrice } from "@/lib/ranks";
import { audit } from "@/lib/audit";

// POST /api/admin/seed-ranks
// One idempotent pass that makes the ladder real:
//   * RankProfile rows (name/colour/perks/permissions — fulfillment grants these)
//   * a store product per rank (rank-<key>)
//   * 1 / 3 / 12 month ProductDuration rows for every sellable rank
// Re-run it whenever the ladder or the prices change.
export async function POST() {
  try {
    const auth = await requirePermission("store.edit");

    const category =
      (await prisma.productCategory.findUnique({ where: { slug: "ranks" } })) ??
      (await prisma.productCategory.create({ data: { slug: "ranks", name: "رنک‌ها" } }));

    let profiles = 0;
    for (const rank of RANKS) {
      await prisma.rankProfile.upsert({
        where: { key: rank.key },
        create: {
          key: rank.key,
          name: rank.name,
          order: rank.order,
          color: rank.color,
          icon: rank.icon,
          tagline: rank.tagline,
          perks: JSON.stringify(rank.perks),
          permissions: JSON.stringify(rank.permissions),
          commands: JSON.stringify(rank.commands),
        },
        update: {
          name: rank.name,
          order: rank.order,
          color: rank.color,
          icon: rank.icon,
          tagline: rank.tagline,
        },
      });
      profiles += 1;
    }

    let products = 0;
    let durations = 0;
    for (const rank of SELLABLE_RANKS) {
      const slug = `rank-${rank.key}`;
      const product = await prisma.product.upsert({
        where: { slug },
        create: {
          slug,
          name: `رنک ${rank.name}`,
          description: `${rank.tagline} — همه‌ی مزیت‌های رنک‌های پایین‌تر را هم دارد.`,
          priceCents: rank.priceCents,
          currency: "IRT",
          categoryId: category.id,
          kind: "RANK",
          duration: null,
          available: true,
          commands: "[]",
          rankKey: rank.key,
          perks: JSON.stringify(rank.perks),
          position: rank.order,
        },
        update: {
          name: `رنک ${rank.name}`,
          description: `${rank.tagline} — همه‌ی مزیت‌های رنک‌های پایین‌تر را هم دارد.`,
          priceCents: rank.priceCents,
          categoryId: category.id,
          kind: "RANK",
          available: true,
          rankKey: rank.key,
          perks: JSON.stringify(rank.perks),
          position: rank.order,
          // fulfilment builds the grant itself (addtemp for the purchased
          // period) — a leftover permanent "parent add" breaks rank expiry
          commands: "[]",
        },
      });
      products += 1;

      for (const d of DURATIONS) {
        await prisma.productDuration.upsert({
          where: { productId_months: { productId: product.id, months: d.months } },
          create: {
            productId: product.id,
            months: d.months,
            days: d.days,
            priceCents: durationPrice(rank.priceCents, d.months),
            label: d.label,
            position: d.months,
          },
          update: {
            days: d.days,
            priceCents: durationPrice(rank.priceCents, d.months),
            label: d.label,
            active: true,
          },
        });
        durations += 1;
      }
    }

    // Legacy rank products (created before rankKey existed):
    //  * always CLEAR their console commands — fulfilment builds the grant itself
    //    (addtemp for the purchased period); a leftover permanent
    //    "lp user {uuid} parent add <rank>" would give the rank away forever,
    //  * hide only TRUE duplicates (name identical to the seeded one), so a
    //    distinct product such as "رنک Legend (۳۰ روزه)" stays on sale.
    let healed = 0;
    let hidden = 0;
    const canonicalSlugs = new Set(SELLABLE_RANKS.map((r) => `rank-${r.key}`));
    const legacy = await prisma.product.findMany({ where: { kind: "RANK" } });
    for (const p of legacy) {
      if (canonicalSlugs.has(p.slug)) continue;
      const match = SELLABLE_RANKS.find(
        (r) => p.name.trim() === `رنک ${r.name}` || p.name.toLowerCase().includes(r.name.toLowerCase()),
      );
      if (!match) continue;
      const exactDuplicate = p.name.trim() === `رنک ${match.name}`;
      await prisma.product.update({
        where: { id: p.id },
        data: { rankKey: match.key, commands: "[]", available: exactDuplicate ? false : p.available },
      });
      healed += 1;
      if (exactDuplicate && p.available) hidden += 1;
    }

    await audit({
      actorId: auth.user.id,
      actorName: auth.user.username,
      action: "store.seed_ranks",
      target: "ranks",
      detail: { profiles, products, durations, healed, hidden },
    });

    return jsonOk({ ok: true, profiles, products, durations, healed, hidden });
  } catch (err) {
    return handleApiError(err);
  }
}
