import { getAuth, hasPermission } from "@/lib/auth";
import { AdminPlayersClient } from "@/app/admin/players/client";

export const dynamic = "force-dynamic";

export default async function OwnerPlayersPage() {
  const auth = await getAuth();
  if (!auth) return null;
  return (
    <div className="fade-up">
      <AdminPlayersClient
        canBan={hasPermission(auth.permissions, "players.ban")}
        canRoles={hasPermission(auth.permissions, "users.roles")}
        canLink={hasPermission(auth.permissions, "players.link")}
      />
    </div>
  );
}
