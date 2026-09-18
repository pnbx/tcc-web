// TCC Bridge adapter — the preferred integration. A small dedicated plugin on
// the Minecraft server exposes an authenticated HTTP endpoint on localhost and
// implements the MinecraftServerAdapter contract. The shared token never
// leaves the two machines and is compared in constant time.

import crypto from "node:crypto";
import type {
  BridgePlayerStats,
  ConsoleLine,
  FileContent,
  FileEntry,
  LiveMetrics,
  MinecraftServerAdapter,
  PluginInfo,
  ServerStatus,
} from "./types";

export class BridgeUnavailableError extends Error {}

async function bridgeFetch<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-tcc-token": token,
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 404) throw new BridgeUnavailableError(`bridge endpoint not found: ${path}`);
    if (!res.ok) throw new Error(`bridge ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300));
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export class BridgeAdapter implements MinecraftServerAdapter {
  readonly name = "bridge";
  private statusFallback: () => Promise<ServerStatus>;

  constructor(
    private baseUrl: string,
    private token: string,
    statusFallback: () => Promise<ServerStatus>,
  ) {
    if (!baseUrl) throw new Error("BRIDGE_URL is required for BridgeAdapter");
    if (!token) throw new Error("BRIDGE_TOKEN is required for BridgeAdapter");
    this.statusFallback = statusFallback;
  }

  private call<T>(path: string, init?: RequestInit & { timeoutMs?: number }) {
    return bridgeFetch<T>(this.baseUrl, this.token, path, init);
  }

  async getStatus(): Promise<ServerStatus> {
    try {
      const s = await this.call<Partial<ServerStatus>>("/api/v1/status", { timeoutMs: 3000 });
      return {
        online: !!s.online,
        host: s.host ?? "",
        port: s.port ?? 0,
        playersOnline: s.playersOnline ?? null,
        playersMax: s.playersMax ?? null,
        version: s.version ?? null,
        latencyMs: s.latencyMs ?? null,
        motd: s.motd ?? null,
        favicon: s.favicon ?? null,
        source: "bridge",
        checkedAt: new Date().toISOString(),
      };
    } catch {
      // fall back to direct SLP so the homepage stays truthful
      return this.statusFallback();
    }
  }

  async getMetrics(): Promise<LiveMetrics | null> {
    try {
      const m = await this.call<Partial<LiveMetrics>>("/api/v1/metrics", { timeoutMs: 4000 });
      return {
        collectedAt: new Date().toISOString(),
        playersOnline: m.playersOnline ?? null,
        playersMax: m.playersMax ?? null,
        tps: m.tps ?? null,
        mspt: m.mspt ?? null,
        cpuPercent: m.cpuPercent ?? null,
        memoryUsedMb: m.memoryUsedMb ?? null,
        memoryMaxMb: m.memoryMaxMb ?? null,
        diskUsedGb: m.diskUsedGb ?? null,
        diskTotalGb: m.diskTotalGb ?? null,
        netRxKbps: m.netRxKbps ?? null,
        netTxKbps: m.netTxKbps ?? null,
        uptimeSec: m.uptimeSec ?? null,
        source: "bridge",
      };
    } catch {
      return null;
    }
  }

  async getConsoleLines(opts?: { after?: number; limit?: number; grep?: string; level?: string[] }): Promise<ConsoleLine[]> {
    const q = new URLSearchParams();
    if (opts?.after != null) q.set("after", String(opts.after));
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.grep) q.set("grep", opts.grep);
    if (opts?.level?.length) q.set("level", opts.level.join(","));
    return this.call<ConsoleLine[]>(`/api/v1/console?${q}`);
  }

  async execCommand(command: string): Promise<{ ok: boolean; output: string[] }> {
    return this.call("/api/v1/command", { method: "POST", body: JSON.stringify({ command }) });
  }

  async broadcast(message: string): Promise<{ ok: boolean }> {
    return this.call("/api/v1/broadcast", { method: "POST", body: JSON.stringify({ message }) });
  }

  async startServer(): Promise<{ ok: boolean; message?: string }> {
    return this.call("/api/v1/power", { method: "POST", body: JSON.stringify({ action: "start" }) });
  }
  async stopServer(force = false): Promise<{ ok: boolean; message?: string }> {
    return this.call("/api/v1/power", { method: "POST", body: JSON.stringify({ action: "stop", force }) });
  }
  async restartServer(): Promise<{ ok: boolean; message?: string }> {
    return this.call("/api/v1/power", { method: "POST", body: JSON.stringify({ action: "restart" }) });
  }

  async listFiles(dir: string): Promise<FileEntry[]> {
    return this.call(`/api/v1/files?dir=${encodeURIComponent(dir)}`);
  }
  async readFile(path: string, limitBytes = 512 * 1024): Promise<FileContent> {
    return this.call(`/api/v1/files/content?path=${encodeURIComponent(path)}&limit=${limitBytes}`);
  }
  async writeFile(path: string, content: string): Promise<{ ok: boolean }> {
    return this.call("/api/v1/files/content", { method: "PUT", body: JSON.stringify({ path, content }) });
  }
  async createFile(path: string, content = ""): Promise<{ ok: boolean }> {
    return this.call("/api/v1/files", { method: "POST", body: JSON.stringify({ path, content }) });
  }
  async deleteFile(path: string): Promise<{ ok: boolean }> {
    return this.call("/api/v1/files", { method: "DELETE", body: JSON.stringify({ path }) });
  }
  async mkdir(path: string): Promise<{ ok: boolean }> {
    return this.call("/api/v1/files/mkdir", { method: "POST", body: JSON.stringify({ path }) });
  }
  async renameFile(from: string, to: string): Promise<{ ok: boolean }> {
    return this.call("/api/v1/files/rename", { method: "POST", body: JSON.stringify({ from, to }) });
  }
  async searchFiles(dir: string, pattern: string): Promise<{ path: string; line: number; text: string }[]> {
    return this.call(`/api/v1/files/search?dir=${encodeURIComponent(dir)}&q=${encodeURIComponent(pattern)}`);
  }

  async listPlugins(): Promise<PluginInfo[]> {
    return this.call("/api/v1/plugins");
  }

  async fetchPlayerStats(): Promise<BridgePlayerStats[]> {
    return this.call("/api/v1/players/stats");
  }

  capabilityReport() {
    return {
      status: { available: true },
      metrics: { available: true },
      console: { available: true },
      commands: { available: true },
      power: { available: true },
      files: { available: true },
      plugins: { available: true },
      playerStats: { available: true },
    };
  }
}

export function constantTimeTokenEqual(a: string, b: string): boolean {
  const ab = crypto.createHash("sha256").update(a).digest();
  const bb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ab, bb);
}
