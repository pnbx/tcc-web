import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { priceLabel, formatDateTime } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const [orders, active] = await Promise.all([
    prisma.order.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: { select: { name: true } } } } },
      take: 25,
    }),
    prisma.userProduct.findMany({
      where: { userId: auth.user.id, active: true },
      include: { product: { select: { name: true, kind: true } } },
      orderBy: { grantedAt: "desc" },
    }),
  ]);

  return (
    <div className="fade-up space-y-8">
      <div>
        <h1 className="font-display text-2xl font-black mb-6">خریدهای من</h1>

        <h2 className="font-heading font-bold mb-3">مواد فعال</h2>
        {active.length === 0 ? (
          <div className="card p-6 text-sm text-[var(--c-text-dim)] mb-8">مورد فعالی ندارید.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {active.map((up) => (
              <div key={up.id} className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-ui font-semibold">{up.product.name}</span>
                  <span className="badge badge-green">فعال</span>
                </div>
                <div className="text-xs text-[var(--c-text-faint)]">
                  {up.expiresAt ? `انقضا: ${formatDateTime(up.expiresAt)}` : "دائمی"}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="font-heading font-bold mb-3">سابقه سفارش‌ها</h2>
        {orders.length === 0 ? (
          <div className="card p-6 text-sm text-[var(--c-text-dim)]">
            سفارشی ثبت نشده. <Link href="/store" className="text-[var(--c-pink)] hover:underline">رفتن به استور ←</Link>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>شماره سفارش</th>
                  <th>موارد</th>
                  <th>مبلغ</th>
                  <th>وضعیت</th>
                  <th>تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono text-xs">
                      <Link href={`/store/result/${o.orderNumber}`} className="hover:text-[var(--c-pink)]">{o.orderNumber}</Link>
                    </td>
                    <td>{o.items.map((i) => i.product.name).join("، ")}</td>
                    <td className="num">{priceLabel(o.totalCents, o.currency)}</td>
                    <td>
                      <span className={`badge ${o.status === "PAID" ? "badge-green" : o.status === "FAILED" ? "badge-red" : "badge-amber"}`}>
                        {o.status === "PAID" ? "پرداخت‌شده" : o.status === "FAILED" ? "ناموفق" : o.status === "REFUNDED" ? "بازگشتی" : "در انتظار"}
                      </span>
                    </td>
                    <td className="text-xs">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
