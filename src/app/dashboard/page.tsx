import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { getCachedStatus, MC_ADDRESS } from "@/lib/mc";
import { formatKd, formatNumber, formatPlaytime, timeAgo, formatDate } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const [mcAccount, status] = await Promise.all([
    prisma.minecraftAccount.findFirst({
      where: { userId: auth.user.id, linkedAt: { not: null } },
      include: {
        playerStatistics: true,
        playerTiers: { include: { tier: true, category: true } },
        tierHistory: { orderBy: { createdAt: "desc" }, take: 5, include: { toTier: true, category: true } },
      },
    }),
    getCachedStatus(),
  ]);

  const stats = mcAccount?.playerStatistics;
  const topTier = mcAccount?.playerTiers.slice().sort((a, b) => a.tier.position - b.tier.position)[0];

  const cards: [string, string][] = [
    ["کیل", stats ? formatNumber(stats.kills) : "—"],
    ["مرگ", stats ? formatNumber(stats.deaths) : "—"],
    ["K/D", stats ? formatKd(stats.kills, stats.deaths) : "—"],
    ["برد", stats ? formatNumber(stats.wins) : "—"],
    ["باخت", stats ? formatNumber(stats.losses) : "—"],
    ["زمان بازی", stats ? formatPlaytime(stats.playtimeMinutes) : "—"],
  ];

  return (
    <div className="fade-up">
      <h1 className="font-display text-2xl font-black mb-1">سلام، {auth.user.displayName ?? auth.user.username}</h1>
      <p className="text-sm text-[var(--c-text-dim)] mb-8">
        حساب ماینکرفت:{" "}
        {mcAccount ? (
          <Link href={`/players/${mcAccount.username}`} className="mono text-[var(--c-pink)] hover:underline">
            {mcAccount.username}
          </Link>
        ) : (
          <span>هنوز متصل نشده</span>
        )}
      </p>

      {/* server status strip */}
      <div className="card p-5 mb-8 flex flex-wrap items-center gap-4">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${status.online ? "bg-[var(--c-green)]" : "bg-[var(--c-red)]"}`} />
        <span className="mono text-sm select-all">{MC_ADDRESS}</span>
        <span className={`badge ${status.state === "unknown" ? "badge-amber" : status.online ? "badge-green" : "badge-red"}`}>
          {status.state === "unknown" ? "نامشخص" : status.online ? "آنلاین" : "آفلاین"}
        </span>
        {status.online && (
          <span className="num text-sm text-[var(--c-text-dim)]">
            {formatNumber(status.playersOnline)} / {formatNumber(status.playersMax)} بازیکن
          </span>
        )}
        {topTier && <span className="badge badge-pink ms-auto">تیر: {topTier.tier.name} ({topTier.category.name})</span>}
      </div>

      {!mcAccount && (
        <div className="card-raised p-6 mb-8">
          <h2 className="font-heading font-bold mb-2">اتصال حساب ماینکرفت</h2>
          <p className="text-sm text-[var(--c-text-dim)] mb-4">
            برای نمایش آمار، تیر و خریدها، حساب ماینکرفت خود را متصل کنید.
          </p>
          <Link href="/dashboard/profile" className="btn btn-primary">اتصال حساب</Link>
        </div>
      )}

      {/* stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-4 text-center">
            <div className="num text-xl font-bold">{value}</div>
            <div className="text-xs text-[var(--c-text-faint)] mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* tier history */}
        <div className="card p-6">
          <h2 className="font-heading font-bold mb-4">تاریخچه تیر</h2>
          {!mcAccount || mcAccount.tierHistory.length === 0 ? (
            <p className="text-sm text-[var(--c-text-dim)]">—</p>
          ) : (
            <ul className="space-y-3">
              {mcAccount.tierHistory.map((h) => (
                <li key={h.id} className="flex items-center gap-3 text-sm">
                  <span className="tier-badge tier-mid">{h.toTier?.name ?? "—"}</span>
                  <span className="text-[var(--c-text-faint)] text-xs">{h.category.name}</span>
                  <span className="ms-auto text-xs text-[var(--c-text-faint)]">{timeAgo(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* activity */}
        <div className="card p-6">
          <h2 className="font-heading font-bold mb-4">فعالیت اخیر</h2>
          {!mcAccount ? (
            <p className="text-sm text-[var(--c-text-dim)]">—</p>
          ) : (
            <RecentActivity accountId={mcAccount.id} />
          )}
        </div>
      </div>
    </div>
  );
}

async function RecentActivity({ accountId }: { accountId: string }) {
  const activity = await prisma.playerActivity.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  if (activity.length === 0) return <p className="text-sm text-[var(--c-text-dim)]">—</p>;
  return (
    <ul className="space-y-2.5">
      {activity.map((a) => (
        <li key={a.id} className="flex items-center gap-3 text-sm">
          <span className="badge">{a.type}</span>
          <span className="text-[var(--c-text-dim)] truncate">{a.detail ?? ""}</span>
          <span className="ms-auto text-xs text-[var(--c-text-faint)] whitespace-nowrap">{formatDate(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
