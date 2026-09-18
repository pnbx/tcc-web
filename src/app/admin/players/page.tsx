import { getAuth, hasPermission } from "@/lib/auth";
import { AdminPlayersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  const auth = await getAuth();
  if (!auth) return null;
  return (
    <AdminPlayersClient
      canBan={hasPermission(auth.permissions, "players.ban")}
      canRoles={hasPermission(auth.permissions, "users.roles")}
      canLink={hasPermission(auth.permissions, "players.link")}
    />
  );
}
