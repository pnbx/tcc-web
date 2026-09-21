import { NextRequest } from "next/server";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { mcTokenAuthorized } from "@/lib/mc/auth";
import { takePendingCommands } from "@/lib/mc/queue";
import { markAgentPoll } from "@/lib/mc/agent";

export const dynamic = "force-dynamic";

// POST /api/mc/poll — the bridge agent collects queued work: console commands
// (store rank grants) and jobs it runs locally (file operations, power).
// Jobs are marked SENT on delivery, so a crashed agent never double-executes
// them; /api/mc/ack reports the outcome. The poll also proves the agent is
// alive, which is what lets the site route panel features through it.
export async function POST(req: NextRequest) {
  try {
    if (!mcTokenAuthorized(req)) return jsonError("unauthorized", 401);
    await markAgentPoll();
    const commands = await takePendingCommands(20);
    return jsonOk({ commands });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  return jsonError("POST with X-TCC-Token to poll work", 405);
}
