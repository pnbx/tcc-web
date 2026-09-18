# TCC Minecraft — Web Platform

Official website + player portal + competitive tier database + store + server control center for the **TCC Minecraft** network.

- Minecraft server: `tccmc.ir`
- Website: `site.tccmc.ir`
- Stack: **Next.js 15 (App Router, TypeScript)** · **Prisma 7** · **Supabase Postgres** · **Tailwind CSS 4**
- Language: Persian-first UI (RTL) with bilingual-ready typography

---

## Quick start (local)

```bash
npm install
cp .env.example .env          # then edit values
npx prisma db push            # apply the schema to Supabase Postgres
npx prisma db seed            # roles, permissions, tiers, store categories/products
npm run dev
```

Then open `http://localhost:3000/setup` to create the initial **Owner** and **Developer** accounts.
This requires `SETUP_KEY` from your `.env` — only someone with shell access can bootstrap the platform.

## Production deployment

```bash
npm run build
npm start                     # behind a reverse proxy (nginx/caddy) at site.tccmc.ir
```

Checklist:
1. **Supabase Postgres** is the database: set `SUPABASE_DB_URL` (connection string from the dashboard, non-pooler or session-pooler URI) — `prisma db push` applies the schema; no SQLite involved.
2. Generate real secrets: `openssl rand -base64 48` for `SESSION_SECRET` / `JWT_SECRET`.
3. Set `SETUP_KEY`, finish `/setup`, then remove `SETUP_KEY` from the environment if you want to hard-disable re-bootstrap (setup is also marked complete in the DB).
4. Point `PAYMENT_PROVIDER_CALLBACK_BASE` at `https://site.tccmc.ir`.

---

## Architecture

```
Browser
   ↓  (HTTPS only)
TCC Web Frontend (Next.js App Router, RSC)
   ↓  (internal API routes, session cookie + RBAC on every privileged endpoint)
TCC Backend (route handlers)
   ├── Auth (Argon2id, sessions, TOTP, login throttling)
   ├── RBAC (roles × granular permissions, wildcard for OWNER)
   ├── Tiers / News / Store / Players
   ├── Payments (provider-verified server-to-server)
   ├── Audit log
   └── Minecraft integration (adapter pattern)
             ↓
   TCC Bridge plugin (preferred)  |  RCON (firewalled fallback)  |  SLP (status only)
             ↓
   TCC Minecraft Server (tccmc.ir)
```

### Minecraft integration

The site **never fakes server data**. Three adapters implement `MinecraftServerAdapter`
(`src/lib/mc/types.ts`):

| Adapter | Capabilities | Config |
|---|---|---|
| **Bridge** (preferred) | status, TPS/MSPT/CPU/RAM/disk/net, live console, commands, power, files, plugins, player stats | `BRIDGE_URL`, `BRIDGE_TOKEN` |
| **Pterodactyl** | status, CPU/RAM/disk/net, uptime, console (from `logs/latest.log`), commands, power, files, plugins (from jar names) | `PTERO_PANEL_URL`, `PTERO_API_KEY`, `PTERO_SERVER_ID` |
| **RCON** (fallback) | status (via SLP), commands, player count | `RCON_HOST/PORT/PASSWORD` — **never expose publicly** |
| **Status-only** | real public status via Server List Ping | nothing needed |

Adapter priority: bridge → pterodactyl → rcon → status-only.

Status always works: the site speaks the Minecraft **Server List Ping** protocol
directly (`src/lib/mc/slp.ts`), so the homepage shows the true online state of
`tccmc.ir` even with zero credentials configured.

**TCC Bridge plugin** — deploy a small plugin on the Minecraft server that exposes
`/api/v1/*` endpoints (status, metrics, console, command, power, files, plugins,
players/stats) on **localhost only**, authenticated by the shared
`X-TCC-Token` header (`BRIDGE_TOKEN`). The website's `/api/account/link/confirm`
endpoint is the matching counterpart for in-game account linking
(`/tccweb link <code>`). Reference contract: `src/lib/mc/types.ts`.

**Player statistics** are stored in `player_statistics` and updated only by the
integration (`fetchPlayerStats` → upsert). No fake numbers are ever seeded.

### Account linking (no Minecraft passwords on the web)

1. Player logs into the website, enters their Minecraft username at
   `/dashboard/profile`.
2. The site mints a one-time code (15 min TTL).
3. The player runs `/tccweb link <code>` **in game**.
4. The bridge plugin verifies the player is online and calls
   `POST /api/account/link/confirm` with the shared token.
5. The site stores `uuid + username` linked to the web account.

Minecraft passwords never touch the website; the game server is the only party
that can prove ownership.

