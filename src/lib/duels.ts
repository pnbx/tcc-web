import { prisma } from "@/lib/db";

// Duel results.
//
// Vanilla statistics have no notion of "wins" or "losses", but the arena script
// prints one line per finished duel:
//   TCC TEST » alfa_00028 7 - 1 beni4545 | Sword
// The plugin streams console lines to us, so we parse them here and keep a
// running tally per player (persisted in PlayerStatistics).

const DUEL = /TCC\s*(?:TEST|»)\s*»?\s*([A-Za-z0-9_]{3,16})\s+(\d+)\s*-\s*(\d+)\s+([A-Za-z0-9_]{3,16})\s*\|\s*([A-Za-z]+)/;

export async function recordDuelResults(lines: string[]): Promise<{ applied: number }> {
  if (lines.length === 0) return { applied: 0 };

  // one duel can appear on several streamed chunks — de-duplicate per call
  const seen = new Set<string>();
  let applied = 0;

  for (const line of lines) {
    const match = DUEL.exec(line);
    if (!match) continue;
    const [, winner, winnerScore, loserScore, loser, mode] = match;
    const key = `${winner}:${loser}:${winnerScore}-${loserScore}:${mode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    for (const [username, field] of [
      [winner, "wins"],
      [loser, "losses"],
    ] as const) {
      const account = await prisma.minecraftAccount.findUnique({ where: { username } });
      if (!account) continue; // the player is unknown to the site yet → the stats sync will create them
      const stats = await prisma.playerStatistics.findUnique({ where: { minecraftAccountId: account.id } });
      if (stats) {
        await prisma.playerStatistics.update({
          where: { minecraftAccountId: account.id },
          data: { [field]: (field === "wins" ? stats.wins : stats.losses) + 1 },
        });
      } else {
        await prisma.playerStatistics.create({
          data: { minecraftAccountId: account.id, wins: field === "wins" ? 1 : 0, losses: field === "losses" ? 1 : 0 },
        });
      }
      applied++;
    }
  }

  return { applied };
}
