# Security policy

## Reporting a vulnerability

**Please do not open a public issue.**

Use GitHub's [private vulnerability reporting](https://github.com/pnbx/tcc-web/security/advisories/new)
or contact the maintainer directly on the TCC Discord / Telegram. Include:

- what you found and where (route, endpoint, file),
- steps to reproduce, ideally with a minimal request,
- impact: what an attacker gains, and what they need to start with (nothing,
  a normal account, a staff account).

You will get an acknowledgement within a few days. Please give us time to ship a
fix before writing publicly.

## Scope

In scope:

- authentication, session handling, password reset / change flows,
- the RBAC system and any route that calls `requirePermission`,
- payment verification (`/api/store/callback`, the provider interface),
- the file manager sandbox (`SERVER_FILES_ROOT` escapes),
- the bridge and bot APIs (`/api/mc/*`, `/api/bot/*` token checks),
- injection, SSRF, XSS and CSRF in the app itself.

Out of scope:

- findings that need physical access to the host, or a compromised admin account,
- reports from automated scanners with no demonstrated impact,
- the Minecraft game server's plugins (report those to their own projects).

## Design notes worth knowing before you test

- Sessions are opaque tokens, hashed at rest; cookies are HttpOnly + SameSite.
- Privileged endpoints authorize on the server. The UI hiding a control is not a
  security boundary — verify the route, not the button.
- Payment callbacks are verified server-to-server; the browser is never trusted
  to mark an order paid.
- The bridge token is a shared secret (`X-TCC-Token`); the bridge is expected to
  listen on localhost only.

## Keys

This repository contains no credentials. If you believe a key was leaked in
history, say so in the report — rotation is faster than arguing about history.
