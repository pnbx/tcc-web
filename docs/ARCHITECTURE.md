# Architecture

## Request path

Every page is a React Server Component unless it has to be interactive. Data is
read on the server through Prisma; mutations go through route handlers under
`src/app/api/`.

```
Request
  ├─ src/middleware.ts        security headers, payment-hop referrer policy, session cookie presence
  ├─ RSC / route handler      getSession() → requirePermission() where privileged
  ├─ src/lib/*                domain logic
  └─ prisma / src/lib/mc/*    database and game-server access
```

Two rules keep this honest:

1. **Authorization is server-side.** The UI decides what to *show*; the route
   decides what is *allowed*. Every privileged handler calls
   `requirePermission(...)` before doing work.
2. **The database is the source of truth for money.** A checkout re-prices the
   basket from `Product` / `ProductDuration` rows before talking to a provider.

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Pages and panels | `src/app/**` | RSC views, layouts, forms |
| Route handlers | `src/app/api/**` | REST surface: auth, account, tiers, players, store, server, mc, bot, cron |
| Domain logic | `src/lib/*.ts` | auth, permissions, audit, rate limit, settings, ranks, store cart, redeem, telegram, AI |
| Game server | `src/lib/mc/*` | adapters and the file sandbox |
| Persistence | `prisma/` | 34 models, seed data, additive SQL |

## Authentication

- Passwords: Argon2id via `@node-rs/argon2`.
- Sessions: random 32-byte token handed to the client; a SHA-256 hash is stored
  in `Session`. Lookup by hash, expiry 7 days, revoked on password change/ban.
- Cookies: HttpOnly, SameSite=Lax, Secure in production.
- TOTP: `otplib`, enrolled from the dashboard, secret stored per user.
- Throttling: `LoginAttempt` rows keyed by IP and username, plus a token bucket
  for API bursts (`src/lib/rate-limit.ts`).

## Authorization

Roles hold permissions (`RolePermission`); users hold roles (`UserRole`). The
owner role short-circuits to allow. `requirePermission(key)` throws unless the
session's effective permission set contains `key` or a wildcard match.

The panels map to role families:

| Panel | Route prefix | Typical permissions |
|---|---|---|
| Tester | `/tester` | `tiers.read`, `tiers.assign`, `tiers.test` |
| Admin | `/admin` | news, players, store, tiers, server read |
| Owner | `/owner` | everything, including settings and redeem |
| Developer | `/developer` | console, files, plugins, power |

## Data model

34 models in five clusters:

- **Identity** — User, MinecraftAccount, Role, Permission, RolePermission, UserRole, Session, LoginAttempt, ApiToken
- **Competitive** — TierCategory, Tier, PlayerTier, TierHistory, TierTest, PlayerStatistics, PlayerActivity
- **Content** — NewsCategory, NewsArticle, ProductCategory, Product, ProductDuration, RankProfile, Setting
- **Commerce** — Order, OrderItem, Payment, UserProduct, RedeemCode, RedeemRedemption
- **Operations** — ServerMetric, ServerEvent, AuditLog, McCommand, McLogLine

Player statistics and server metrics are written only by the integration. There
is no code path that invents them.

## Server data adapters

`src/lib/mc/types.ts` defines `MinecraftServerAdapter`. Selection order is
bridge → pterodactyl → rcon → status-only, so the same UI works whether the site
can reach the panel, only the console port, or nothing at all.

- `bridge.ts` — the preferred adapter; talks to the TccBridge plugin on localhost.
- `pterodactyl.ts` — Pterodactyl client API, for hosts that expose the panel.
- `rcon-adapter.ts` / `rcon.ts` — commands only; never exposed publicly.
- `slp.ts` — Minecraft Server List Ping; real public status with no credentials.
- `status-store.ts` — the snapshot the panels read, so a slow panel call can
  never block a page.
- `files*.ts` — sandboxed file management for the developer panel.

Timeouts are deliberately short (2.5 s for panel calls): a dead panel must
degrade the panel page, not the site.

## Payments

`src/lib/payments.ts` exposes a `PaymentProvider` interface. `ZibalProvider` is
implemented; prices are stored in Toman and sent in Rial (×10). The callback
route re-verifies the transaction server-to-server and only then flips the order
to `PAID` and dispatches the product commands.

Some providers pin the callback to the domain the merchant was registered under.
`deploy/zibal-relay/` is the small PHP relay used for that case — see
[PAYMENTS.md](PAYMENTS.md).

## Typography and RTL

Five CSS variables (`--font-display`, `--font-heading`, `--font-ui`,
`--font-body`, `--font-mono`) are remappable from **Owner → Settings**.
Vazirmatn and Estedad ship self-hosted; the commercial families are declared but
only load if you add licensed files. `<html lang="fa" dir="rtl">` globally, with
`.mono`, `.ltr`, `.num` and `.ip-address` isolating technical content LTR.
