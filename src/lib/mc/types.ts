// Integration contract for the TCC Minecraft server.
//
// The website NEVER talks to RCON or the server machine directly from the
// browser. Everything goes through adapters that implement this interface.
// Two implementations ship:
//   - bridge.ts   → dedicated TCC bridge plugin on the server (preferred)
//   - rcon.ts     → RCON fallback (must be firewalled; localhost/VPN only)
// A mock adapter exists ONLY for tests and is never used in production.

import type { PlayerStatistics } from "@/generated/prisma/client";

export type ServerStatus = {
  online: boolean;
  /** "unknown" = we could not reach the server at all (no data either way). */
  state?: "online" | "offline" | "unknown";
  host: string;
  port: number;
  playersOnline: number | null;
  playersMax: number | null;
  version: string | null;
  latencyMs: number | null;
  motd?: { clean: string[]; html?: string } | null;
  favicon?: string | null; // base64 PNG from SLP; null when unavailable
  source: "slp" | "bridge" | "rcon" | "pterodactyl" | "push";
  error?: string | null;
  checkedAt: string; // ISO timestamp
  /** For pushed snapshots: when the game server last reported. */
  reportedAt?: string | null;
};

export type LiveMetrics = {
  collectedAt: string;
  playersOnline: number | null;
  playersMax: number | null;
  tps: number | null;
  mspt: number | null;
  cpuPercent: number | null;
  memoryUsedMb: number | null;
  memoryMaxMb: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  netRxKbps: number | null;
  netTxKbps: number | null;
  uptimeSec: number | null;
  source: string;
};

export type ConsoleLine = {
  ts: number; // epoch ms
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "OTHER";
  thread: string;
  message: string;
};

export type FileEntry = {
  name: string;
  path: string; // relative to sandbox root, always forward slashes
  type: "file" | "dir";
  size: number | null;
  modifiedAt: string | null;
};

export type FileContent = {
  path: string;
  size: number;
  truncated: boolean;
  encoding: "utf8" | "binary";
  content: string | null; // utf8 text or base64 for binary
};

export type PluginInfo = {
  name: string;
  version: string | null;
  enabled: boolean;
  website: string | null;
  authors: string[];
};

// The bridge plugin can push or the site can poll for these.
export type BridgePlayerStats = {
  accountUuid: string;
  kills: number;
  deaths: number;
  wins: number;
  losses: number;
  playtimeMinutes: number;
  lastSeen: string | null;
  joinedAt: string | null;
  raw?: string;
};

export interface MinecraftServerAdapter {
  readonly name: string;

  /** One-shot server list ping; must never throw, returns offline status instead. */
  getStatus(): Promise<ServerStatus>;

  /** Live runtime metrics (TPS/MSPT/CPU/RAM/disk/net). Null when unavailable. */
  getMetrics(): Promise<LiveMetrics | null>;

  /** Recent console lines (poll) or live stream handle (bridge/SSE). */
  getConsoleLines(opts?: { after?: number; limit?: number; grep?: string; level?: string[] }): Promise<ConsoleLine[]>;

  /** Execute a console command. Returns the response lines if any. */
  execCommand(command: string): Promise<{ ok: boolean; output: string[] }>;

  /** Broadcast a message to all players. */
  broadcast(message: string): Promise<{ ok: boolean }>;

  /** Power controls; destructive actions are confirmed in the UI + audited. */
  startServer(): Promise<{ ok: boolean; message?: string }>;
  stopServer(force?: boolean): Promise<{ ok: boolean; message?: string }>;
  restartServer(): Promise<{ ok: boolean; message?: string }>;

  /** Sandbox file operations (bridge only; RCON adapter returns not-available). */
  listFiles(dir: string): Promise<FileEntry[]>;
  readFile(path: string, limitBytes?: number): Promise<FileContent>;
  writeFile(path: string, content: string): Promise<{ ok: boolean }>;
  createFile(path: string, content?: string): Promise<{ ok: boolean }>;
  deleteFile(path: string): Promise<{ ok: boolean }>;
  mkdir(path: string): Promise<{ ok: boolean }>;
  renameFile(from: string, to: string): Promise<{ ok: boolean }>;
  searchFiles(dir: string, pattern: string): Promise<{ path: string; line: number; text: string }[]>;

  /** Installed plugins (bridge only). */
  listPlugins(): Promise<PluginInfo[]>;

  /** Bulk player statistics from the server's source of truth. */
  fetchPlayerStats(since?: Date): Promise<BridgePlayerStats[]>;

  /** Human-readable unavailability reason when a capability is missing. */
  capabilityReport(): Record<string, { available: boolean; reason?: string }>;
}
