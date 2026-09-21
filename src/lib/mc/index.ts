// Adapter selection. Priority:
//   1. TCC bridge plugin (BRIDGE_URL + BRIDGE_TOKEN) — preferred
//   2. Pterodactyl panel (PTERO_PANEL_URL/API_KEY/SERVER_ID) — hosting panel API
//   3. RCON (RCON_HOST/PORT/PASSWORD) — must be firewalled
//   4. Status-only mode — the site still shows REAL public status via SLP
//
// Every consumer imports getMinecraft() from here; nothing else instantiates
// adapters directly.

import { slpPing } from "./slp";
import type { ServerStatus } from "./types";
import { BridgeAdapter } from "./bridge";
import { RconAdapter } from "./rcon-adapter";
import { PterodactylAdapter } from "./pterodactyl";
import type { MinecraftServerAdapter } from "./types";

export * from "./types";

export const MC_HOST = process.env.MINECRAFT_SERVER_HOST || "tccmc.ir";
export const MC_PORT = Number(process.env.MINECRAFT_SERVER_PORT || 25565);
// Player-facing connect address. The network runs behind a Velocity proxy on a
// non-default port, so the port must travel with the host everywhere players
// copy it or a launcher link is built.
export const MC_ADDRESS = MC_PORT === 25565 ? MC_HOST : `${MC_HOST}:${MC_PORT}`;

export async function publicStatus(): Promise<ServerStatus> {
  return slpPing(MC_HOST, MC_PORT);
}

type Holder = { adapter?: MinecraftServerAdapter };
const holder: Holder = {};

export function getMinecraft(): MinecraftServerAdapter {
  if (holder.adapter) return holder.adapter;

  const bridgeUrl = process.env.BRIDGE_URL;
  const bridgeToken = process.env.BRIDGE_TOKEN;
  if (bridgeUrl && bridgeToken) {
    holder.adapter = new BridgeAdapter(bridgeUrl, bridgeToken, publicStatus);
    return holder.adapter;
  }

  const pteroUrl = process.env.PTERO_PANEL_URL;
  const pteroKey = process.env.PTERO_API_KEY;
  const pteroServer = process.env.PTERO_SERVER_ID;
  if (pteroUrl && pteroKey && pteroServer) {
    holder.adapter = new PterodactylAdapter(pteroUrl, pteroKey, pteroServer, publicStatus);
    return holder.adapter;
  }

  const rconHost = process.env.RCON_HOST;
  const rconPort = Number(process.env.RCON_PORT || 25575);
  const rconPassword = process.env.RCON_PASSWORD;
  if (rconHost && rconPassword) {
    holder.adapter = new RconAdapter(rconHost, rconPort, rconPassword, publicStatus);
    return holder.adapter;
  }

  // Status-only fallback: truthful public status, honest "unavailable" for the rest.
  holder.adapter = createStatusOnlyAdapter();
  return holder.adapter;
}

function createStatusOnlyAdapter(): MinecraftServerAdapter {
  const na = (what: string) => ({
    available: false,
    reason: `Bridge/RCON not configured — ${what} is unavailable. Configure BRIDGE_URL/BRIDGE_TOKEN (preferred) or RCON_* in .env.`,
  });
  const thr = (what: string) => {
    throw new Error(na(what).reason);
  };

  return {
    name: "status-only",
    getStatus: publicStatus,
    getMetrics: async () => {
      const s = await publicStatus();
      return {
        collectedAt: new Date().toISOString(),
        playersOnline: s.playersOnline,
        playersMax: s.playersMax,
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
        source: "slp",
      };
    },
    getConsoleLines: async () => {
      throw new Error(na("console").reason);
    },
    execCommand: async () => thr("commands"),
    broadcast: async () => thr("broadcast"),
    startServer: async () => ({ ok: false, message: na("power control").reason }),
    stopServer: async () => ({ ok: false, message: na("power control").reason }),
    restartServer: async () => ({ ok: false, message: na("power control").reason }),
    listFiles: async () => thr("file access"),
    readFile: async () => thr("file access"),
    writeFile: async () => thr("file access"),
    createFile: async () => thr("file access"),
    deleteFile: async () => thr("file access"),
    mkdir: async () => thr("file access"),
    renameFile: async () => thr("file access"),
    searchFiles: async () => thr("file access"),
    listPlugins: async () => [],
    fetchPlayerStats: async () => [],
    capabilityReport: () => ({
      status: { available: true },
      metrics: { available: true, reason: "Player counts only; TPS/CPU/RAM require the bridge." },
      console: na("console"),
      commands: na("commands"),
      power: na("power control"),
      files: na("file access"),
      plugins: na("plugin listing"),
      playerStats: na("player statistics"),
    }),
  } satisfies MinecraftServerAdapter;
}

// ── Caching: the homepage should not SLP the server on every request ──

let statusCache: { at: number; status: ServerStatus } | null = null;
const STATUS_TTL_MS = 15_000;

export async function getCachedStatus(): Promise<ServerStatus> {
  const now = Date.now();
  if (statusCache && now - statusCache.at < STATUS_TTL_MS) return statusCache.status;
  const status = await getMinecraft().getStatus();
  statusCache = { at: now, status };
  return status;
}
