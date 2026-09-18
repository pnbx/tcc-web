import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { getCachedStatus } from "@/lib/mc";
import { formatNumber, priceLabel, formatDateTime } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const auth = await getAuth();
  const [users, accounts, orders, revenue, audit, status] = await Promise.all([
    prisma.user.count(),
    prisma.minecraftAccount.count({ where: { linkedAt: { not: null } } }),
    prisma.order.findMany({ where: { status: "PAID" }, select: { totalCents: true }, take: 1000 }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    getCachedStatus(),
  ]);
  void orders;

  const cards = [
    ["کاربران وب", formatNumber(users)],
    ["بازیکنان متصل", formatNumber(accounts)],
    ["درآمد تأییدشده", priceLabel(revenue._sum.totalCents ?? 0)],
    ["وضعیت سرور", status.online ? `آنلاین (${formatNumber(status.playersOnline ?? 0)})` : "آفلاین"],
  ];

  return (
    <div className="fade-up">
      <h1 className="font-display text-2xl font-black mb-6">نمای کلی ادمین</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5">
            <div className="text-xs text-[var(--c-text-faint)] mb-1">{label}</div>
            <div className="num text-xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold">آخرین رخدادهای حساس (Audit)</h2>
          <Link href="/dashboard" className="text-xs text-[var(--c-text-faint)]">پنل کاربری ←</Link>
        </div>
        <ul className="space-y-2.5">
          {audit.map((a) => (
            <li key={a.id} className="text-sm flex flex-wrap gap-x-3 items-baseline">
              <span className="mono text-xs text-[var(--c-text-faint)]">{formatDateTime(a.createdAt)}</span>
              <span className="font-ui font-semibold">{a.actorName}</span>
              <span className="badge">{a.action}</span>
              {a.target && <span className="mono text-xs text-[var(--c-text-dim)]">{a.target}</span>}
            </li>
          ))}
          {audit.length === 0 && <li className="text-sm text-[var(--c-text-dim)]">—</li>}
        </ul>
      </div>
    </div>
  );
}
