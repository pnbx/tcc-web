import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";
import * as sandbox from "@/lib/mc/files";

export const dynamic = "force-dynamic";

// GET /api/files/content?path=config/paper.yml&limit=262144
export async function GET(req: NextRequest) {
  try {
    await requirePermission("files.view");
    const url = new URL(req.url);
    const path = url.searchParams.get("path") ?? "";
    const limit = Math.min(2 * 1024 * 1024, Number(url.searchParams.get("limit") || 512 * 1024));
    const file = await sandbox.readFile(path, limit);
    return jsonOk({ file });
  } catch (err) {
    return handleApiError(err);
  }
}

const writeSchema = z.object({ path: z.string().min(1).max(400), content: z.string().max(4_000_000) });

// PUT /api/files/content — write file (files.edit)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission("files.edit");
    const { path, content } = await parseBody(req, writeSchema);
    await sandbox.writeFile(path, content);
    await audit({
      actorId: auth.user.id,
      actorName: auth.user.username,
      action: "files.edit",
      target: path,
      detail: { bytes: Buffer.byteLength(content) },
      ip: req.headers.get("x-forwarded-for"),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
