import { prisma } from "@/lib/db";
import { getAuth, hasPermission } from "@/lib/auth";
import { formatDateTime } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function DeveloperLogsPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const auth = await getAuth();
  if (!auth) return null;
  const { action } = await searchParams;
  const canView = hasPermission(auth.permissions, "audit.view") || hasPermission(auth.permissions, "logs.view");

  if (!canView) {
    return <div className="card p-6 text-sm text-[var(--c-text-dim)]">دسترسی به لاگ‌ها ندارید.</div>;
  }

  const logs = await prisma.auditLog.findMany({
    where: action ? { action: { contains: action } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return (
    <div className="fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-black">لاگ وب و حسابرسی</h1>
        <form method="get" className="flex gap-2">
          <input name="action" defaultValue={action ?? ""} placeholder="فیلتر action…" className="input !w-56 ltr" />
          <button className="btn btn-ghost">فیلتر</button>
        </form>
      </div>

      <p className="text-xs text-[var(--c-text-faint)] leading-5">
        لاگ‌های سرور (latest.log، proxy و غیره) از بخش «فایل‌ها» در مسیر
        <span className="mono"> logs/</span> قابل مشاهده و جستجو هستند.
      </p>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>زمان</th>
              <th>کاربر</th>
              <th>اقدام</th>
              <th>هدف</th>
              <th>جزئیات</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="mono text-xs whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                <td className="font-ui font-semibold">{l.actorName}</td>
                <td><span className="badge">{l.action}</span></td>
                <td className="mono text-xs">{l.target ?? "—"}</td>
                <td className="mono text-[10px] max-w-md truncate">{l.detail ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="text-center">لاگی یافت نشد.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
