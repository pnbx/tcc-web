import { NextRequest } from "next/server";
import { z } from "zod";
import { getMinecraft } from "@/lib/mc";
import { agentOnline, readConsoleFeed } from "@/lib/mc/agent";
import { enqueueCommand } from "@/lib/mc/queue";
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

    // Lines pushed by the in-server agent (works when the host is unreachable).
    const feed = await readConsoleFeed({ after: after ? Number(after) : undefined, limit: 500, grep: grep || undefined, level: level?.length ? level : undefined });
    const lines =
      feed ??
      (await getMinecraft().getConsoleLines({
        after: after ? Number(after) : undefined,
        limit: 500,
        grep: grep || undefined,
        level: level?.length ? level : undefined,
      }));
    return jsonOk({ lines, serverTime: Date.now() });
  } catch (err) {
    return handleApiError(err);
  }
}

const cmdSchema = z.object({ command: z.string().min(1).max(500) });

// POST /api/server/console — execute a command (server.command).
// When the in-server agent is alive the command goes through the queue (it
// always works, even though this host cannot reach the game server); otherwise
// we try the direct adapter.
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission("server.command");
    const { command } = await parseBody(req, cmdSchema);

    let result: { ok: boolean; output: string[] };
    if (await agentOnline()) {
      await enqueueCommand(command, `panel:${auth.user.username}`);
      result = { ok: true, output: ["دستور به صف سرور تحویل داده شد و تا چند ثانیه اجرا می‌شود."] };
    } else {
      result = await getMinecraft().execCommand(command);
    }
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
