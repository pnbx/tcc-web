import { NextRequest } from "next/server";
import { z } from "zod";
import { getMinecraft } from "@/lib/mc";
import { agentOnline, runJob } from "@/lib/mc/agent";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), confirm: z.boolean() }),
  z.object({ action: z.literal("stop"), confirm: z.boolean(), force: z.boolean().optional() }),
  z.object({ action: z.literal("restart"), confirm: z.boolean() }),
  z.object({ action: z.literal("broadcast"), message: z.string().min(1).max(300) }),
]);

// POST /api/server/power — destructive actions require confirm:true (the UI
// shows a confirmation dialog) and are audited with the actor identity.
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req, schema);
    const ip = req.headers.get("x-forwarded-for");

    if (body.action === "broadcast") {
      const auth = await requirePermission("server.broadcast");
      const res = await getMinecraft().broadcast(body.message);
      await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "server.broadcast", target: body.message, ip });
      return jsonOk(res);
    }

    const perm = body.action === "start" ? "server.start" : body.action === "stop" ? "server.stop" : "server.restart";
    const auth = await requirePermission(perm);
    if (!body.confirm) {
      return jsonError("برای این عملیات، تأیید صریح لازم است.", 400);
    }

    // Restart/stop go through the in-server agent when it is alive (the agent
    // restarts the JVM itself). "start" cannot be served by the agent — it is
    // not running while the server is off — so it needs a reachable panel.
    let res: { ok: boolean; message?: string };
    if (body.action !== "start" && (await agentOnline())) {
      try {
        await runJob(
          body.action === "stop" ? "power.stop" : "power.restart",
          { force: "force" in body ? (body.force ?? false) : false },
          { label: `power.${body.action}`, timeoutMs: 8000 },
        );
        res = { ok: true, message: body.action === "stop" ? "سرور در حال خاموش شدن است." : "سرور در حال ری‌استارت است." };
      } catch (err) {
        res = { ok: false, message: (err as Error).message };
      }
    } else {
      const mc = getMinecraft();
      res =
        body.action === "start"
          ? await mc.startServer()
          : body.action === "stop"
            ? await mc.stopServer(body.force ?? false)
            : await mc.restartServer();
      if (body.action === "start" && !res.ok) {
        res = {
          ok: false,
          message: "سرور خاموش است و ایجنت درون‌سرور هم در دسترس نیست. برای روشن کردن، از پنل پافرلند استارت بزن (یا در پنل یک Schedule برای استارت بگذار).",
        };
      }
    }

    await prisma.serverEvent.create({
      data: { type: body.action.toUpperCase(), detail: `by ${auth.user.username}` },
    });
    await audit({
      actorId: auth.user.id,
      actorName: auth.user.username,
      action: `server.${body.action}`,
      detail: { ok: res.ok, message: res.message },
      ip,
    });
    return jsonOk(res);
  } catch (err) {
    return handleApiError(err);
  }
}
