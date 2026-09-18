import { NextRequest } from "next/server";
import { getCachedStatus, MC_HOST, MC_PORT } from "@/lib/mc";
import { handleApiError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/server/status — REAL status via Server List Ping (or bridge).
// No mock data is ever returned; when the server is down the JSON says so.
export async function GET(_req: NextRequest) {
  try {
    const status = await getCachedStatus();
    return jsonOk({ ...status, host: MC_HOST, port: MC_PORT });
  } catch (err) {
    return handleApiError(err);
  }
}
