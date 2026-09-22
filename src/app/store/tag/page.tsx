import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { rankByKey } from "@/lib/ranks";
import { TagStudio, type StudioRank } from "./TagStudio";

export const dynamic = "force-dynamic";

export default async function TagStudioPage() {
  const [auth, products] = await Promise.all([
    getAuth(),
    prisma.product.findMany({
      where: { available: true, rankKey: { not: null } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { durations: { where: { active: true }, orderBy: { months: "asc" } } },
    }),
  ]);

  const ranks: StudioRank[] = products
    .map((p) => {
      const rank = p.rankKey ? rankByKey(p.rankKey) : undefined;
      if (!rank) return null;
      let perks: string[] = [];
      try {
        const parsed = JSON.parse(p.perks) as unknown;
        if (Array.isArray(parsed)) perks = parsed.filter((x): x is string => typeof x === "string");
      } catch {
        perks = rank.perks;
      }
      return {
        slug: p.slug,
        name: rank.name,
        rankKey: rank.key,
        color: rank.color,
        icon: rank.icon,
        tagline: rank.tagline,
        perks: perks.length ? perks : rank.perks,
        durations: p.durations.map((d) => ({ months: d.months, days: d.days, priceCents: d.priceCents, label: d.label })),
      } satisfies StudioRank;
    })
    .filter((r): r is StudioRank => r !== null);

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />
      <main className="max-w-6xl mx-auto px-4 py-10 fade-up">
        <h1 className="font-display text-3xl font-black mb-2">دستیار تگ اختصاصی</h1>
        <p className="text-sm text-[var(--c-text-dim)] mb-8">
          رنکت را انتخاب کن و بگو تگ کنار اسمت چه باشد — دستیار هوش مصنوعی طراحی‌اش می‌کند و بعد از تأیید تو،
          روی سرور با رنکت فعال می‌شود.
        </p>

        {ranks.length === 0 ? (
          <div className="card p-10 text-center text-[var(--c-text-dim)]">
            هنوز رنکی برای فروش تنظیم نشده است.
            <div className="mt-4">
              <Link href="/store" className="btn btn-primary">رفتن به استور</Link>
            </div>
          </div>
        ) : (
          <TagStudio ranks={ranks} />
        )}
      </main>
    </div>
  );
}
