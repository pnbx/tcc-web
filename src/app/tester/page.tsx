import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth, hasPermission } from "@/lib/auth";
import { AdminTiersClient } from "@/app/admin/tiers/client";
import { formatDate } from "@/components/format";

export const dynamic = "force-dynamic";

// Tester home: hand out a tier (site + game) and see your own recent test results.
export default async function TesterPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const [categories, recent] = await Promise.all([
    prisma.tierCategory.findMany({
      orderBy: { position: "asc" },
      include: { tiers: { orderBy: { position: "asc" }, select: { name: true } } },
    }),
    prisma.tierHistory.findMany({
      where: { createdById: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { account: { select: { username: true } }, category: { select: { name: true } }, toTier: { select: { name: true } }, fromTier: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-8 fade-up">
      <div>
        <h1 className="font-display text-2xl font-black mb-2">دادن تیر</h1>
        <p className="text-sm text-[var(--text-dim)] text-[var(--c-text-dim)] leading-7">
          بازیکن را انتخاب کن، حالت و تیر را بزن. تغییر هم روی سایت ثبت می‌شود و هم دستور
          <span className="mono mx-1">/settier</span>
          در بازی (توسط ایجنت، حداکثر ۱۰ ثانیه) اجرا می‌شود تا پسوند و تگ بازیکن هم به‌روز شود.
        </p>
      </div>

      <AdminTiersClient
        categories={categories.map((c) => ({ key: c.key, name: c.name, tiers: c.tiers.map((t) => t.name) }))}
        canAssign={hasPermission(auth.permissions, "tiers.assign")}
        canCreate={hasPermission(auth.permissions, "tiers.create")}
      />

      <div className="card p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-heading font-bold">آخرین تست‌های تو</h2>
          <Link href="/tester/tiers" className="text-sm text-[var(--c-pink)] hover:underline">
            تعریف تیرها ←
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--c-text-dim)]">هنوز تیری ثبت نکرده‌ای.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>زمان</th>
                  <th>بازیکن</th>
                  <th>حالت</th>
                  <th>از</th>
                  <th>به</th>
                  <th>یادداشت</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((h) => (
                  <tr key={h.id}>
                    <td className="num text-xs">{formatDate(h.createdAt)}</td>
                    <td className="mono">{h.account.username}</td>
                    <td>{h.category.name}</td>
                    <td className="mono text-xs text-[var(--c-text-faint)]">{h.fromTier?.name ?? "—"}</td>
                    <td className="font-semibold">{h.toTier?.name ?? "—"}</td>
                    <td className="text-xs text-[var(--c-text-dim)]">{h.note ?? "—"}</td>
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
