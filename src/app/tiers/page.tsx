import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { TierBadge } from "@/components/TierBadge";
import { timeAgo } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function TiersPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; tier?: string }>;
}) {
  const { category, q, tier } = await searchParams;
  const auth = await getAuth();

  const categories = await prisma.tierCategory.findMany({
    orderBy: { position: "asc" },
    include: {
      tiers: {
        where: tier ? { name: tier } : undefined,
        orderBy: { position: "asc" },
        include: {
          players: {
            include: { account: { select: { username: true } } },
            where: q ? { account: { username: { contains: q } } } : undefined,
          },
        },
      },
    },
  });

  const visible = category ? categories.filter((c) => c.key === category) : categories;

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />
      <main className="max-w-6xl mx-auto px-4 py-10 fade-up">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-black mb-1">لیست تیر</h1>
            <p className="text-sm text-[var(--c-text-dim)]">
              رتبه‌بندی رسمی بازیکنان PvP شبکه TCC — به‌روزرسانی توسط تیم تیر.
            </p>
          </div>
          <form action="/tiers" method="get" className="flex gap-2">
            {category && <input type="hidden" name="category" value={category} />}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="جستجوی بازیکن…"
              className="input !w-56"
              aria-label="جستجوی بازیکن"
            />
            <button className="btn btn-ghost" type="submit">جستجو</button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <Link href={`/tiers${q ? `?q=${encodeURIComponent(q)}` : ""}`} className={`badge ${!category ? "badge-pink" : ""}`}>
            همه حالت‌ها
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/tiers?category=${c.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`badge ${category === c.key ? "badge-pink" : ""}`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {visible.map((cat) => {
          const totalPlayers = cat.tiers.reduce((n, t) => n + t.players.length, 0);
          if (totalPlayers === 0 && q) return null;
          return (
            <section key={cat.id} className="mb-12">
              <h2 className="font-heading text-xl font-bold mb-4">{cat.name}</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {cat.tiers.map((t) => (
                  <div key={t.id} className={`card p-4 ${t.position <= 1 ? "!border-[rgba(236,72,153,0.35)]" : ""}`}>
                    <div className="flex items-center justify-between mb-3">
                      <TierBadge name={t.name} position={t.position} total={cat.tiers.length} />
                      <span className="num text-xs text-[var(--c-text-faint)]">{t.players.length} بازیکن</span>
                    </div>
                    {t.players.length === 0 ? (
                      <div className="text-xs text-[var(--c-text-faint)] py-2">—</div>
                    ) : (
                      <ul className="space-y-1">
                        {t.players.map((pt) => (
                          <li key={pt.id}>
                            <Link
                              href={`/players/${pt.account.username}`}
                              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[rgba(139,92,246,0.06)] transition-colors group"
                            >
                              <span className="font-ui text-sm font-semibold group-hover:text-[var(--c-pink)] transition-colors">
                                {pt.account.username}
                              </span>
                              <span className="text-[10px] text-[var(--c-text-faint)]">
                                {pt.region ? `${pt.region} · ` : ""}{timeAgo(pt.updatedAt)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
