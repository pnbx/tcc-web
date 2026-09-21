// Status snapshots.
//
// The game host and this site live in different networks that cannot always
// reach each other (the Iranian game host drops foreign traffic), so the site
// must never *depend* on a live probe for its page render:
//
//   1. the game side pushes a snapshot (POST /api/mc/ingest) → stored here
//   2. pages read the newest snapshot with one fast DB read
//   3. only when nothing fresh exists do we probe the socket, with a short
//      timeout, and report state "unknown" rather than a false "offline".

import { prisma } from "@/lib/db";
import type { ServerStatus } from "./types";
import { MC_ADDRESS, MC_HOST, MC_PORT } from "./index";

export type StatusPush = {
  playersOnline?: number | null;
  playersMax?: number | null;
  tps?: number | null;
  mspt?: number | null;
  version?: string | null;
  motd?: string[] | null;
  favicon?: string | null;
  source?: string | null;
};

const FRESH_MS = 120_000; // a snapshot newer than this is authoritative
const KEEP_MS = 7 * 24 * 3600_000; // retention for the metrics table

export async function writeStatusPush(push: StatusPush): Promise<void> {
  const raw = JSON.stringify({
    version: push.version ?? null,
    motd: push.motd ?? null,
    favicon: push.favicon ?? null,
    source: push.source ?? "push",
  });
  await prisma.serverMetric.create({
    data: {
      playersOnline: push.playersOnline ?? null,
      playersMax: push.playersMax ?? null,
      tps: push.tps ?? null,
      mspt: push.mspt ?? null,
      raw,
    },
  });
  // Prune old rows occasionally; failures here must never break the request.
  void prisma.serverMetric
    .deleteMany({ where: { recordedAt: { lt: new Date(Date.now() - KEEP_MS) } } })
    .catch(() => {});
}

/** Newest snapshot (optionally within maxAgeMs) as a ServerStatus, else null. */
export async function readStatusSnapshot(maxAgeMs = FRESH_MS): Promise<ServerStatus | null> {
  const since = new Date(Date.now() - maxAgeMs);
  const row = await prisma.serverMetric
    .findFirst({ where: { recordedAt: { gte: since } }, orderBy: { recordedAt: "desc" } })
    .catch(() => null);

  if (!row || row.playersOnline == null) return null;

  let meta: { version?: string | null; motd?: string[] | null; favicon?: string | null; source?: string } = {};
  try {
    meta = row.raw ? JSON.parse(row.raw) : {};
  } catch {
    meta = {};
  }

  return {
    online: true,
    state: "online",
    host: MC_HOST,
    port: MC_PORT,
    playersOnline: row.playersOnline,
    playersMax: row.playersMax,
    version: meta.version ?? null,
    latencyMs: null,
    motd: meta.motd ? { clean: meta.motd } : null,
    favicon: meta.favicon ?? null,
    source: "push",
    error: null,
    checkedAt: row.recordedAt.toISOString(),
    reportedAt: row.recordedAt.toISOString(),
  };
}

/** Last snapshot of any age — used to say "last seen 12 minutes ago" honestly. */
export async function readLatestSnapshotAnyAge(): Promise<{ at: string; playersOnline: number | null; playersMax: number | null } | null> {
  const row = await prisma.serverMetric
    .findFirst({ where: { playersOnline: { not: null } }, orderBy: { recordedAt: "desc" } })
    .catch(() => null);
  if (!row) return null;
  return { at: row.recordedAt.toISOString(), playersOnline: row.playersOnline, playersMax: row.playersMax };
}

export { MC_ADDRESS, MC_HOST, MC_PORT };
