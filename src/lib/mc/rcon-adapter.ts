// RCON fallback adapter — implements only what RCON can honestly provide.
// File browsing, metrics and plugins are reported as unavailable rather than
// faked. Requires RCON bound to localhost/VPN; see .env.example.

import { RconClient } from "./rcon";
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

const NA = { available: false, reason: "Not available over RCON — deploy the TCC bridge plugin for this capability." };

export class RconAdapter implements MinecraftServerAdapter {
  readonly name = "rcon";
  private client: RconClient | null = null;
  private statusFallback: () => Promise<ServerStatus>;

  constructor(
    private host: string,
    private port: number,
    private password: string,
    statusFallback: () => Promise<ServerStatus>,
  ) {
    if (!password) throw new Error("RCON_PASSWORD is required for RconAdapter");
    this.statusFallback = statusFallback;
  }

  private async withClient<T>(fn: (c: RconClient) => Promise<T>): Promise<T> {
    if (!this.client) {
      this.client = new RconClient({ host: this.host, port: this.port, password: this.password });
      await this.client.login();
    }
    try {
      return await fn(this.client);
    } catch (err) {
      this.client.destroy();
      this.client = null;
      throw err;
    }
  }

  async getStatus(): Promise<ServerStatus> {
    return this.statusFallback();
  }

  async getMetrics(): Promise<LiveMetrics | null> {
    // RCON gives no CPU/RAM/disk/net. We refuse to invent them.
    try {
      const out = await this.withClient((c) => c.command("list"));
      const m = /There are (\d+) of a max of (\d+) players online/.exec(out);
      return {
        collectedAt: new Date().toISOString(),
        playersOnline: m ? Number(m[1]) : null,
        playersMax: m ? Number(m[2]) : null,
        tps: null,
        mspt: null,
        cpuPercent: null,
        memoryUsedMb: null,
        memoryMaxMb: null,
        diskUsedGb: null,
        diskTotalGb: null,
        netRxKbps: null,
        netTxKbps: null,
        uptimeSec: null,
        source: "rcon",
      };
    } catch {
      return null;
    }
  }

  async getConsoleLines(): Promise<ConsoleLine[]> {
    // RCON cannot read the log file; the bridge plugin is required.
    return [];
  }

  async execCommand(command: string): Promise<{ ok: boolean; output: string[] }> {
    try {
      const out = await this.withClient((c) => c.command(command));
      return { ok: true, output: out ? out.split("\n") : [] };
    } catch (err) {
      return { ok: false, output: [(err as Error).message] };
    }
  }

  async broadcast(message: string): Promise<{ ok: boolean }> {
    const r = await this.execCommand(`say ${message}`);
    return { ok: r.ok };
  }

  async startServer() {
    return { ok: false, message: "Power control requires the TCC bridge or a process supervisor integration." };
  }
  async stopServer() {
    return { ok: false, message: "Use `stop` over the console with the bridge deployed." };
  }
  async restartServer() {
    return { ok: false, message: "Power control requires the TCC bridge or a process supervisor integration." };
  }

  async listFiles(): Promise<FileEntry[]> {
    throw new Error(NA.reason);
  }
  async readFile(): Promise<FileContent> {
    throw new Error(NA.reason);
  }
  async writeFile(): Promise<{ ok: boolean }> {
    throw new Error(NA.reason);
  }
  async createFile(): Promise<{ ok: boolean }> {
    throw new Error(NA.reason);
  }
  async deleteFile(): Promise<{ ok: boolean }> {
    throw new Error(NA.reason);
  }
  async mkdir(): Promise<{ ok: boolean }> {
    throw new Error(NA.reason);
  }
  async renameFile(): Promise<{ ok: boolean }> {
    throw new Error(NA.reason);
  }
  async searchFiles(): Promise<{ path: string; line: number; text: string }[]> {
    throw new Error(NA.reason);
  }

  async listPlugins(): Promise<PluginInfo[]> {
    return [];
  }

  async fetchPlayerStats(): Promise<BridgePlayerStats[]> {
    return [];
  }

  capabilityReport() {
    return {
      status: { available: true },
      metrics: { available: true, reason: "Player counts only; TPS/CPU/RAM require the bridge." },
      console: NA,
      commands: { available: true },
      power: NA,
      files: NA,
      plugins: { available: false, reason: "Requires the bridge plugin." },
      playerStats: NA,
    };
  }
}
