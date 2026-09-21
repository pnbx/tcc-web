import { prisma } from "@/lib/db";
import type { ConsoleLine, FileEntry, FileContent, LiveMetrics } from "./types";

// ── Agent channel ───────────────────────────────────────────────────────────
// The bridge plugin runs inside the game server: it can read the log, touch the
// filesystem and act on power. Whenever the site cannot reach the panel (the
// Iranian host drops foreign traffic), every panel-backed feature is routed
// through this queue instead of failing.

const POLL_STAMP_KEY = "mc_agent_last_poll";
const AGENT_FRESH_MS = 90_000;

export async function markAgentPoll(): Promise<void> {
  await prisma.setting
    .upsert({
      where: { key: POLL_STAMP_KEY },
      create: { key: POLL_STAMP_KEY, value: JSON.stringify({ at: new Date().toISOString() }) },
      update: { value: JSON.stringify({ at: new Date().toISOString() }) },
    })
    .catch(() => undefined);
}

export async function agentOnline(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: POLL_STAMP_KEY } }).catch(() => null);
  if (!row) return false;
  try {
    const { at } = JSON.parse(row.value) as { at: string };
    return Date.now() - new Date(at).getTime() < AGENT_FRESH_MS;
  } catch {
    return false;
  }
}

/** Queue a job and wait for the agent to settle it. Returns null on timeout. */
export async function runJob<T = unknown>(
  kind: string,
  payload: Record<string, unknown>,
  opts: { timeoutMs?: number; label?: string; source?: string } = {},
): Promise<T | null> {
  const row = await prisma.mcCommand.create({
    data: {
      kind,
      command: opts.label ?? kind,
      payload: JSON.stringify(payload),
      source: opts.source ?? `job:${kind}`,
    },
  });

  const deadline = Date.now() + (opts.timeoutMs ?? 9000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400));
    const now = await prisma.mcCommand.findUnique({ where: { id: row.id } });
    if (!now) return null;
    if (now.status === "DONE") {
      try {
        return now.result ? (JSON.parse(now.result) as T) : (null as T);
      } catch {
        return null;
      }
    }
    if (now.status === "FAILED") {
      throw new Error(now.result || "اجرای درخواست روی سرور ناموفق بود.");
    }
  }
  return null;
}

// ── Console feed (pushed by the plugin) ─────────────────────────────────────

export async function appendConsoleLines(
  lines: { ts?: number; level?: string; thread?: string; message: string }[],
): Promise<void> {
  if (lines.length === 0) return;
  const rows = lines.slice(-500).map((l) => ({
    ts: new Date(l.ts || Date.now()),
    level: (l.level || "INFO").toUpperCase().slice(0, 10),
    thread: l.thread?.slice(0, 60) ?? null,
    message: l.message.slice(0, 4000),
  }));
  await prisma.mcLogLine.createMany({ data: rows });
  // keep the feed bounded (the console is a window, not an archive)
  const newest = await prisma.mcLogLine.findMany({ select: { id: true }, orderBy: { ts: "desc" }, skip: 4000, take: 1 });
  if (newest.length > 0) {
    const cut = newest[0].id;
    const cutoff = await prisma.mcLogLine.findUnique({ where: { id: cut }, select: { ts: true } });
    if (cutoff) await prisma.mcLogLine.deleteMany({ where: { ts: { lt: cutoff.ts } } });
  }
}

export async function readConsoleFeed(opts?: { after?: number; limit?: number; grep?: string; level?: string[] }): Promise<ConsoleLine[] | null> {
  const latest = await prisma.mcLogLine.findFirst({ orderBy: { ts: "desc" } });
  if (!latest) return null;
  // stale feed (agent stopped pushing) → let the caller fall back
  if (Date.now() - latest.ts.getTime() > 10 * 60_000) return null;

  const rows = await prisma.mcLogLine.findMany({
    where: {
      ...(opts?.after ? { ts: { gt: new Date(opts.after) } } : {}),
      ...(opts?.grep ? { message: { contains: opts.grep } } : {}),
      ...(opts?.level?.length ? { level: { in: opts.level } } : {}),
    },
    orderBy: { ts: "asc" },
    take: opts?.limit ?? 500,
  });
  return rows.map((r) => ({
    ts: r.ts.getTime(),
    level: (r.level as ConsoleLine["level"]) ?? "INFO",
    thread: r.thread ?? "-",
    message: r.message,
  }));
}

// ── Metrics from the pushed snapshot ────────────────────────────────────────

export async function readMetricSnapshot(maxAgeMs = 120_000): Promise<LiveMetrics | null> {
  const since = new Date(Date.now() - maxAgeMs);
  const row = await prisma.serverMetric
    .findFirst({ where: { recordedAt: { gte: since } }, orderBy: { recordedAt: "desc" } })
    .catch(() => null);
  if (!row) return null;

  let meta: { version?: string | null; source?: string; uptimeSec?: number | null } = {};
  try {
    meta = row.raw ? JSON.parse(row.raw) : {};
  } catch {
    meta = {};
  }

  return {
    collectedAt: row.recordedAt.toISOString(),
    playersOnline: row.playersOnline,
    playersMax: row.playersMax,
    tps: row.tps,
    mspt: row.mspt,
    cpuPercent: row.cpuPercent,
    memoryUsedMb: row.memoryUsedMb,
    memoryMaxMb: row.memoryMaxMb,
    diskUsedGb: row.diskUsedGb,
    diskTotalGb: row.diskTotalGb,
    netRxKbps: row.netRxKbps,
    netTxKbps: row.netTxKbps,
    uptimeSec: meta.uptimeSec ?? null,
    source: meta.source ?? "plugin",
  };
}

// ── File operations through the agent ───────────────────────────────────────

export async function agentListFiles(dir: string): Promise<FileEntry[] | null> {
  if (!(await agentOnline())) return null;
  return runJob<FileEntry[]>("file.list", { dir }, { label: `list ${dir || "/"}` });
}

export async function agentReadFile(path: string, limitBytes = 512 * 1024): Promise<FileContent | null> {
  if (!(await agentOnline())) return null;
  return runJob<FileContent>("file.read", { path, limitBytes }, { label: `read ${path}`, timeoutMs: 12_000 });
}

export async function agentWriteFile(path: string, content: string, exclusive = false): Promise<void | null> {
  if (!(await agentOnline())) return null;
  await runJob("file.write", { path, content, exclusive }, { label: `write ${path}`, timeoutMs: 20_000 });
  return undefined;
}

export async function agentSimple(kind: "file.delete" | "file.mkdir", path: string): Promise<void | null> {
  if (!(await agentOnline())) return null;
  await runJob(kind, { path }, { label: `${kind} ${path}` });
  return undefined;
}

export async function agentRename(from: string, to: string): Promise<void | null> {
  if (!(await agentOnline())) return null;
  await runJob("file.rename", { from, to }, { label: `rename ${from}` });
  return undefined;
}

export async function agentSearch(dir: string, pattern: string): Promise<{ path: string; line: number; text: string }[] | null> {
  if (!(await agentOnline())) return null;
  return runJob("file.search", { dir, pattern }, { label: `search ${pattern}`, timeoutMs: 20_000 });
}
