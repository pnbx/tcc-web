import { prisma } from "@/lib/db";
import { formatDateTime } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function OwnerLogsPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const { action } = await searchParams;

  const logs = await prisma.auditLog.findMany({
    where: action ? { action: { contains: action } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-black">لاگ‌های حسابرسی</h1>
        <form method="get" className="flex gap-2">
          <input name="action" defaultValue={action ?? ""} placeholder="فیلتر action…" className="input !w-56 ltr" />
          <button className="btn btn-ghost">فیلتر</button>
        </form>
      </div>

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
