import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { mcTokenAuthorized } from "@/lib/mc/auth";
import { appendConsoleLines } from "@/lib/mc/agent";
import { recordDuelResults } from "@/lib/duels";

export const dynamic = "force-dynamic";

// POST /api/mc/logs — the bridge agent streams new console lines here so the
// site's console page works even when the panel is unreachable from the host
// running this site.
const schema = z.object({
  lines: z
    .array(
      z.object({
        ts: z.number().optional(),
        level: z.string().max(12).optional(),
        thread: z.string().max(80).optional(),
        message: z.string().max(4000),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest) {
  try {
    if (!mcTokenAuthorized(req)) return jsonError("unauthorized", 401);
    const { lines } = await parseBody(req, schema);
    await appendConsoleLines(lines);
    // duel lines carry wins/losses, which vanilla statistics do not track
    void recordDuelResults(lines.map((line) => line.message)).catch(() => undefined);
    return jsonOk({ received: lines.length });
  } catch (err) {
    return handleApiError(err);
  }
}
