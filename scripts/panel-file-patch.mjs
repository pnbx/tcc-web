// Targeted, reversible edits on a Pterodactyl-hosted server over the client API.
//
// Usage: node scripts/panel-file-patch.mjs <serverId> <apiKey> <patches.json>
//
// patches.json = [{ "file": "/config/paper-global.yml", "find": "old", "replace": "new" }]
//
// For every patch it: reads the file, saves a timestamped .bak copy next to it,
// writes the patched content, then re-reads the file to confirm the change.
// Nothing is written unless the "find" string is present exactly once.

import fs from "node:fs/promises";

const [serverId, key, patchPath] = process.argv.slice(2);
if (!serverId || !key || !patchPath) {
  console.log("usage: node scripts/panel-file-patch.mjs <serverId> <apiKey> <patches.json>");
  process.exit(1);
}

const base = process.env.PANEL_URL || "https://panel.pufferland.ir";
const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" };
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const patches = JSON.parse(await fs.readFile(patchPath, "utf8"));

function fileUrl(path) {
  return `${base}/api/client/servers/${serverId}/files/contents?file=${encodeURIComponent(path)}`;
}
function writeUrl(path) {
  return `${base}/api/client/servers/${serverId}/files/write?file=${encodeURIComponent(path)}`;
}

for (const patch of patches) {
  const read = await fetch(fileUrl(patch.file), { headers });
  if (!read.ok) {
    console.log(`FAIL  read ${patch.file}: HTTP ${read.status}`);
    continue;
  }
  const original = await read.text();
  const hits = original.split(patch.find).length - 1;
  if (hits !== 1) {
    console.log(`SKIP  ${patch.file}: pattern found ${hits} time(s), expected exactly 1`);
    continue;
  }

  const backup = `${patch.file}.bak-${stamp}`;
  let res = await fetch(writeUrl(backup), { method: "POST", headers, body: original });
  console.log(`${res.ok ? "ok  " : "FAIL"}  backup ${backup} (HTTP ${res.status})`);

  res = await fetch(writeUrl(patch.file), { method: "POST", headers, body: original.replace(patch.find, patch.replace) });
  console.log(`${res.ok ? "ok  " : "FAIL"}  write  ${patch.file} (HTTP ${res.status})`);

  const after = await fetch(fileUrl(patch.file), { headers }).then((r) => r.text());
  console.log(`      verify: ${after.includes(patch.replace) ? "change is live" : "NOT APPLIED"}`);
}