### Payments

- Frontend creates an order → backend re-prices it from the DB → provider
  session is created → user is redirected to `gateway.zibal.ir/start/{trackId}`.
- The provider calls back to `/api/store/callback?order=...`; verification happens
  **server-to-server** through the `PaymentProvider` interface
  (`src/lib/payments.ts`). Only a verified callback flips an order to `PAID`,
  after which the user is redirected to `/store/result/{orderNumber}`.
- **Zibal is implemented** (`ZibalProvider`): prices are stored as Toman (IRT)
  and sent to Zibal as Rial (×10). Set `PAYMENT_PROVIDER_MERCHANT_ID` to the
  merchant from the Zibal panel of the domain the gateway was registered under
  (the hosted payment page shows that domain), or `"zibal"` for the sandbox.
- After verification, product commands (e.g. `lp user {uuid} parent add elite`)
  are dispatched to the server via the adapter, with placeholders
  `{uuid}` / `{username}` / `{player}`, and recorded in `user_products`.
- Other providers plug in behind the same interface.

---

## Persian typography system

Five font slots are CSS variables, remappable from **Owner → Settings** without
touching components:

| Slot | Variable | Default intent |
|---|---|---|
| Display / hero | `--font-display` | Dana |
| Headings | `--font-heading` | Peyda |
| UI / nav / buttons | `--font-ui` | Peyda |
| Body / long text | `--font-body` | Vazirmatn |
| Technical | `--font-mono` | system mono |

Bundled now (self-hosted, WOFF2, `font-display: swap`): **Vazirmatn** (variable
+ 4 static weights) and **Estedad** (variable, Arabic+Latin subsets) — both OFL.

**Peyda, Yekan Bakh and Dana are commercial fonts** (FontIran). They are
*declared* in `globals.css` but only load if you drop your licensed files into
`public/fonts/` (e.g. `Dana-Regular.woff2`, `Peyda-Bold.woff2`,
`YekanBakh-Regular.woff2`). Until then the stacks fall through gracefully to
Vazirmatn/Estedad. Nothing is hotlinked from CDNs.

RTL rules: `<html lang="fa" dir="rtl">` globally; technical content (IPs,
commands, UUIDs, console, file paths) stays LTR via `.mono`, `.ltr`, `.num`,
`.ip-address` helpers (`direction: ltr; unicode-bidi: isolate`).

---

## Security model

- **Passwords**: Argon2id (`@node-rs/argon2`). Never logged, never returned by
  any API, never displayed. The developer/owner credentials are created at
  `/setup` and changeable; nothing is hardcoded.
- **Sessions**: opaque random tokens, SHA-256 hashed in DB, HttpOnly + SameSite
  cookies, 7-day expiry, revocation on password change/ban.
- **RBAC**: every privileged API route calls `requirePermission(...)` server
  side. The UI only *hides* controls; hiding is never the enforcement.
- **Rate limiting**: login throttling (IP + username) and API burst limits.
- **Audit log**: every sensitive action (commands, power, files, tiers, roles,
  payments, settings) records actor/action/target/detail/IP.
- **File sandbox** (developer panel): all paths resolve inside
  `SERVER_FILES_ROOT`; `..` traversal, drive letters and symlink escapes are
  rejected; sensitive files (env/keys/credentials/ops.json/whitelist.json) are
  blocked unless `FILES_ALLOW_SENSITIVE=1`.
- **Headers**: CSP, X-Frame-Options, nosniff, Referrer-Policy via middleware.
- **Secrets**: only in `.env` (gitignored). `.env.example` documents every key.

## Project layout

```
prisma/schema.prisma      # 24-table relational schema
prisma/seed.ts            # RBAC + tiers + categories + products (no fake stats)
src/lib/                  # auth, RBAC, audit, rate-limit, settings, payments
src/lib/mc/               # Minecraft adapters: slp, rcon, bridge, files sandbox
src/app/api/              # REST endpoints (auth, news, tiers, players, store, server, files)
src/app/(public pages)    # home, news, tiers, players, store, login, setup
src/app/dashboard/        # member panel
src/app/admin|owner|developer/  # staff panels
```

## What needs real credentials to light up

| Feature | Requires |
|---|---|
| Live console, power controls, file manager, TPS/MSPT/CPU/RAM | TCC Bridge plugin (or RCON for commands only) |
| Player statistics on profiles | Bridge `players/stats` sync |
| Real payments | `PAYMENT_PROVIDER_*` + provider implementation |
| Commercial Persian fonts | Licensed woff2 files in `public/fonts/` |

Everything else (auth, RBAC, news, tiers, store catalog, audit, public real-time
server status) works out of the box.
