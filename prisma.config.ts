import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations run over the direct/pooler Postgres connection (Supabase).
    url: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "",
  },
});
