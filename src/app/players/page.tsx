import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { TierBadge } from "@/components/TierBadge";
import { formatKd, formatNumber, timeAgo } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const { q, page: pageParam, sort } = await searchParams;
  const page = Math.max(1, Number(pageParam || 1));
  const limit = 24;
  const auth = await getAuth();

  const where = {
    // everyone the server knows about: linked accounts, plus anyone with stats or a tier
    OR: [
      { linkedAt: { not: null } },
      { playerStatistics: { isNot: null } },
      { playerTiers: { some: {} } },
    ],
    ...(q ? { username: { contains: q } } : {}),
  };

  const [accounts, total] = await Promise.all([
    prisma.minecraftAccount.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { playerStatistics: true, playerTiers: { include: { tier: true, category: true } } },
    }),
    prisma.minecraftAccount.count({ where }),
  ]);

  const players = accounts.map((a) => ({
    username: a.username,
    stats: a.playerStatistics,
    topTier: a.playerTiers.slice().sort((x, y) => x.tier.position - y.tier.position)[0] ?? null,
  }));

  if (sort === "kills" || sort === "kd" || sort === "playtime") {
    players.sort((a, b) => {
      const val = (p: (typeof players)[number]) =>
        !p.stats ? -1 : sort === "kd" ? p.stats.kills / Math.max(1, p.stats.deaths) : sort === "playtime" ? p.stats.playtimeMinutes : p.stats.kills;
      return val(b) - val(a);
    });
  } else {
    players.sort((a, b) => a.username.localeCompare(b.username));
  }

  const pages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />
      <main className="max-w-6xl mx-auto px-4 py-10 fade-up">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
          <h1 className="font-display text-3xl font-black">بازیکنان</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <form action="/players" method="get" className="flex gap-2">
              <input name="q" defaultValue={q ?? ""} placeholder="نام بازیکن…" className="input !w-48" aria-label="جستجو" />
              <input type="hidden" name="sort" value={sort ?? ""} />
              <button className="btn btn-ghost" type="submit">جستجو</button>
            </form>
            <div className="flex gap-1">
              {[
                ["", "نام"],
                ["kills", "کیل"],
                ["kd", "K/D"],
                ["playtime", "بازی"],
              ].map(([value, label]) => (
                <Link
                  key={label}
                  href={`/players?${new URLSearchParams({ ...(q ? { q } : {}), ...(value ? { sort: value } : {}) })}`}
                  className={`badge ${(sort ?? "") === value ? "badge-pink" : ""}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="card p-10 text-center text-[var(--c-text-dim)]">
            بازیکنی یافت نشد. بازیکنان پس از اتصال حساب ماینکرفتشان اینجا نمایش داده می‌شوند.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map((p) => (
              <Link key={p.username} href={`/players/${p.username}`} className="card p-4 flex items-center gap-4 hover:border-[var(--c-border-strong)] transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://mc-heads.net/avatar/${p.username}/40`}
                  alt=""
                  width={40}
                  height={40}
                  className="rounded-md border hairline"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-ui font-semibold truncate">{p.username}</div>
                  <div className="text-xs text-[var(--c-text-faint)] num">
                    {p.stats ? `${formatNumber(p.stats.kills)} کیل · K/D ${formatKd(p.stats.kills, p.stats.deaths)}` : "بدون آمار"}
                  </div>
                </div>
                {p.topTier && <TierBadge name={p.topTier.tier.name} />}
              </Link>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: pages }, (_, i) => (
              <Link
                key={i}
                href={`/players?page=${i + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort ? `&sort=${sort}` : ""}`}
                className={`btn btn-ghost !px-3 !py-1.5 text-sm ${page === i + 1 ? "!border-[var(--c-pink)] text-[var(--c-pink)]" : ""}`}
              >
                <span className="num">{i + 1}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
