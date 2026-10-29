# Deployment

## 1. Database (Supabase Postgres)

1. Create a project, then take the connection string from **Project settings → Database**.
2. Two URIs matter here:
   - `SUPABASE_DB_URL` — direct or *session* pooler, used for migrations.
   - `SUPABASE_POOLER_URL` — *transaction* pooler, used by the running app.
3. Apply the schema:

   ```bash
   npx prisma db push
   npx prisma db seed
   ```

   The Prisma datasource intentionally carries no `url`, and the runtime uses the
   transaction pooler, so for additive changes on a live database prefer the SQL
   files in `prisma/manual/` and apply them through the session pooler:

   ```bash
   node scripts/db-apply-sql.mjs prisma/manual/<file>.sql
   ```

   They are written to be idempotent (`IF NOT EXISTS`), so re-running is safe.

## 2. Environment

```bash
cp .env.example .env
openssl rand -base64 48   # SESSION_SECRET
openssl rand -base64 48   # JWT_SECRET
```

Minimum for a working site: database URLs, both secrets, `SETUP_KEY`,
`MINECRAFT_SERVER_HOST`/`PORT`. Everything else degrades gracefully.

## 3. Bootstrap

1. Deploy or run locally, open `/setup`, enter `SETUP_KEY`.
2. Create the owner and developer accounts there — nothing is hardcoded.
3. Remove `SETUP_KEY` from the environment to hard-disable re-bootstrap (setup is
   also recorded as complete in the database).

## 4. Vercel

`vercel.json` pins `regions: ["syd1"]` and one daily cron:

```json
{ "path": "/api/cron/expiry", "schedule": "0 6 * * *" }
```

Vercel Hobby allows daily crons only. For hourly expiry handling, keep the daily
cron and additionally call the route from an external scheduler with
`?secret=$CRON_SECRET`.

## 5. Self-hosted

```bash
npm ci
npm run build
npm start            # listens on :3000
```

Put nginx/caddy in front for TLS, forward `X-Forwarded-*`, and keep the Node
process supervised. The app sets its own security headers, so do not duplicate a
conflicting CSP at the proxy.

## 6. Game server wiring

1. Build the plugin from [`tcc-bridge`](https://github.com/pnbx/tcc-bridge) and drop
   the jar into `plugins/`.
2. Start once to generate `plugins/TccBridge/config.yml`.
3. Set `site-url` and `token` — the token must equal the site's `MC_INGEST_TOKEN`.
4. Alternatively configure `PTERO_*` (panel API) if the host exposes it, or
   `RCON_*` for commands only. Status works with neither.

## 7. Post-deploy checks

- `/` shows the real player count (Server List Ping).
- `/login` works and redirects staff to their panel.
- `/api/server/status` returns a snapshot, not a 500.
- A test order reaches the provider and the callback marks it `PAID`.
- `/api/cron/expiry` responds with the secret supplied.
