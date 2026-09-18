import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { formatDateTime, priceLabel } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function OrderResultPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const auth = await getAuth();
  if (!auth) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: { select: { name: true } } } } },
  });
  if (!order || order.userId !== auth.user.id) notFound();

  const statusBadge =
    order.status === "PAID" ? "badge-green" : order.status === "FAILED" ? "badge-red" : "badge-amber";
  const statusLabel =
    order.status === "PAID" ? "پرداخت موفق" : order.status === "FAILED" ? "ناموفق" : "در انتظار تأیید";

  return (
    <div className="min-h-screen">
      <SiteHeader authed />
      <main className="max-w-lg mx-auto px-4 py-16 fade-up">
        <div className="card p-8 text-center">
          <div className={`badge ${statusBadge} mx-auto mb-5`}>{statusLabel}</div>
          <h1 className="font-display text-xl font-black mb-2">سفارش {order.orderNumber}</h1>
          <p className="num text-2xl font-bold text-[var(--c-pink)] mb-6">{priceLabel(order.totalCents, order.currency)}</p>
          <ul className="text-sm text-[var(--c-text-dim)] space-y-2 mb-6">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>{i.product.name} × {i.quantity}</span>
                <span className="num">{priceLabel(i.unitPriceCents * i.quantity, order.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--c-text-faint)] mb-8">
            ثبت: {formatDateTime(order.createdAt)}
            {order.paidAt ? ` — تأیید: ${formatDateTime(order.paidAt)}` : ""}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard/purchases" className="btn btn-primary">سابقه خریدها</Link>
            <Link href="/store" className="btn btn-ghost">بازگشت به استور</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
