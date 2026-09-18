// Sandboxed file access for the developer panel.
//
// Hard rules:
//  - All paths resolve inside SERVER_FILES_ROOT (or the bridge's root).
//  - "..", absolute paths, symlinks escaping the root: rejected.
//  - Sensitive files (credentials, keys, env) are masked unless
//    FILES_ALLOW_SENSITIVE=1 is explicitly set by the operator.
//  - Every mutating call is audited by the calling route.

import fs from "node:fs/promises";
import path from "node:path";
import type { FileContent, FileEntry } from "./types";

const SENSITIVE_PATTERNS = [
  /(^|\/)\.env/i,
  /(^|\/)\.env\./i,
  /credentials?\.(json|yml|yaml|txt)$/i,
  /password/i,
  /secret/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /token/i,
  /whitelist\.json$/i,
  /ops\.json$/i,
  /usercache\.json$/i,
];

export class FileSandboxError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function sanitizeRelPath(input: string): string {
  const cleaned = input.replace(/\\/g, "/").trim();
  if (cleaned.includes("\0")) throw new FileSandboxError("Invalid path");
  const abs = path.posix.normalize(cleaned.startsWith("/") ? cleaned.slice(1) : cleaned);
  if (abs.startsWith("..") || abs.includes("../") || abs === "..") {
    throw new FileSandboxError("Path traversal is not allowed", 403);
  }
  if (/^[a-zA-Z]:/.test(cleaned)) throw new FileSandboxError("Absolute drives are not allowed", 403);
  return abs;
}

export function isSensitive(relPath: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(relPath));
}

export function sensitiveAllowed(): boolean {
  return process.env.FILES_ALLOW_SENSITIVE === "1";
}

export function getRoot(): string {
  const root = process.env.SERVER_FILES_ROOT;
  if (!root) throw new FileSandboxError("SERVER_FILES_ROOT is not configured", 503);
  return path.resolve(root);
}

async function resolveSafe(relPath: string): Promise<{ rel: string; abs: string }> {
  const rel = sanitizeRelPath(relPath);
  const root = getRoot();
  const abs = path.resolve(root, rel);
  // Defense in depth: re-verify the resolved path stayed inside the root
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) {
    throw new FileSandboxError("Path escapes the server sandbox", 403);
  }
  return { rel, abs };
}

const MAX_LIST_ENTRIES = 2000;

export async function listDir(relDir: string): Promise<FileEntry[]> {
  const { rel, abs } = await resolveSafe(relDir);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new FileSandboxError("Not a directory", 404);

  const entries = await fs.readdir(abs, { withFileTypes: true });
  const out: FileEntry[] = [];
  for (const e of entries.slice(0, MAX_LIST_ENTRIES)) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    let size: number | null = null;
    let modifiedAt: string | null = null;
    if (e.isFile()) {
      const st = await fs.stat(path.join(abs, e.name)).catch(() => null);
      size = st?.size ?? null;
      modifiedAt = st?.mtime.toISOString() ?? null;
    }
    out.push({
      name: e.name,
      path: childRel,
      type: e.isDirectory() ? "dir" : "file",
      size,
      modifiedAt,
    });
  }
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function readFile(relPath: string, limitBytes = 512 * 1024): Promise<FileContent> {
  const { rel, abs } = await resolveSafe(relPath);
  if (isSensitive(rel) && !sensitiveAllowed()) {
    throw new FileSandboxError(`This file is protected (sensitive). Set FILES_ALLOW_SENSITIVE=1 on the backend to override.`, 403);
  }
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isFile()) throw new FileSandboxError("Not a file", 404);
  if (stat.size > 20 * 1024 * 1024) throw new FileSandboxError("File too large to display", 413);

  const truncated = stat.size > limitBytes;
  const buf = await fs.readFile(abs).then((b) => b.subarray(0, limitBytes));
  // naive binary sniff: NUL byte in first 8KB
  const binary = buf.subarray(0, 8192).includes(0);
  return {
    path: rel,
    size: stat.size,
    truncated,
    encoding: binary ? "binary" : "utf8",
    content: binary ? buf.toString("base64") : buf.toString("utf8"),
  };
}

export async function writeFile(relPath: string, content: string): Promise<void> {
  const { rel, abs } = await resolveSafe(relPath);
  if (isSensitive(rel) && !sensitiveAllowed()) {
    throw new FileSandboxError("This file is protected (sensitive).", 403);
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

export async function createFile(relPath: string, content = ""): Promise<void> {
  const { abs } = await resolveSafe(relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, { flag: "wx" }).catch((err) => {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new FileSandboxError("File already exists", 409);
    throw err;
  });
}

export async function deletePath(relPath: string): Promise<void> {
  const { rel, abs } = await resolveSafe(relPath);
  if (rel === "" ) throw new FileSandboxError("Refusing to delete the sandbox root", 403);
  await fs.rm(abs, { recursive: true, force: false });
}

export async function mkdir(relPath: string): Promise<void> {
  const { abs } = await resolveSafe(relPath);
  await fs.mkdir(abs, { recursive: true });
}

export async function renamePath(from: string, to: string): Promise<void> {
  const src = await resolveSafe(from);
  const dst = await resolveSafe(to);
  await fs.rename(src.abs, dst.abs);
}

export async function searchInDir(
  relDir: string,
  pattern: string,
  opts: { maxResults?: number; glob?: string } = {},
): Promise<{ path: string; line: number; text: string }[]> {
  const { rel, abs } = await resolveSafe(relDir);
  const needle = pattern.toLowerCase();
  const maxResults = opts.maxResults ?? 200;
  const results: { path: string; line: number; text: string }[] = [];

  async function walk(dirAbs: string, dirRel: string, depth: number) {
    if (results.length >= maxResults || depth > 8) return;
    const entries = await fs.readdir(dirAbs, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (results.length >= maxResults) return;
      const childAbs = path.join(dirAbs, e.name);
      const childRel = dirRel ? `${dirRel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(childAbs, childRel, depth + 1);
      } else if (e.isFile() && e.name.endsWith(".log") || e.isFile() && /\.(txt|yml|yaml|json|properties|conf)$/.test(e.name)) {
        if (isSensitive(childRel) && !sensitiveAllowed()) continue;
        const stat = await fs.stat(childAbs).catch(() => null);
        if (!stat || stat.size > 50 * 1024 * 1024) continue;
        const text = await fs.readFile(childAbs, "utf8").catch(() => null);
        if (!text) continue;
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            results.push({ path: childRel, line: i + 1, text: lines[i].slice(0, 400) });
            if (results.length >= maxResults) return;
          }
        }
      }
    }
  }

  await walk(abs, rel, 0);
  return results;
}
