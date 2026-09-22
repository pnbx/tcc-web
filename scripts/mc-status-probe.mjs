// Server List Ping from the terminal — real public status, no credentials.
//
// Usage: node scripts/mc-status-probe.mjs <host> <port>

import net from "node:net";

const HOST = process.argv[2];
const PORT = Number(process.argv[3] || 25565);

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

const hostBuf = Buffer.from(HOST, "utf8");
const address = Buffer.concat([varint(hostBuf.length), hostBuf, Buffer.from([(PORT >> 8) & 0xff, PORT & 0xff])]);
const handshake = Buffer.concat([varint(0x00), varint(0xff & 1 ? 0 : 0), address, varint(1)]);
// protocol -1 (auto-detect) encoded as 5 bytes of 0xff..0x0f
const handshakeAuto = Buffer.concat([
  varint(0x00),
  Buffer.from([0xff, 0xff, 0xff, 0xff, 0x0f]),
  address,
  varint(1),
]);
void handshake;

const socket = net.createConnection({ host: HOST, port: PORT });
let buf = Buffer.alloc(0);
const started = Date.now();

const timer = setTimeout(() => {
  console.log("OFFLINE/timeout — no answer from " + HOST + ":" + PORT);
  socket.destroy();
  process.exit(2);
}, 6000);

socket.on("connect", () => {
  const frame = Buffer.concat([varint(handshakeAuto.length), handshakeAuto]);
  socket.write(frame);
  socket.write(Buffer.from([0x01, 0x00])); // status request
});

socket.on("error", (err) => {
  clearTimeout(timer);
  console.log("OFFLINE — " + err.message);
  process.exit(3);
});

socket.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  const len = readVarint(buf, 0);
  if (!len || buf.length < len.bytes + len.value) return;
  let off = len.bytes;
  const id = readVarint(buf, off);
  off += id.bytes;
  const strLen = readVarint(buf, off);
  off += strLen.bytes;
  const raw = buf.subarray(off, off + strLen.value).toString("utf8");
  clearTimeout(timer);
  try {
    const data = JSON.parse(raw);
    const desc = typeof data.description === "string" ? data.description : JSON.stringify(data.description);
    console.log(
      "ONLINE  " + HOST + ":" + PORT +
      " | players " + data.players?.online + "/" + data.players?.max +
      " | version " + data.version?.name +
      " | ping " + (Date.now() - started) + "ms\n        motd: " + desc.replace(/§./g, "").slice(0, 120),
    );
  } catch {
    console.log("ONLINE (unparsable status) " + raw.slice(0, 120));
  }
  socket.destroy();
  process.exit(0);
});
