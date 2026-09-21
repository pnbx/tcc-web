import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { mcTokenAuthorized } from "@/lib/mc/auth";
import { settleCommand } from "@/lib/mc/queue";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/mc/ack — the bridge plugin reports the result of executed commands.
const schema = z.object({
  results: z
    .array(z.object({ id: z.string().min(1).max(60), ok: z.boolean(), result: z.string().max(200_000).optional() }))
    .min(1)
    .max(50),
});

export async function POST(req: NextRequest) {
  try {
    if (!mcTokenAuthorized(req)) return jsonError("unauthorized", 401);
    const { results } = await parseBody(req, schema);
    for (const r of results) {
      await settleCommand(r.id, r.ok, r.result);
    }
    await audit({
      actorName: "bridge",
      action: "mc.command_results",
      detail: { done: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length },
    });
    return jsonOk({ settled: results.length });
  } catch (err) {
    return handleApiError(err);
  }
}
