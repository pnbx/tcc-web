import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";
import * as sandbox from "@/lib/mc/files-agent";

export const dynamic = "force-dynamic";

// GET /api/files?dir=plugins  → list directory (files.view)
export async function GET(req: NextRequest) {
  try {
    await requirePermission("files.view");
    const url = new URL(req.url);
    const dir = url.searchParams.get("dir") ?? "";
    const q = url.searchParams.get("q");

    if (q) {
      const results = await sandbox.searchInDir(dir, q);
      return jsonOk({ search: results });
    }
    const entries = await sandbox.listDir(dir);
    return jsonOk({ dir, entries });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.union([
  z.object({ op: z.literal("create"), path: z.string().min(1).max(400), content: z.string().max(2_000_000).optional() }),
  z.object({ op: z.literal("mkdir"), path: z.string().min(1).max(400) }),
  z.object({ op: z.literal("rename"), from: z.string().min(1).max(400), to: z.string().min(1).max(400) }),
  z.object({ op: z.literal("delete"), path: z.string().min(1).max(400) }),
]);

// POST /api/files — create/mkdir/rename/delete depending on op
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req, createSchema);

    const audited = async (action: string, target: string, fn: () => Promise<void>) => {
      const auth = await requirePermission(mapOpToPerm(action));
      await fn();
      await audit({
        actorId: auth.user.id,
        actorName: auth.user.username,
        action,
        target,
        ip: req.headers.get("x-forwarded-for"),
      });
      return jsonOk({ ok: true });
    };

    switch (body.op) {
      case "create":
        return await audited("files.create", body.path, () => sandbox.createFile(body.path, body.content ?? ""));
      case "mkdir":
        return await audited("files.create", body.path, () => sandbox.mkdir(body.path));
      case "rename":
        return await audited("files.edit", `${body.from} → ${body.to}`, () => sandbox.renamePath(body.from, body.to));
      case "delete":
        return await audited("files.delete", body.path, () => sandbox.deletePath(body.path));
    }
  } catch (err) {
    return handleApiError(err);
  }
}

function mapOpToPerm(op: string): string {
  switch (op) {
    case "create":
    case "mkdir":
      return "files.create";
    case "rename":
      return "files.edit";
    case "delete":
      return "files.delete";
    default:
      return "files.view";
  }
}

// Keep unused import from failing lint in special configs
void jsonError;
