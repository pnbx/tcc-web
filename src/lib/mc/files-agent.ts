// File backend selection for the developer panel.
//
//   1. The bridge agent inside the game server (works from anywhere, including
//      Vercel — the host that cannot reach the panel or the server's disk).
//   2. The local sandbox (when this app runs on the same machine as the server,
//      i.e. SERVER_FILES_ROOT is set).
//
// The sensitive-file policy lives here (server-side) so it applies to both
// backends identically.

import * as sandbox from "./files";
import type { FileContent, FileEntry } from "./types";
import { agentListFiles, agentReadFile, agentSearch, agentSimple, agentRename, agentWriteFile } from "./agent";

export { FileSandboxError, getRoot, isSensitive, sanitizeRelPath, sensitiveAllowed } from "./files";

function agentMayRead(rel: string): boolean {
  return !(sandbox.isSensitive(rel) && !sandbox.sensitiveAllowed());
}

export async function listDir(relDir: string): Promise<FileEntry[]> {
  const rel = sandbox.sanitizeRelPath(relDir);
  const viaAgent = await agentListFiles(rel);
  if (viaAgent) return viaAgent;
  return sandbox.listDir(relDir);
}

export async function readFile(relPath: string, limitBytes?: number): Promise<FileContent> {
  const rel = sandbox.sanitizeRelPath(relPath);
  if (agentMayRead(rel)) {
    const viaAgent = await agentReadFile(rel, limitBytes);
    if (viaAgent) return viaAgent;
  }
  return sandbox.readFile(relPath, limitBytes);
}

export async function writeFile(relPath: string, content: string): Promise<void> {
  const rel = sandbox.sanitizeRelPath(relPath);
  if (!agentMayRead(rel)) {
    // let the local sandbox produce the standard "protected file" error
    return sandbox.writeFile(relPath, content);
  }
  const viaAgent = await agentWriteFile(rel, content);
  if (viaAgent !== null) return;
  return sandbox.writeFile(relPath, content);
}

export async function createFile(relPath: string, content = ""): Promise<void> {
  const rel = sandbox.sanitizeRelPath(relPath);
  if (!agentMayRead(rel)) return sandbox.createFile(relPath, content);
  const viaAgent = await agentWriteFile(rel, content, true);
  if (viaAgent !== null) return;
  return sandbox.createFile(relPath, content);
}

export async function deletePath(relPath: string): Promise<void> {
  const rel = sandbox.sanitizeRelPath(relPath);
  if (rel === "") throw new sandbox.FileSandboxError("Refusing to delete the server root", 403);
  const viaAgent = await agentSimple("file.delete", rel);
  if (viaAgent !== null) return;
  return sandbox.deletePath(relPath);
}

export async function mkdir(relPath: string): Promise<void> {
  const rel = sandbox.sanitizeRelPath(relPath);
  const viaAgent = await agentSimple("file.mkdir", rel);
  if (viaAgent !== null) return;
  return sandbox.mkdir(relPath);
}

export async function renamePath(from: string, to: string): Promise<void> {
  const relFrom = sandbox.sanitizeRelPath(from);
  const relTo = sandbox.sanitizeRelPath(to);
  const viaAgent = await agentRename(relFrom, relTo);
  if (viaAgent !== null) return;
  return sandbox.renamePath(from, to);
}

export async function searchInDir(relDir: string, pattern: string, opts?: { maxResults?: number; glob?: string }) {
  const rel = sandbox.sanitizeRelPath(relDir);
  const viaAgent = await agentSearch(rel, pattern);
  if (viaAgent) return viaAgent;
  return sandbox.searchInDir(relDir, pattern, opts);
}
