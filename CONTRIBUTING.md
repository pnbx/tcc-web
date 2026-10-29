# Contributing

Thanks for taking a look. This project runs a live community, so the bar for
changes to auth, payments and anything that touches the game server is higher
than for copy or styling.

## Getting set up

```bash
npm install
cp .env.example .env
npx prisma db push && npx prisma db seed
npm run dev
```

You do not need a Minecraft server to work on most of the site: the status
adapter falls back to Minecraft Server List Ping, so the homepage shows real
(public) server state even with no bridge or panel credentials.

## Before you open a pull request

```bash
npm run typecheck
npm run lint
npm run build
```

All three must pass. CI runs the same commands.

Please keep pull requests focused: one concern per PR, and describe *why* the
change is needed, not only what it does.

## Rules of the codebase

- **Server-side enforcement.** Any new privileged route calls `requirePermission(...)`.
  Hiding a button is never access control.
- **Never fabricate server data.** If a value comes from the game server, read it
  through an adapter in `src/lib/mc/`. No seeded or random stats, ever.
- **Secrets stay in `.env`.** New configuration means a new key in `.env.example`
  with a comment, and nothing else.
- **Money paths get verified.** Prices are re-derived from the database on the
  server; an order only becomes `PAID` after server-to-server verification.
- **Persian first, RTL always.** Technical strings (IPs, UUIDs, commands, paths)
  stay LTR through the `.mono` / `.ltr` / `.num` helpers.
- **Audit what matters.** Commands, power actions, file operations, tier and role
  changes, payments and settings changes all write an audit entry.

## Commit messages

Short imperative subject, then a body explaining the reason. Existing history is
the reference: `fix(payments): …`, `feat(bot): …`, `perf: …`.

## Security

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your work is licensed under the [MIT License](LICENSE).
