import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { mcTokenAuthorized } from "@/lib/mc/auth";
import { writeStatusPush } from "@/lib/mc/status-store";

export const dynamic = "force-dynamic";

// POST /api/mc/ingest — the game server (or a small agent on it) pushes its
// real status here. This is the only status path that works when the game host
// cannot be reached from the host running this site (Iranian hosts drop
// foreign traffic), so it takes priority over any live probe.
//
// Auth: shared token in the X-TCC-Token header (MC_INGEST_TOKEN).
const schema = z.object({
  playersOnline: z.number().int().min(0).max(100000).nullable().optional(),
  playersMax: z.number().int().min(0).max(100000).nullable().optional(),
  tps: z.number().min(0).max(1000).nullable().optional(),
  mspt: z.number().min(0).max(100000).nullable().optional(),
  version: z.string().max(120).nullable().optional(),
  motd: z.array(z.string().max(400)).max(8).nullable().optional(),
  favicon: z.string().max(200000).nullable().optional(),
  source: z.string().max(40).nullable().optional(),
});

function authorized(req: NextRequest): boolean {
  return mcTokenAuthorized(req);
}

export async function POST(req: NextRequest) {
  try {
    if (!authorized(req)) return jsonError("unauthorized", 401);
    const body = await parseBody(req, schema);
    await writeStatusPush(body);
    return jsonOk({ received: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST status JSON with X-TCC-Token" });
}
