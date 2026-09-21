import { NextRequest } from "next/server";
import { getMinecraft } from "@/lib/mc";
import { readMetricSnapshot } from "@/lib/mc/agent";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/server/metrics — real metrics from the adapter; persists a sample
// so the monitoring charts have history. Nulls mean "not available from this
// integration" and are rendered as such — never faked.
export async function GET(_req: NextRequest) {
  try {
    await requirePermission("server.metrics");
    // Pushed metrics (plugin) win when the game host cannot be reached from here.
    const pushed = await readMetricSnapshot();
    const metrics = pushed ?? (await getMinecraft().getMetrics());

    // A pushed snapshot already lives in the table — only adapter samples are stored here.
    if (metrics && !pushed) {
      await prisma.serverMetric.create({
        data: {
          playersOnline: metrics.playersOnline,
          playersMax: metrics.playersMax,
          tps: metrics.tps,
          mspt: metrics.mspt,
          cpuPercent: metrics.cpuPercent,
          memoryUsedMb: metrics.memoryUsedMb,
          memoryMaxMb: metrics.memoryMaxMb,
          diskUsedGb: metrics.diskUsedGb,
          diskTotalGb: metrics.diskTotalGb,
          netRxKbps: metrics.netRxKbps,
          netTxKbps: metrics.netTxKbps,
          raw: JSON.stringify({ uptimeSec: metrics.uptimeSec, source: metrics.source }),
        },
      }).catch(() => undefined);
    }

    return jsonOk({ metrics, capabilities: getMinecraft().capabilityReport() });
  } catch (err) {
    return handleApiError(err);
  }
}
