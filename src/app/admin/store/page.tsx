import { getAuth, hasPermission } from "@/lib/auth";
import { AdminStoreClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminStorePage() {
  const auth = await getAuth();
  if (!auth) return null;
  return <AdminStoreClient canEdit={hasPermission(auth.permissions, "store.delete")} />;
}
