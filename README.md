# TCC Minecraft — Web Platform

**English** · [فارسی](README.fa.md)

**The player portal, competitive tier database and store for the [TCC Minecraft](https://tccmc.ir) PvP network.**

Persian-first (RTL) community platform: accounts, tiers, ranks, store, staff panels and a live view of the game server — all driven by real server data, never mock numbers.

[![CI](https://github.com/pnbx/tcc-web/actions/workflows/ci.yml/badge.svg)](https://github.com/pnbx/tcc-web/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-000?logo=nextdotjs)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://prisma.io)
[![Postgres](https://img.shields.io/badge/Postgres-Supabase-336791?logo=postgresql&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> سرور: `tccmc.ir` · سایت: `site.tccmc.ir`
> پلتفرم فارسی‌محور (RTL) برای شبکه‌ی PvP ماینکرفت TCC — پورتال بازیکن، دیتابیس تیرها، فروشگاه و پنل‌های مدیریتی.

---

## Contents

- [What this is](#what-this-is)
- [Feature tour](#feature-tour)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Project layout](#project-layout)
- [Security model](#security-model)
- [Screenshots](#screenshots)
- [Related repositories](#related-repositories)
- [License](#license)

---

## What this is

TCC is a competitive Minecraft PvP network. Players are ranked into **tiers** by testers, buy **ranks** and **cosmetics** from a store, and follow **news** and **player stats**. This repository is the website those players and the staff team actually use.

It is a single Next.js application (App Router, React Server Components) with:

- a public side — landing page, news, tier list, player profiles, store,
- a member side — dashboard, profiles, purchases, account linking,
- a staff side — four role-scoped panels (tester, admin, owner, developer),
- a private REST surface the Minecraft plugin and the Telegram bot talk to.

Everything runs against Postgres (Supabase) through Prisma, and every piece of server data is read from the live game server. **The site never fabricates server state.**

---

## Feature tour

**Accounts & access**
- Argon2id password hashing, opaque DB-backed sessions (SHA-256 hashed tokens), 7-day expiry, revocation on password change or ban.
- Optional TOTP two-factor, login throttling by IP + username, API burst limits.
- RBAC built from roles × granular permissions, with a wildcard for the owner. `requirePermission(...)` is enforced server-side on every privileged route — the UI only hides controls.
- Bootstrap flow at `/setup` guarded by `SETUP_KEY`, then marked complete in the database.
- Mandatory Telegram linking for members, so rank-expiry notices can actually reach them.

**Competitive side**
- Tier categories, tiers, player history and tier tests; testers award tiers from a dedicated panel.
- Automatic tier sync: a tier granted in game appears on the site without the tester touching the web.
- Player profiles with real statistics (kills, deaths, playtime) fed by PlaceholderAPI through the bridge.
- Duel results derived from console lines — wins/losses are computed, not entered.

**Store**
- Basket, review-before-pay, 1 / 3 / 12-month durations per rank.
- Product commands dispatched to the server with `{uuid}` / `{username}` / `{player}` placeholders and recorded per user.
- Redeem codes (rank, duration, seats, discount) created in the owner/dev panel.
- **AI rank + prefix studio**: a member describes the tag they want, the model designs it, the output is sanitised to MiniMessage and priced, with moderation that rejects abusive requests.
- Server-to-server payment verification, so an order is only `PAID` after the provider confirms it.

**Staff**
- Tester panel: tiers and tests.
- Admin: news, players, store, tiers, server.
- Owner: console, logs, monitoring, redeem codes, settings, server.
- Developer: console, file manager (sandboxed), plugins, monitoring, system.
- Audit log on every sensitive action: actor, action, target, detail, IP.

**Ops**
- Live status from the game server via three adapters (see below), plus Minecraft Server List Ping as a zero-credential fallback — the homepage shows true online state even with no keys configured.
- Daily cron for rank expiry (`/api/cron/expiry`).
- Persian typography system with five remappable font slots, self-hosted fonts, and LTR isolation for technical strings.

---

## Architecture

```
Browser
   │  HTTPS only
   ▼
Next.js App Router  (RSC + route handlers, Vercel)
   ├── Auth        Argon2id · sessions · TOTP · throttling
   ├── RBAC        roles × permissions, owner wildcard
   ├── Domain      tiers · news · store · players · redeem · rank studio
   ├── Payments    provider-verified, server-to-server
   ├── Audit       every sensitive action
   └── Minecraft   adapter pattern ↓
             ┌──────────────┬───────────────┬──────────────┬───────────────┐
          Bridge plugin   Pterodactyl      RCON         Server List Ping
        (status, console,   (panel API:   (commands)     (status only,
         power, files,      status, CPU,                   always works)
         plugins, stats)    console, power)
             │
        TCC game server (Paper) + TccBridge plugin + Skript content
```

Adapter priority is **bridge → Pterodactyl → RCON → status-only**; the contract lives in [`src/lib/mc/types.ts`](src/lib/mc/types.ts).

| Adapter | Capabilities | Config |
|---|---|---|
| **Bridge** (preferred) | status, TPS/MSPT/CPU/RAM/disk/net, console, commands, power, files, plugins, player stats | `BRIDGE_URL`, `BRIDGE_TOKEN` |
| **Pterodactyl** | status, resource usage, uptime, console from `logs/latest.log`, commands, power, files, plugin list | `PTERO_PANEL_URL`, `PTERO_API_KEY`, `PTERO_SERVER_ID` |
| **RCON** (fallback) | commands, player count, status via SLP | `RCON_HOST`, `RCON_PORT`, `RCON_PASSWORD` — never expose publicly |
| **Status-only** | real public status via Server List Ping | none |

Deep dives: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/MINECRAFT.md](docs/MINECRAFT.md) · [docs/PAYMENTS.md](docs/PAYMENTS.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## Quick start

Requires **Node.js 20+** and a Postgres database (Supabase free tier is fine).

```bash
git clone https://github.com/pnbx/tcc-web.git
cd tcc-web
npm install
cp .env.example .env          # fill in the values (see below)
npx prisma db push            # create the schema
npx prisma db seed            # roles, permissions, tiers, store catalog
npm run dev
```

Open <http://localhost:3000/setup> and create the initial **Owner** and **Developer** accounts. That route requires `SETUP_KEY` from your `.env`, so only someone with shell access can bootstrap the platform.

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server with Turbopack |
| `npm run build` / `npm start` | production build and server |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run typecheck` | `tsc --noEmit` |
| `npx prisma studio` | browse the database |

---

## Environment variables

`.env.example` documents every key. Grouped by concern:

| Group | Keys |
|---|---|
| Database | `SUPABASE_DB_URL`, `SUPABASE_POOLER_URL`, `DATABASE_URL` |
| Supabase | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL` |
| Sessions | `SESSION_SECRET`, `JWT_SECRET` |
| Bootstrap | `SETUP_KEY`, `OWNER_USERNAME`, `DEVELOPER_INITIAL_PASSWORD` |
| Minecraft | `MINECRAFT_SERVER_HOST`, `MINECRAFT_SERVER_PORT`, `BRIDGE_URL`, `BRIDGE_TOKEN`, `MC_INGEST_TOKEN`, `RCON_*`, `PTERO_*`, `SERVER_FILES_ROOT` |
| Payments | `PAYMENT_PROVIDER`, `PAYMENT_PROVIDER_MERCHANT_ID`, `PAYMENT_PROVIDER_CALLBACK_BASE`, `ZIBAL_RELAY_URL`, `ZIBAL_RELAY_SECRET` |
| Integrations | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `BOT_API_TOKEN`, `OPENROUTER_API_KEYS`, `OPENROUTER_MODELS`, `CRON_SECRET` |

Generate real secrets with `openssl rand -base64 48`. Never commit `.env`; it is gitignored, and the repository has never contained one.

What needs a real credential to light up:

| Feature | Requires |
|---|---|
| Live console, power, file manager, TPS/MSPT/CPU/RAM | Bridge plugin, or Pterodactyl |
| Player statistics on profiles | Bridge stats sync (PlaceholderAPI) |
| Real payments | A configured provider (Zibal is implemented) |
| Commercial Persian fonts (Peyda/Dana/Yekan Bakh) | Licensed `.woff2` in `public/fonts/` |

Everything else — auth, RBAC, news, tiers, store catalog, audit, public server status — works out of the box.

---

## Deployment

Standard `next build` + `next start` behind a reverse proxy, or Vercel. `vercel.json` pins `syd1` and the daily expiry cron.

Checklist:

1. Postgres reachable; apply `prisma/schema.prisma` (plus `prisma/manual/*.sql` for additive expansions).
2. Real values for `SESSION_SECRET` and `JWT_SECRET`.
3. Set `SETUP_KEY`, finish `/setup`, then remove it to hard-disable re-bootstrap.
4. Point `PAYMENT_PROVIDER_CALLBACK_BASE` at the public origin the provider accepts.
5. `CRON_SECRET` in place if you schedule hourly expiry yourself.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the step-by-step, including the Supabase pooler caveat.

---

## Project layout

```
prisma/
  schema.prisma          # 34-model relational schema
  seed.ts                # RBAC + tiers + categories + products (no fake stats)
  manual/                # additive SQL for in-place expansions
src/lib/                 # auth, RBAC, audit, settings, payments, ranks, studio, telegram
src/lib/mc/              # Minecraft adapters: bridge, pterodactyl, rcon, slp, files sandbox
src/app/                 # public pages, dashboard, admin, owner, developer, tester
src/app/api/             # REST endpoints (auth, news, tiers, players, store, server, bot)
deploy/zibal-relay/      # PHP relay for providers that pin the callback domain
docs/                    # architecture, deployment, Minecraft integration, payments
```

---

## Security model

- **Passwords**: Argon2id. Never logged, never returned by any API, never displayed.
- **Sessions**: opaque random tokens, SHA-256 hashed at rest, HttpOnly + SameSite cookies.
- **RBAC**: enforced on the server; the UI only hides what you cannot use.
- **Rate limiting**: login throttling plus API burst limits.
- **Audit log**: every sensitive action recorded with actor, target, detail and IP.
- **File sandbox**: paths resolve inside `SERVER_FILES_ROOT`; traversal, drive letters and symlink escapes are rejected; sensitive files are blocked unless explicitly allowed.
- **Headers**: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` via middleware.
- **Secrets**: `.env` only, documented in `.env.example`, never in git.

Found something? See [SECURITY.md](SECURITY.md) — please report privately, not as a public issue.

---

## Screenshots

_Add yours to `docs/screenshots/` and link them here: homepage, tier list, store, dashboard, staff console._

```
docs/screenshots/home.png        docs/screenshots/tiers.png
docs/screenshots/store.png       docs/screenshots/console.png
```

---

## Related repositories

| Repository | What it is |
|---|---|
| [`tcc-bridge`](https://github.com/pnbx/tcc-bridge) | Paper plugin that pushes status and pulls commands |
| [`tcc-bot`](https://github.com/pnbx/tcc-bot) | Telegram assistant and Mini App for staff and players |
| [`TCC-Launcher`](https://github.com/pnbx/TCC-Launcher) | Fabric-first launcher for the TCC client |
| `tcc-skript` | Battle Pass, cosmetics and quest content for the server |

---

## License

[MIT](LICENSE) © TCC Minecraft

The fonts bundled in `public/fonts/` keep their own licenses (Vazirmatn and Estedad are OFL). Peyda, Dana and Yekan Bakh are commercial and are **not** included — drop in your own licensed files if you have them.
