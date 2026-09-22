// Apply a .sql file to the live Supabase database through the session pooler.
// Prisma's datasource carries no url in this project (Prisma 7 + driver adapters),
// so schema changes are applied with this explicit, idempotent SQL runner.
//
// Usage: node scripts/db-apply-sql.mjs prisma/manual/<file>.sql
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.log("usage: node scripts/db-apply-sql.mjs <file.sql>");
  process.exit(1);
}

// .env is not loaded by plain node — read it for the pooler URL.
const envText = await fs.readFile(path.resolve(".env"), "utf8").catch(() => "");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL || env.SUPABASE_POOLER_URL || env.DATABASE_URL;
if (!url) {
  console.log("no database url found in .env (SUPABASE_DB_URL)");
  process.exit(1);
}

const sql = await fs.readFile(file, "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`applied ${file} (${sql.length} chars) — committed`);
} catch (err) {
  await client.query("ROLLBACK");
  console.log("FAILED, rolled back:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
