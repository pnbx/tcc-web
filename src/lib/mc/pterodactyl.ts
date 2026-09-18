// Pterodactyl panel adapter — talks to the hosting panel's client API
// (ptlc_… key) instead of needing a plugin on the Minecraft server itself.
//
// Capabilities over HTTP: command dispatch (auto-rank after purchase),
// power controls, live metrics (CPU/RAM/disk/uptime/net), file manager and
// console lines read from logs/latest.log. The panel at hand has no
// /console or /logs HTTP routes, so the console is reconstructed from the
// log file. Player statistics still need the TCC bridge.

import { slpPing } from "./slp";
import type {
  MinecraftServerAdapter,
  ServerStatus,
  LiveMetrics,
  ConsoleLine,
  FileEntry,
  FileContent,
  PluginInfo,
} from "./types";

type PteroResources = {
  current_state: string | null;
  is_suspended?: boolean;
  resources?: {
    memory_bytes?: number;
    cpu_absolute?: number;
    disk_bytes?: number;
    uptime?: number;
    network_rx_bytes?: number;
    network_tx_bytes?: number;
  };
};

const CONSOLE_PARSE = /^\[(\d{2}:\d{2}:\d{2})(?:\d*)\] \[([^/\]]+)\/([A-Z]+)\]: ?(.*)$/;

function levelOf(raw: string): ConsoleLine["level"] {
  if (raw === "INFO" || raw === "WARN" || raw === "ERROR" || raw === "DEBUG") return raw;
  return "OTHER";
}

export class PterodactylAdapter implements MinecraftServerAdapter {
  readonly name = "pterodactyl";

  constructor(
    private readonly panelUrl: string,
    private readonly apiKey: string,
    private readonly serverId: string,
    private readonly fallbackStatus: () => Promise<ServerStatus>,
  ) {
    this.panelUrl = panelUrl.replace(/\/+$/, "");
  }

