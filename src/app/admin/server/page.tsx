import { getAuth, hasPermission } from "@/lib/auth";
import { getCachedStatus, getMinecraft, MC_HOST } from "@/lib/mc";
import { readMetricSnapshot } from "@/lib/mc/agent";
import { ServerStatusCard } from "./status-card";

export const dynamic = "force-dynamic";

export default async function AdminServerPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const [status, metrics] = await Promise.all([
    getCachedStatus(),
    hasPermission(auth.permissions, "server.metrics") ? (await readMetricSnapshot()) ?? (await getMinecraft().getMetrics()) : Promise.resolve(null),
  ]);

  const caps = getMinecraft().capabilityReport();

  return (
    <div className="fade-up space-y-6">
      <h1 className="font-display text-2xl font-black">سرور — {MC_HOST}</h1>
      <ServerStatusCard
        status={status}
        metrics={metrics}
        canCommand={hasPermission(auth.permissions, "server.command")}
        canBroadcast={hasPermission(auth.permissions, "server.broadcast")}
        consoleAvailable={caps.console.available}
      />
      {!caps.metrics.available && (
        <p className="text-xs text-[var(--c-text-faint)]">{caps.metrics.reason}</p>
      )}
    </div>
  );
}
