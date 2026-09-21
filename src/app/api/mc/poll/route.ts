import { NextRequest } from "next/server";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { mcTokenAuthorized } from "@/lib/mc/auth";
import { takePendingCommands } from "@/lib/mc/queue";

export const dynamic = "force-dynamic";

// POST /api/mc/poll — the bridge plugin collects queued console commands
// (store rank grants, tier rewards). Commands are marked SENT on delivery, so a
// crashed agent never double-executes them; /api/mc/ack reports the outcome.
export async function POST(req: NextRequest) {
  try {
    if (!mcTokenAuthorized(req)) return jsonError("unauthorized", 401);
    const commands = await takePendingCommands(20);
    return jsonOk({ commands });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  return jsonError("POST with X-TCC-Token to poll commands", 405);
}