  private async api<T>(path: string, init?: RequestInit & { raw?: boolean }): Promise<{ status: number; json: T | null; text: string }> {
    const res = await fetch(`${this.panelUrl}/api/client/servers/${this.serverId}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    const json = init?.raw ? null : (text ? JSON.parse(text) as T : null);
    return { status: res.status, json, text };
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async getStatus(): Promise<ServerStatus> {
    const slp = await this.fallbackStatus();
    if (slp.online) return slp;
    // SLP can fail through proxies/some hosts; the panel knows the real state.
    try {
      const { json } = await this.api<{ attributes: PteroResources }>("/resources");
      if (json?.attributes?.current_state === "running") {
        return { ...slp, online: true, playersOnline: null, playersMax: null, error: "status via panel (SLP unreachable)" };
      }
    } catch {
      // fall through to the truthful SLP result
    }
    return slp;
  }

  async getMetrics(): Promise<LiveMetrics | null> {
    try {
      const { json } = await this.api<{ attributes: PteroResources }>("/resources");
      if (!json?.attributes) return null;
      const r = json.attributes.resources ?? {};
      const s = await this.fallbackStatus();
      return {
        collectedAt: new Date().toISOString(),
        playersOnline: s.playersOnline,
        playersMax: s.playersMax,
        tps: null, // needs the bridge plugin (or Spark command parsing)
        mspt: null,
        cpuPercent: r.cpu_absolute ?? null,
        memoryUsedMb: r.memory_bytes != null ? Math.round(r.memory_bytes / 1048576) : null,
        memoryMaxMb: null,
        diskUsedGb: r.disk_bytes != null ? +(r.disk_bytes / 1073741824).toFixed(2) : null,
        diskTotalGb: null,
        netRxKbps: this.netKbps("rx", r.network_rx_bytes),
        netTxKbps: this.netKbps("tx", r.network_tx_bytes),
        uptimeSec: r.uptime != null ? Math.floor(r.uptime / 1000) : null,
        source: "pterodactyl",
      };
    } catch {
      return null;
    }
  }

  // Panel counters are cumulative bytes; rate = delta / elapsed between samples.
  private lastNet: Record<"rx" | "tx", { bytes: number; at: number } | null> = { rx: null, tx: null };
  private netKbps(dir: "rx" | "tx", cumulativeBytes?: number): number | null {
    if (cumulativeBytes == null) return null;
    const now = Date.now();
    const prev = this.lastNet[dir];
    this.lastNet[dir] = { bytes: cumulativeBytes, at: now };
    if (!prev || now <= prev.at || cumulativeBytes < prev.bytes) return null;
    return +(((cumulativeBytes - prev.bytes) / ((now - prev.at) / 1000)) / 128).toFixed(1); // B/s → kbps
  }

  // ── Console (reconstructed from logs/latest.log) ──────────────────────────

  private logCache: { at: number; content: string } | null = null;

  private async latestLog(): Promise<string> {
    if (this.logCache && Date.now() - this.logCache.at < 3000) return this.logCache.content;
    const { text } = await this.api<unknown>(`/files/contents?file=${encodeURIComponent("/logs/latest.log")}`, { raw: true });
    this.logCache = { at: Date.now(), content: text };
    return text;
  }

  async getConsoleLines(opts?: { after?: number; limit?: number; grep?: string; level?: string[] }): Promise<ConsoleLine[]> {
    const content = await this.latestLog();
    const today = new Date();
    const lines = content.split(/\r?\n/).filter(Boolean);
    const out: ConsoleLine[] = [];
    for (const line of lines) {
      const m = CONSOLE_PARSE.exec(line);
      const ts = m ? this.logTimeToEpoch(m[1], today) : Date.now();
      const entry: ConsoleLine = m
        ? { ts, level: levelOf(m[3]), thread: m[2], message: m[4] }
        : { ts, level: "OTHER", thread: "-", message: line };
      if (opts?.after && entry.ts <= opts.after) continue;
      if (opts?.grep && !entry.message.includes(opts.grep)) continue;
      if (opts?.level?.length && !opts.level.includes(entry.level)) continue;
      out.push(entry);
    }
    return opts?.limit ? out.slice(-opts.limit) : out;
  }

  private logTimeToEpoch(hhmmss: string, day: Date): number {
    const [h, m, s] = hhmmss.split(":").map(Number);
    const d = new Date(day);
    d.setHours(h, m, s, 0);
    return d.getTime();
  }

  // ── Commands & power ──────────────────────────────────────────────────────

  async execCommand(command: string): Promise<{ ok: boolean; output: string[] }> {
    const { status, json } = await this.api<{ errors?: { detail?: string }[] }>("/command", {
      method: "POST",
      body: JSON.stringify({ command }),
    });
    if (status === 204) return { ok: true, output: [] };
    const detail = json?.errors?.[0]?.detail ?? `panel HTTP ${status}`;
    return { ok: false, output: [detail] };
  }

  async broadcast(message: string): Promise<{ ok: boolean }> {
    return this.execCommand(`say ${message}`);
  }

  async startServer(): Promise<{ ok: boolean; message?: string }> {
    return this.power("start");
  }
  async stopServer(force = false): Promise<{ ok: boolean; message?: string }> {
    return this.power(force ? "kill" : "stop");
  }
  async restartServer(): Promise<{ ok: boolean; message?: string }> {
    return this.power("restart");
  }

  private async power(signal: "start" | "stop" | "kill" | "restart"): Promise<{ ok: boolean; message?: string }> {
    const { status, json } = await this.api<{ errors?: { detail?: string }[] }>("/power", {
      method: "POST",
      body: JSON.stringify({ signal }),
    });
    if (status === 204) return { ok: true };
    return { ok: false, message: json?.errors?.[0]?.detail ?? `panel HTTP ${status}` };
  }

  // ── Files (server root is the sandbox) ────────────────────────────────────

  async listFiles(dir: string): Promise<FileEntry[]> {
    const { json } = await this.api<{ data: { attributes: { name: string; size: number; is_file: boolean; is_symlink: boolean; modified_at: string | null } }[] }>(
      `/files/list?directory=${encodeURIComponent(dir)}`,
    );
    if (!json?.data) return [];
    return json.data.map(({ attributes: a }) => ({
      name: a.name,
      path: `${dir === "/" ? "" : dir}/${a.name}`,
      type: a.is_file ? ("file" as const) : ("dir" as const),
      size: a.is_file ? a.size : null,
      modifiedAt: a.modified_at,
    }));
  }

  async readFile(path: string, limitBytes = 512 * 1024): Promise<FileContent> {
    const { status, text } = await this.api<unknown>(
      `/files/contents?file=${encodeURIComponent(path)}`,
      { raw: true },
    );
    if (status === 200) {
      const buf = Buffer.from(text, "utf8");
      const truncated = buf.byteLength > limitBytes;
      return {
        path,
        size: buf.byteLength,
        truncated,
        encoding: "utf8",
        content: truncated ? buf.subarray(0, limitBytes).toString("utf8") : text,
      };
    }
    // Binary files: the panel refuses text contents — fall back to a signed URL.
    const { json } = await this.api<{ attributes: { url: string } }>(`/files/download?file=${encodeURIComponent(path)}`);
    const url = json?.attributes?.url;
    if (!url) throw new Error(`فایل قابل خواندن نیست (HTTP ${status})`);
    const bin = await (await fetch(url, { cache: "no-store" })).arrayBuffer();
    const buf = Buffer.from(bin);
    const truncated = buf.byteLength > limitBytes;
    return {
      path,
      size: buf.byteLength,
      truncated,
      encoding: "binary",
      content: buf.subarray(0, limitBytes).toString("base64"),
    };
  }

  async writeFile(path: string, content: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${this.panelUrl}/api/client/servers/${this.serverId}/files/write`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ file: path, raw: content }),
    });
    if (res.status === 204) return { ok: true };
    const body = (await res.json().catch(() => null)) as { errors?: { detail?: string }[] } | null;
    throw new Error(body?.errors?.[0]?.detail ?? `panel HTTP ${res.status}`);
  }

  async createFile(path: string, content = ""): Promise<{ ok: boolean }> {
    return this.writeFile(path, content);
  }

  async mkdir(path: string): Promise<{ ok: boolean }> {
    const root = path.replace(/\/[^/]+$/, "") || "/";
    const name = path.split("/").pop()!;
    const { status, json } = await this.api<{ errors?: { detail?: string }[] }>("/files/create-folder", {
      method: "POST",
      body: JSON.stringify({ root, name }),
    });
    if (status === 204) return { ok: true };
    throw new Error((json as { errors?: { detail?: string }[] } | null)?.errors?.[0]?.detail ?? `panel HTTP ${status}`);
  }

  async renameFile(from: string, to: string): Promise<{ ok: boolean }> {
    const root = from.replace(/\/[^/]+$/, "") || "/";
    const { status, json } = await this.api<{ errors?: { detail?: string }[] }>("/files/rename", {
      method: "POST",
      body: JSON.stringify({ root, files: [{ from: from.split("/").pop()!, to: to.split("/").pop()! }] }),
    });
    if (status === 204) return { ok: true };
    throw new Error((json as { errors?: { detail?: string }[] } | null)?.errors?.[0]?.detail ?? `panel HTTP ${status}`);
  }

  async deleteFile(path: string): Promise<{ ok: boolean }> {
    const root = path.replace(/\/[^/]+$/, "") || "/";
    const { status, json } = await this.api<{ errors?: { detail?: string }[] }>("/files/delete", {
      method: "POST",
      body: JSON.stringify({ root, files: [path.split("/").pop()!] }),
    });
    if (status === 204) return { ok: true };
    throw new Error((json as { errors?: { detail?: string }[] } | null)?.errors?.[0]?.detail ?? `panel HTTP ${status}`);
  }

  async searchFiles(): Promise<{ path: string; line: number; text: string }[]> {
    throw new Error("جست‌وجوی فایل روی پنل پتروداکتیل موجود نیست — فقط bridge این قابلیت را دارد.");
  }

  // ── Plugins & stats ───────────────────────────────────────────────────────

  async listPlugins(): Promise<PluginInfo[]> {
    // No panel API for plugins — derive a listing from the /plugins directory.
    try {
      const files = await this.listFiles("/plugins");
      return files
        .filter((f) => f.type === "file" && f.name.endsWith(".jar"))
        .map((f) => {
          const m = /^(.+?)-([\d][\w.+-]*?)\.jar$/.exec(f.name);
          return {
            name: m ? m[1] : f.name.replace(/\.jar$/, ""),
            version: m?.[2] ?? null,
            enabled: true,
            website: null,
            authors: [],
          };
        });
    } catch {
      return [];
    }
  }

  async fetchPlayerStats(): Promise<never[]> {
    return []; // requires the TCC bridge sync
  }

  capabilityReport() {
    return {
      status: { available: true },
      metrics: { available: true, reason: "TPS/MSPT فقط با پلاگین bridge در دسترس است." },
      console: { available: true, reason: "بازسازی‌شده از logs/latest.log (چند ثانیه تأخیر)." },
      commands: { available: true },
      power: { available: true },
      files: { available: true },
      plugins: { available: true, reason: "بر اساس فایل‌های پوشه plugins؛ وضعیت واقعی نیاز به bridge دارد." },
      playerStats: { available: false, reason: "نیاز به پلاگین TCC bridge." },
    };
  }
}
