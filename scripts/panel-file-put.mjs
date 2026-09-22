// Upload/replace a file on a Pterodactyl server over the client API.
//
// Usage: node scripts/panel-file-put.mjs <serverId> <apiKey> <localPath> <remotePath>
//
// Saves a timestamped .bak copy of the remote file first, then uploads the new
// content (raw body + ?file= query — this panel writes JSON envelopes verbatim).

import fs from "node:fs/promises";
import path from "node:path";

const [serverId, key, localPath, remotePath] = process.argv.slice(2);
if (!serverId || !key || !localPath || !remotePath) {
  console.log("usage: node scripts/panel-file-put.mjs <serverId> <apiKey> <localPath> <remotePath>");
  process.exit(1);
}

const base = process.env.PANEL_URL || "https://panel.pufferland.ir";
const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
// Git Bash rewrites a leading "/" argument into a Windows path, so always send
// a path relative to the server root.
const remote = remotePath.replace(/^\/+/, "");

const fileUrl = (p) => `${base}/api/client/servers/${serverId}/files/contents?file=${encodeURIComponent(p)}`;
const writeUrl = (p) => `${base}/api/client/servers/${serverId}/files/write?file=${encodeURIComponent(p)}`;

const content = await fs.readFile(localPath, "utf8");
console.log(`uploading ${path.basename(localPath)} (${content.length} bytes) -> ${remotePath}`);

const existing = await fetch(fileUrl(remotePath), { headers });
if (existing.ok) {
  const old = await existing.text();
  const backup = `${remotePath}.bak-${stamp}`;
  const res = await fetch(writeUrl(backup), { method: "POST", headers, body: old });
  console.log(`backup ${backup} (${old.length} bytes) HTTP ${res.status}`);
} else {
  console.log(`no existing remote file (HTTP ${existing.status}) — nothing to back up`);
}

const put = await fetch(writeUrl(remotePath), { method: "POST", headers, body: content });
console.log(`write HTTP ${put.status}`);

const after = await fetch(fileUrl(remotePath), { headers }).then((r) => r.text());
console.log(`verify: remote is ${after.length} bytes — ${after.length === content.length ? "MATCH" : "MISMATCH"}`);
