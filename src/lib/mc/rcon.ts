// Minimal RCON client (Source RCON protocol). Used ONLY as a fallback behind
// the bridge adapter. RCON must never be exposed publicly — bind it to
// localhost or a VPN and restrict with a firewall. Credentials live in env.

import net from "node:net";

const SERVERDATA_AUTH = 3;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_RESPONSE_VALUE = 0;

type RconOptions = { host: string; port: number; password: string; timeoutMs?: number };

type RconPacket = { id: number; type: number; body: string };

function buildPacket(id: number, type: number, body: string): Buffer {
  const bodyBuf = Buffer.from(body, "ascii");
  const size = 4 + 4 + bodyBuf.length + 2;
  const buf = Buffer.alloc(4 + size);
  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf.writeInt8(0, 12 + bodyBuf.length);
  buf.writeInt8(0, 13 + bodyBuf.length);
  return buf;
}

function readPacket(buf: Buffer, offset: number): { packet: RconPacket; next: number } | null {
  if (buf.length < offset + 4) return null;
  const size = buf.readInt32LE(offset);
  if (buf.length < offset + 4 + size) return null;
  const id = buf.readInt32LE(offset + 4);
  const type = buf.readInt32LE(offset + 8);
  const body = buf.subarray(offset + 12, offset + 4 + size - 2).toString("ascii");
  return { packet: { id, type, body }, next: offset + 4 + size };
}

export class RconClient {
  private socket: net.Socket | null = null;
  private pending: ((p: RconPacket) => void)[] = [];
  private buffer = Buffer.alloc(0);
  private nextId = 1;

  constructor(private opts: RconOptions) {}

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket) return resolve();
      const socket = net.createConnection({ host: this.opts.host, port: this.opts.port }, () => {
        this.socket = socket;
        resolve();
      });
      socket.setTimeout(this.opts.timeoutMs ?? 5000);
      socket.on("data", (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.drain();
      });
      socket.on("error", (err) => {
        this.socket = null;
        reject(err);
      });
      socket.on("close", () => {
        this.socket = null;
      });
      socket.on("timeout", () => {
        socket.destroy();
        this.socket = null;
        reject(new Error("RCON timeout"));
      });
    });
  }

  private drain() {
    let offset = 0;
    while (true) {
      const res = readPacket(this.buffer, offset);
      if (!res) break;
      offset = res.next;
      const resolver = this.pending.shift();
      if (resolver) resolver(res.packet);
    }
    this.buffer = this.buffer.subarray(offset);
  }

  private send(type: number, body: string): Promise<RconPacket> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error("not connected"));
      const id = this.nextId++;
      const timer = setTimeout(() => reject(new Error("RCON response timeout")), this.opts.timeoutMs ?? 5000);
      this.pending.push((pkt) => {
        clearTimeout(timer);
        resolve(pkt);
      });
      this.socket.write(buildPacket(id, type, body));
    });
  }

  async login(): Promise<void> {
    await this.connect();
    const res = await this.send(SERVERDATA_AUTH, this.opts.password);
    if (res.id === -1) throw new Error("RCON authentication failed");
  }

  async command(cmd: string): Promise<string> {
    await this.send(SERVERDATA_EXECCOMMAND, cmd);
    const res = await this.send(SERVERDATA_EXECCOMMAND, "");
    return res.body;
  }

  destroy() {
    this.socket?.destroy();
    this.socket = null;
  }
}
