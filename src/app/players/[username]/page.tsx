import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { getCachedStatus } from "@/lib/mc";
import { SiteHeader } from "@/components/SiteHeader";
import { TierBadge } from "@/components/TierBadge";
import { formatKd, formatNumber, formatDate, formatPlaytime, timeAgo } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function PlayerProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const auth = await getAuth();

  const account = await prisma.minecraftAccount.findUnique({
    where: { username },
    include: {
      playerStatistics: true,
      playerTiers: { include: { tier: true, category: true } },
      tierHistory: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { fromTier: true, toTier: true, category: true, createdBy: { select: { username: true } } },
      },
      user: {
        select: {
          createdAt: true,
          userProducts: { where: { active: true }, include: { product: { select: { name: true, kind: true } } } },
        },
      },
    },
  });
  if (!account) notFound();

  const status = await getCachedStatus();
  const isOnline = status.online && status.playersOnline != null ? null : null; // per-player presence comes from the bridge
  void isOnline;

  const stats = account.playerStatistics;
  const lastSeen = stats?.lastSeen ?? null;

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />
      <main className="max-w-5xl mx-auto px-4 py-10 fade-up">
        {/* identity card */}
        <div className="card p-6 mb-6">
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://mc-heads.net/avatar/${account.username}/72`}
              alt=""
              width={72}
              height={72}
              className="rounded-lg border hairline"
            />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-black">{account.username}</h1>
              <div className="mono text-xs text-[var(--c-text-faint)] mt-1 select-all">{account.uuid}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {account.rank && <span className="badge badge-purple">{account.rank}</span>}
                <span className="badge">عضویت: {formatDate(account.user?.createdAt ?? null)}</span>
                <span className="badge">
                  آخرین حضور: {lastSeen ? timeAgo(lastSeen) : "نامشخص"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-[1.4fr_1fr] gap-6">
          {/* stats + tiers */}
          <div>
            <div className="card p-6 mb-6">
              <h2 className="font-heading font-bold mb-4">آمار</h2>
              {stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                  {[
                    ["کیل", formatNumber(stats.kills)],
                    ["مرگ", formatNumber(stats.deaths)],
                    ["K/D", formatKd(stats.kills, stats.deaths)],
                    ["برد", formatNumber(stats.wins)],
                    ["باخت", formatNumber(stats.losses)],
                    ["زمان بازی", formatPlaytime(stats.playtimeMinutes)],
                  ].map(([label, value]) => (
                    <div key={label} className="card-raised p-4">
                      <div className="num text-xl font-bold">{value}</div>
                      <div className="text-xs text-[var(--c-text-faint)] mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--c-text-dim)]">
                  آمار این بازیکن هنوز از سرور همگام‌سازی نشده است.
                </p>
              )}
            </div>

            <div className="card p-6">
              <h2 className="font-heading font-bold mb-4">تیرها</h2>
              {account.playerTiers.length === 0 ? (
                <p className="text-sm text-[var(--c-text-dim)]">هنوز تیری ثبت نشده است.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {account.playerTiers.map((pt) => (
                    <div key={pt.id} className="card-raised p-4 flex items-center gap-3">
                      <TierBadge name={pt.tier.name} />
                      <div>
                        <div className="text-sm font-ui font-semibold">{pt.category.name}</div>
                        {pt.region && <div className="text-xs text-[var(--c-text-faint)]">ریجن {pt.region}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* history + purchases */}
          <div>
            <div className="card p-6 mb-6">
              <h2 className="font-heading font-bold mb-4">تاریخچه تیر</h2>
              {account.tierHistory.length === 0 ? (
                <p className="text-sm text-[var(--c-text-dim)]">—</p>
              ) : (
                <ul className="space-y-3">
                  {account.tierHistory.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 text-sm">
                      <TierBadge name={h.toTier?.name ?? "—"} />
                      <span className="text-[var(--c-text-faint)] text-xs">{h.category.name}</span>
                      <span className="ms-auto text-xs text-[var(--c-text-faint)]">{timeAgo(h.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-6">
              <h2 className="font-heading font-bold mb-4">مواد فعال</h2>
              {!account.user || account.user.userProducts.length === 0 ? (
                <p className="text-sm text-[var(--c-text-dim)]">—</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {account.user.userProducts.map((up) => (
                    <span key={up.id} className="badge badge-pink">{up.product.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Link href="/players" className="text-sm text-[var(--c-pink)] hover:underline">← همه بازیکنان</Link>
        </div>
      </main>
    </div>
  );
}
