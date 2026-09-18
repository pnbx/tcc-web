import { prisma } from "@/lib/db";
import { getAuth, hasPermission } from "@/lib/auth";
import { AdminTiersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminTiersPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const categories = await prisma.tierCategory.findMany({
    orderBy: { position: "asc" },
    include: { tiers: { orderBy: { position: "asc" }, select: { name: true } } },
  });

  return (
    <AdminTiersClient
      categories={categories.map((c) => ({ key: c.key, name: c.name, tiers: c.tiers.map((t) => t.name) }))}
      canAssign={hasPermission(auth.permissions, "tiers.assign")}
      canCreate={hasPermission(auth.permissions, "tiers.create")}
    />
  );
}
