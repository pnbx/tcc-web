# Minecraft integration

The site and the game host live on networks that cannot always reach each other,
so the integration always works **outward from the server**: the plugin pushes,
the site queues, the plugin pulls.

## Adapter contract

`src/lib/mc/types.ts` defines what a capable backend looks like. Everything the
staff panels show is produced by one of these, in priority order:

1. **Bridge** — the TccBridge plugin (`tcc-bridge`), localhost only, `X-TCC-Token`.
2. **Pterodactyl** — panel client API, when the host exposes it.
3. **RCON** — commands only, firewalled.
4. **Status-only** — Server List Ping against `MINECRAFT_SERVER_HOST:PORT`.

A page never assumes an adapter exists. `status-store.ts` holds the last snapshot
so a slow or dead backend degrades one screen instead of the whole site.

## Bridge endpoints used by the site

| Endpoint | Direction | Body / meaning |
|---|---|---|
| `POST /api/mc/ingest` | plugin → site | players, max, MOTD, version, TPS, MSPT every 20 s |
| `POST /api/mc/poll` | plugin → site | the plugin asks for queued console commands |
| `POST /api/mc/ack` | plugin → site | result of each executed command |
| `POST /api/mc/stats` | plugin → site | cumulative player stats from PlaceholderAPI |
| `POST /api/mc/tiers` | plugin → site | tier grants mirrored from the Skript tier system |
| `POST /api/account/link/confirm` | plugin → site | in-game `/site connect <code>` completion |

All of them are guarded by the shared token; `MC_INGEST_TOKEN` on the site must
equal `token` in `plugins/TccBridge/config.yml`.

## Account linking (no Minecraft passwords on the web)

1. Player signs in and enters their Minecraft username at `/dashboard/profile`.
2. The site mints a one-time code (15 min TTL).
3. The player runs `/site connect <code>` in game (alias `/tccweb`).
4. The plugin verifies the player is online and calls `/api/account/link/confirm`.
5. The site stores `uuid + username` against the web account.

The game server is the only party that can prove ownership, so the website never
asks for a Minecraft password.

## Store fulfilment

After a verified payment, `user_products` rows are created and product commands
are queued with placeholders:

```
lp user {uuid} parent add elite
```

Supported placeholders: `{uuid}`, `{username}`, `{player}`. The plugin pulls the
queue, executes, and acknowledges each entry, which is then visible in the owner
panel and the audit log.

## Player statistics

`PlayerStatistics` is written only by the integration:

- the bridge pushes `kills`, `deaths`, `playtime` and similar totals read through
  PlaceholderAPI, so numbers survive a site restart and always come from the game;
- duel outcomes are parsed from console lines (`src/lib/duels.ts`) to derive
  wins/losses without asking the server for extra data.

No statistics are seeded, ever.

## Not exposing the game server

- The bridge binds to localhost.
- RCON credentials must never appear on a public page or in a client bundle.
- The file manager cannot leave `SERVER_FILES_ROOT`.
