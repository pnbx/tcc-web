// Server List Ping (SLP) client — reads the *actual* public status of
// tccmc.ir without any credentials. Works for vanilla/Paper/Spigot/Velocity/
// BungeeCord as long as the port accepts Minecraft protocol connections.

import net from "node:net";
import type { ServerStatus } from "./types";

const VARRINT_MAX_SHIFT = 63;

function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buf: Buffer, offset: number): { value: number; bytes: number } | null {
  let result = 0;
  let shift = 0;
  let count = 0;
  while (true) {
    if (offset + count >= buf.length || count >= 5) return null;
    const b = buf[offset + count];
    result |= (b & 0x7f) << shift;
    count += 1;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > VARRINT_MAX_SHIFT) return null;
  }
  return { value: result >>> 0, bytes: count };
}

type Packet = { id: number; body: Buffer };

function frame(id: number, body: Buffer): Buffer {
  const idBuf = writeVarInt(id);
  const len = idBuf.length + body.length;
  return Buffer.concat([writeVarInt(len), idBuf, body]);
}

function parseHandshake(host: string, port: number): Buffer {
  const hostBuf = Buffer.from(host, "utf8");
  const addr = Buffer.concat([writeVarInt(hostBuf.length), hostBuf, Buffer.from([port & 0xff, (port >> 8) & 0xff])]);
  // protocol version -1 (auto), then next state = 1 (status)
  return frame(0x00, Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0x0f]), addr, writeVarInt(1)]));
}

function stripMcCodes(s: string): string {
  // remove legacy § codes and modern JSON color remnants
  return s.replace(/§./g, "").replace(/[\u0000-\u001f]/g, "");
}

export type SlpResult = ServerStatus;

export function slpPing(host: string, port: number, timeoutMs = 4000): Promise<SlpResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const finish = (status: ServerStatus) => {
      socket?.destroy();
      resolve({ ...status, checkedAt: new Date().toISOString() });
    };

    const socket: net.Socket | null = net.createConnection({ host, port }, () => {
      socket!.write(parseHandshake(host, port));
      socket!.write(frame(0x00, Buffer.alloc(0))); // status request
    });

    socket.setTimeout(timeoutMs);
    let buffer = Buffer.alloc(0);

    const fail = (reason: string) =>
      finish({
        online: false,
        host,
        port,
        playersOnline: null,
        playersMax: null,
        version: null,
        latencyMs: null,
        motd: null,
        favicon: null,
        source: "slp",
        error: reason,
        checkedAt: new Date().toISOString(),
      });

    socket.on("timeout", () => fail("timeout"));
    socket.on("error", (err) => fail(err.message));
    socket.on("close", () => {
      /* resolved already or timed out */
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      // Wait for the full packet: first varint = total length
      const lenInfo = readVarInt(buffer, 0);
      if (!lenInfo) return;
      if (buffer.length < lenInfo.bytes + lenInfo.value) return;

      let offset = lenInfo.bytes;
      const pktId = readVarInt(buffer, offset);
      if (!pktId) return fail("bad packet");
      offset += pktId.bytes;

      const strLen = readVarInt(buffer, offset);
      if (!strLen) return fail("bad packet");
      offset += strLen.bytes;

      const jsonRaw = buffer.subarray(offset, offset + strLen.value).toString("utf8");
      const latency = Date.now() - started;

      // Respond to keepalive ping (0x01) if the server sent one — not required for status.
      try {
        const data = JSON.parse(jsonRaw);
        const players = data.players ?? {};
        const desc = data.description;
        let motdLines: string[] = [];
        if (typeof desc === "string") motdLines = [stripMcCodes(desc)];
        else if (desc && typeof desc === "object") {
          const collect = (node: { text?: string; extra?: unknown[] }): string => {
            let out = node.text ?? "";
            if (Array.isArray(node.extra)) for (const c of node.extra) out += collect(c as { text?: string; extra?: unknown[] });
            return out;
          };
          motdLines = [stripMcCodes(collect(desc as { text?: string; extra?: unknown[] }))];
        }

        finish({
          online: true,
          host,
          port,
          playersOnline: typeof players.online === "number" ? players.online : null,
          playersMax: typeof players.max === "number" ? players.max : null,
          version: typeof data.version?.name === "string" ? data.version.name : null,
          latencyMs: latency,
          motd: { clean: motdLines },
          favicon: typeof data.favicon === "string" ? data.favicon : null,
          source: "slp",
          checkedAt: new Date().toISOString(),
        });
      } catch (err) {
        fail(`bad status payload: ${(err as Error).message}`);
      }
    });
  });
}
