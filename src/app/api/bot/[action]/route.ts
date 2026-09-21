import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { timingSafeEqualStr } from "@/lib/crypto";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { getCachedStatus, MC_ADDRESS, MC_HOST, MC_PORT } from "@/lib/mc";
import { agentOnline, readConsoleFeed, readMetricSnapshot } from "@/lib/mc/agent";
import { enqueueCommand } from "@/lib/mc/queue";

export const dynamic = "force-dynamic";

// ── Bot API ─────────────────────────────────────────────────────────────────
// Single token-protected surface for the Telegram bot: it runs on its own Vercel
// deployment, so everything it knows or does about the game server comes through
// here — live status, console tail, queueing commands (ban/unban/say), tiers,
// orders and news.
function authorized(req: NextRequest): boolean {
  const expected = process.env.BOT_API_TOKEN || "";
  if (!expected) return false;
  const got = req.headers.get("x-bot-token") ?? "";
  return got.length > 0 && timingSafeEqualStr(got, expected);
}

const commandSchema = z.object({ command: z.string().min(1).max(300) });

type Action = "status" | "console" | "command" | "tiers" | "orders" | "news" | "players" | "overview";

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    if (!authorized(req)) return jsonError("unauthorized", 401);
    const { action } = (await ctx.params) as { action: Action };
    const url = new URL(req.url);

    switch (action) {
      case "status": {
        const status = await getCachedStatus();
        const metrics = await readMetricSnapshot();
        return jsonOk({
          address: MC_ADDRESS,
          host: MC_HOST,
          port: MC_PORT,
          online: status.online,
          state: status.state ?? (status.online ? "online" : "offline"),
          playersOnline: status.playersOnline,
          playersMax: status.playersMax,
          version: status.version,
          motd: status.motd?.clean ?? null,
          reportedAt: status.reportedAt ?? status.checkedAt,
          agentOnline: await agentOnline(),
          metrics: metrics
            ? { tps: metrics.tps, mspt: metrics.mspt, ramUsedMb: metrics.memoryUsedMb, ramMaxMb: metrics.memoryMaxMb, diskUsedGb: metrics.diskUsedGb, uptimeSec: metrics.uptimeSec }
            : null,
        });
      }

      case "console": {
        const limit = Math.min(80, Math.max(5, Number(url.searchParams.get("limit") ?? 25)));
        const lines = await readConsoleFeed({ limit });
        return jsonOk({ lines: (lines ?? []).slice(-limit).map((l) => ({ level: l.level, message: l.message })) });
      }

      case "tiers": {
        const categories = await prisma.tierCategory.findMany({
          orderBy: { position: "asc" },
          include: { tiers: { orderBy: { position: "asc" }, select: { name: true } } },
        });
        return jsonOk({ categories: categories.map((c) => ({ key: c.key, name: c.name, tiers: c.tiers.map((t) => t.name) })) });
      }

      case "orders": {
        const [counts, revenue, recent] = await Promise.all([
          prisma.order.groupBy({ by: ["status"], _count: true }),
          prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
          prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { username: true } }, items: { include: { product: { select: { name: true } } } } } }),
        ]);
        return jsonOk({
          byStatus: counts.map((c) => ({ status: c.status, count: c._count })),
          revenueToman: revenue._sum.totalCents ?? 0,
          recent: recent.map((o) => ({ number: o.orderNumber, status: o.status, user: o.user?.username ?? "-", items: o.items.map((i) => i.product.name).join(", "), total: o.totalCents, at: o.createdAt.toISOString() })),
        });
      }

      case "news": {
        const articles = await prisma.newsArticle.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" }, take: 5, select: { title: true, slug: true, excerpt: true, publishedAt: true } });
        return jsonOk({ articles });
      }

      case "players": {
        const rows = await prisma.minecraftAccount.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { playerTiers: { include: { tier: { select: { name: true } }, category: { select: { key: true } } } } },
        });
        return jsonOk({ players: rows.map((a) => ({ username: a.username, uuid: a.uuid, linked: Boolean(a.linkedAt), tiers: a.playerTiers.map((pt) => `${pt.category.key}:${pt.tier.name}`) })) });
      }

      case "overview": {
        const [status, players, paidOrders, revenue, latestNews] = await Promise.all([
          getCachedStatus(),
          prisma.minecraftAccount.count(),
          prisma.order.count({ where: { status: "PAID" } }),
          prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
          prisma.newsArticle.findFirst({ where: { published: true }, orderBy: { publishedAt: "desc" }, select: { title: true, slug: true } }),
        ]);
        return jsonOk({
          online: status.online,
          players: `${status.playersOnline ?? "-"}/${status.playersMax ?? "-"}`,
          version: status.version,
          linkedAccounts: players,
          paidOrders,
          revenueToman: revenue._sum.totalCents ?? 0,
          latestNews,
        });
      }

      default:
        return jsonError(`unknown action: ${action}`, 404);
    }
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/bot/command — queue a console command (ban, unban, say, …)
export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    if (!authorized(req)) return jsonError("unauthorized", 401);
    const { action } = (await ctx.params) as { action: Action };
    if (action !== "command") return jsonError("only /api/bot/command accepts POST", 405);

    const { command } = await parseBody(req, commandSchema);
    const id = await enqueueCommand(command, `telegram:${req.headers.get("x-bot-actor") ?? "bot"}`);
    return jsonOk({ queued: true, id, note: "دستور در صف قرار گرفت و حداکثر تا ۱۰ ثانیه روی سرور اجرا می‌شود." });
  } catch (err) {
    return handleApiError(err);
  }
}
