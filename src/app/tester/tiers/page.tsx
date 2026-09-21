import { prisma } from "@/lib/db";
import { getAuth, hasPermission } from "@/lib/auth";
import { AdminTiersClient } from "@/app/admin/tiers/client";

export const dynamic = "force-dynamic";

// Tier definitions for testers: add a tier to a mode or rename/reorder the ones
// they run tests for. The in-game system reads the same names (ht1…lt5).
export default async function TesterTiersPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const categories = await prisma.tierCategory.findMany({
    orderBy: { position: "asc" },
    include: { tiers: { orderBy: { position: "asc" }, select: { name: true } } },
  });

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="font-display text-2xl font-black mb-2">تعریف تیرها</h1>
        <p className="text-sm text-[var(--c-text-dim)] leading-7">
          نام تیرها باید با نام‌هایی که در بازی استفاده می‌شود یکی باشد
          (<span className="mono">ht1</span> … <span className="mono">lt5</span>).
          ترتیب از بالا (بهترین) به پایین است.
        </p>
      </div>

      <AdminTiersClient
        categories={categories.map((c) => ({ key: c.key, name: c.name, tiers: c.tiers.map((t) => t.name) }))}
        canAssign={false}
        canCreate={hasPermission(auth.permissions, "tiers.create")}
      />
    </div>
  );
}
