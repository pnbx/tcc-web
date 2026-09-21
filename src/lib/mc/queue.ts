import { prisma } from "@/lib/db";

// Outbound commands for the game server (rank grants etc.). Enqueued here so
// they survive a network that cannot reach the game host directly; the bridge
// plugin collects and executes them.

export async function enqueueCommand(command: string, source?: string): Promise<string> {
  const row = await prisma.mcCommand.create({
    data: { command: command.startsWith("/") ? command.slice(1) : command, source: source ?? null },
  });
  return row.id;
}

/** Take up to `limit` pending commands, marking them SENT (at-most-once). */
export async function takePendingCommands(limit = 20) {
  const rows = await prisma.mcCommand.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  if (rows.length === 0) return [];
  await prisma.mcCommand.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: "SENT", sentAt: new Date() },
  });
  return rows.map((r) => ({ id: r.id, command: r.command, source: r.source }));
}

export async function settleCommand(id: string, ok: boolean, result?: string): Promise<void> {
  await prisma.mcCommand.update({
    where: { id },
    data: { status: ok ? "DONE" : "FAILED", settledAt: new Date(), result: result?.slice(0, 500) ?? null },
  });
}
