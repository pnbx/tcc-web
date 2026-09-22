// Minimal Minecraft login probe — no client, no auth needed.
//
// Usage: node scripts/mc-login-probe.mjs <host> <port> [username]
//
// What it proves:
//  - "login success"  → the server accepts DIRECT connections (raw / not proxied)
//  - "disconnect: ..." → the server refused us, and the JSON tells us why
//    (e.g. proxy forwarding required, whitelist, version mismatch)
//
// It only performs the handshake + login start and then disconnects.

import net from "node:net";
import zlib from "node:zlib";

const HOST = process.argv[2];
const PORT = Number(process.argv[3] || 25565);
const NAME = (process.argv[4] || "RawProbe").slice(0, 16);
const PROTOCOL = 769; // 1.21.4

if (!HOST || !PORT) {
  console.log("usage: node scripts/mc-login-probe.mjs <host> <port> [username]");
  process.exit(1);
}

function varint(n) {
  const out = [];
  let v = n >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return Buffer.from(out);
}

function readVarint(buf, off) {
  let res = 0;
  let shift = 0;
  for (let c = 0; ; c++) {
    if (off + c >= buf.length) return null;
    const b = buf[off + c];
    res |= (b & 0x7f) << shift;
    if (!(b & 0x80)) return { value: res >>> 0, bytes: c + 1 };
    shift += 7;
    if (shift > 35) return null;
  }
}

function mcString(s) {
  const b = Buffer.from(s, "utf8");
  return Buffer.concat([varint(b.length), b]);
}

const socket = net.createConnection({ host: HOST, port: PORT });
let buffer = Buffer.alloc(0);
let compressed = false;
let done = false;

const timer = setTimeout(() => finish(2, "timeout (no answer from " + HOST + ":" + PORT + ")"), 9000);

function finish(code, message) {
  if (done) return;
  done = true;
  clearTimeout(timer);
  console.log("RESULT " + message);
  socket.destroy();
  process.exit(code);
}

function send(id, body) {
  const inner = Buffer.concat([varint(id), body]);
  if (!compressed) {
    socket.write(Buffer.concat([varint(inner.length), inner]));
    return;
  }
  // compression enabled: data-length 0 means "this packet is not compressed"
  socket.write(Buffer.concat([varint(1 + inner.length), varint(0), inner]));
}

socket.on("connect", () => {
  const address = Buffer.concat([mcString(HOST), Buffer.from([(PORT >> 8) & 0xff, PORT & 0xff])]);
  send(0x00, Buffer.concat([varint(PROTOCOL), address, varint(2)])); // handshake → login
  send(0x00, Buffer.concat([mcString(NAME), Buffer.alloc(16, 0x11)])); // login start
});

socket.on("error", (err) => finish(3, "error: " + err.message));

socket.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const len = readVarint(buffer, 0);
    if (!len) return;
    if (buffer.length < len.bytes + len.value) return;
    let body = buffer.subarray(len.bytes, len.bytes + len.value);
    buffer = buffer.subarray(len.bytes + len.value);

    if (compressed) {
      const dataLen = readVarint(body, 0);
      if (!dataLen) return;
      const rest = body.subarray(dataLen.bytes);
      try {
        body = dataLen.value > 0 ? zlib.inflateSync(rest) : rest;
      } catch {
        return finish(3, "error: bad compressed packet");
      }
    }

    const id = readVarint(body, 0);
    if (!id) return;
    const payload = body.subarray(id.bytes);

    if (id.value === 0x00) {
      const strLen = readVarint(payload, 0);
      const json = strLen ? payload.subarray(strLen.bytes, strLen.bytes + strLen.value).toString("utf8") : "";
      return finish(0, "disconnect: " + json);
    }
    if (id.value === 0x03) {
      compressed = true;
      console.log("   (server enabled compression)");
      continue;
    }
    if (id.value === 0x02) {
      console.log("RESULT login success — direct connection accepted");
      send(0x03, Buffer.alloc(0)); // login acknowledged
      setTimeout(() => finish(0, "ok (joined, then disconnected on purpose)"), 2000);
      return;
    }
    if (id.value === 0x04) {
      // login plugin request — the channel tells us who is asking
      const msgId = readVarint(payload, 0);
      const chanLen = msgId ? readVarint(payload, msgId.bytes) : null;
      const channel = chanLen
        ? payload.subarray(msgId.bytes + chanLen.bytes, msgId.bytes + chanLen.bytes + chanLen.value).toString("utf8")
        : "?";
      console.log("   login plugin request for channel: " + channel);
      continue;
    }
    console.log("   packet id " + id.value + " (" + payload.length + " bytes)");
  }
});
