import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth, hasPermission } from "@/lib/auth";
import { getCachedStatus, getMinecraft, MC_HOST } from "@/lib/mc";
import { formatNumber, formatDateTime } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function OwnerOverview() {
  await getAuth();
  const [status, metrics, events, audit] = await Promise.all([
    getCachedStatus(),
    getMinecraft().getMetrics(),
    prisma.serverEvent.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const caps = getMinecraft().capabilityReport();

  return (
    <div className="fade-up space-y-8">
      <div>
        <h1 className="font-display text-2xl font-black">نمای کلی مالک</h1>
        <p className="text-sm text-[var(--c-text-dim)] mt-1">
          سرور <span className="mono">{MC_HOST}</span> — داده‌ها مستقیم از یکپارچگی سرور خوانده می‌شوند.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="وضعیت" value={status.online ? "آنلاین" : "آفلاین"} accent={status.online} />
        <StatCard label="بازیکنان" value={status.online ? `${formatNumber(status.playersOnline)} / ${formatNumber(status.playersMax)}` : "—"} />
        <StatCard label="TPS" value={metrics?.tps != null ? metrics.tps.toFixed(1) : "—"} />
        <StatCard label="MSPT" value={metrics?.mspt != null ? metrics.mspt.toFixed(1) : "—"} />
      </div>

      <section>
        <h2 className="font-heading font-bold mb-3">قابلیت‌های یکپارچگی</h2>
        <div className="card p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(caps).map(([cap, info]) => (
            <div key={cap} className="flex items-center gap-2 text-sm">
              <span className={`inline-block w-2 h-2 rounded-full ${info.available ? "bg-[var(--c-green)]" : "bg-[var(--c-amber)]"}`} />
              <span className="mono text-xs">{cap}</span>
              {!info.available && <span className="text-[10px] text-[var(--c-text-faint)] truncate">نیاز به بریج</span>}
            </div>
          ))}
        </div>
        {!caps.files.available && (
          <p className="text-xs text-[var(--c-text-faint)] mt-2 leading-5">
            برای کنسول زنده، کنترل قدرت، فایل‌ها و آمار بازیکنان، پلاگین TCC Bridge را روی سرور نصب و
            BRIDGE_URL/BRIDGE_TOKEN را در .env تنظیم کنید.
          </p>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="font-heading font-bold mb-4">رخدادهای سرور</h2>
          <ul className="space-y-2.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 text-sm">
                <span className="badge badge-purple">{e.type}</span>
                <span className="text-[var(--c-text-dim)] text-xs">{e.detail}</span>
                <span className="ms-auto text-xs text-[var(--c-text-faint)]">{formatDateTime(e.createdAt)}</span>
              </li>
            ))}
            {events.length === 0 && <li className="text-sm text-[var(--c-text-dim)]">—</li>}
          </ul>
        </section>
        <section className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold">آخرین اقدامات حساس</h2>
            <Link href="/owner/logs" className="text-xs text-[var(--c-pink)] hover:underline">همه ←</Link>
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
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-[var(--c-text-faint)] mb-1">{label}</div>
      <div className={`num text-xl font-bold ${accent ? "text-[var(--c-green)]" : ""}`}>{value}</div>
    </div>
  );
}
