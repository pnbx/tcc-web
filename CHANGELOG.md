# Changelog

Notable changes, newest first. Dates are when the work landed on `main`.

## Unreleased

- Repository hygiene: removed ten tracked local debug artifacts (curl cookie
  jars with `tcc_session` tokens, rank-studio test payloads) from the tree and
  from history.
- Added CI, MIT license, contributing and security policies, issue templates and
  architecture/deployment/integration docs.

## 2026-09-22

- `telegram`: `POST /api/account/telegram action=test` verifies the channel.
- `vercel`: cron reduced to once a day for the Hobby plan; hourly via `?secret`
  for external schedulers.
- `store`: basket with review-before-pay, 1 / 3 / 12-month rank durations,
  redeem codes, real per-rank LuckPerms permissions.
- `rank-studio`: AI tag/prefix studio with moderation, three price tiers,
  sanitised MiniMessage and per-order custom commands.
- `players`: full player list, wins/losses derived from duel console lines,
  bulk import of already-granted tiers.
- `stats`: PlaceholderAPI-driven player statistics accepted from the bridge
  (TccBridge 1.3.0).
- `perf`: staff panels read the pushed snapshot, panel calls time out in 2.5 s.
- `build`: root layout is dynamic, `/setup` is never prerendered, runtime uses
  the Supabase transaction pooler.
- `payments`: interstitial hop page and referrer handling so the gateway accepts
  a merchant registered on a different domain.

## 2026-09-21

- `bot`: token-protected `/api/bot/*` API for the Telegram assistant, `/tg` Mini
  App, per-admin AI mode.
- `link`: in-game account linking completes against the real account row, name
  clashes handled, `/site connect` instructions fixed.

## 2026-09-19 / 20

- `ui`: new landing page — hero with live status panel, stats strip, steps, mode
  cards, podium, CTA banner, glass header.
- `tiers`: tester panel; automatic tier sync from the game to the site.

## 2026-09-18

- Initial platform: player portal, tier database, news, store, Zibal payments,
  Pterodactyl integration, Supabase Postgres, RBAC with four staff panels.
- Baseline Postgres migration replaces the SQLite scaffolding.
