import { NextRequest } from "next/server";
import { z } from "zod";
import { getMinecraft } from "@/lib/mc";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/server/console?after=&grep=&level=INFO,ERROR
export async function GET(req: NextRequest) {
  try {
    await requirePermission("server.console");
    const url = new URL(req.url);
    const after = url.searchParams.get("after");
    const grep = url.searchParams.get("grep") ?? undefined;
    const level = url.searchParams.get("level")?.split(",").filter(Boolean);

    const lines = await getMinecraft().getConsoleLines({
      after: after ? Number(after) : undefined,
      limit: 500,
      grep: grep || undefined,
      level: level?.length ? level : undefined,
    });
    return jsonOk({ lines, serverTime: Date.now() });
  } catch (err) {
    return handleApiError(err);
  }
}

const cmdSchema = z.object({ command: z.string().min(1).max(500) });

// POST /api/server/console — execute a command (server.command)
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission("server.command");
    const { command } = await parseBody(req, cmdSchema);

    const result = await getMinecraft().execCommand(command);
    await audit({
      actorId: auth.user.id,
      actorName: auth.user.username,
      action: "server.command",
      target: command.slice(0, 200),
      detail: { ok: result.ok },
      ip: req.headers.get("x-forwarded-for"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}
