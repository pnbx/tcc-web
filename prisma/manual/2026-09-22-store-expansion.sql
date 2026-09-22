-- TCC Store expansion — 2026-09-22
-- Additive only: new tables + new nullable columns. Idempotent (IF NOT EXISTS),
-- safe to run twice. Applied with scripts/db-apply-sql.mjs through the Supabase
-- session pooler (the Prisma datasource carries no url, so `prisma db push`
-- is not used in this project).

-- ── Telegram link on the user (required for members) ───────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramId"          TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramUsername"    TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkedAt"    TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkCode"    TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkExpires" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key"     ON "User"("telegramId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramLinkCode_key" ON "User"("telegramLinkCode");

-- ── Product: rank link + perks ─────────────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "rankKey" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "perks"   TEXT NOT NULL DEFAULT '[]';

-- ── Durations sold per product (1 / 3 / 12 months) ─────────────────────────
CREATE TABLE IF NOT EXISTS "ProductDuration" (
  "id"         TEXT     NOT NULL,
  "productId"  TEXT     NOT NULL,
  "months"     INTEGER  NOT NULL,
  "days"       INTEGER  NOT NULL,
  "priceCents" INTEGER  NOT NULL,
  "label"      TEXT     NOT NULL DEFAULT '',
  "active"     BOOLEAN  NOT NULL DEFAULT true,
  "position"   INTEGER  NOT NULL DEFAULT 0,
  CONSTRAINT "ProductDuration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductDuration_productId_months_key" ON "ProductDuration"("productId", "months");
CREATE INDEX        IF NOT EXISTS "ProductDuration_productId_active_idx" ON "ProductDuration"("productId", "active");
ALTER TABLE "ProductDuration" DROP CONSTRAINT IF EXISTS "ProductDuration_productId_fkey";
ALTER TABLE "ProductDuration" ADD  CONSTRAINT "ProductDuration_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Rank profiles (identity + the permissions that make a rank real) ───────
CREATE TABLE IF NOT EXISTS "RankProfile" (
  "id"          TEXT     NOT NULL,
  "key"         TEXT     NOT NULL,
  "name"        TEXT     NOT NULL,
  "order"       INTEGER  NOT NULL DEFAULT 0,
  "color"       TEXT     NOT NULL DEFAULT '#a855f7',
  "icon"        TEXT     NOT NULL DEFAULT '✦',
  "tagline"     TEXT     NOT NULL DEFAULT '',
  "perks"       TEXT     NOT NULL DEFAULT '[]',
  "permissions" TEXT     NOT NULL DEFAULT '[]',
  "commands"    TEXT     NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RankProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RankProfile_key_key" ON "RankProfile"("key");
CREATE INDEX        IF NOT EXISTS "RankProfile_order_idx" ON "RankProfile"("order");

-- ── Redeem codes + redemptions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RedeemCode" (
  "id"              TEXT     NOT NULL,
  "code"            TEXT     NOT NULL,
  "label"           TEXT     NOT NULL DEFAULT '',
  "kind"            TEXT     NOT NULL DEFAULT 'BUNDLE',
  "rankKey"         TEXT,
  "months"          INTEGER,
  "discountPercent" INTEGER  NOT NULL DEFAULT 0,
  "maxUses"         INTEGER  NOT NULL DEFAULT 1,
  "usedCount"       INTEGER  NOT NULL DEFAULT 0,
  "perUser"         INTEGER  NOT NULL DEFAULT 1,
  "expiresAt"       TIMESTAMP(3),
  "active"          BOOLEAN  NOT NULL DEFAULT true,
  "createdBy"       TEXT,
  "note"            TEXT     NOT NULL DEFAULT '',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RedeemCode_code_key" ON "RedeemCode"("code");
CREATE INDEX        IF NOT EXISTS "RedeemCode_active_idx" ON "RedeemCode"("active");

CREATE TABLE IF NOT EXISTS "RedeemRedemption" (
  "id"              TEXT     NOT NULL,
  "codeId"          TEXT     NOT NULL,
  "userId"          TEXT     NOT NULL,
  "orderId"         TEXT,
  "discountPercent" INTEGER  NOT NULL DEFAULT 0,
  "rankKey"         TEXT,
  "months"          INTEGER,
  "usedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedeemRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RedeemRedemption_codeId_userId_idx" ON "RedeemRedemption"("codeId", "userId");
CREATE INDEX IF NOT EXISTS "RedeemRedemption_userId_idx"        ON "RedeemRedemption"("userId");
ALTER TABLE "RedeemRedemption" DROP CONSTRAINT IF EXISTS "RedeemRedemption_codeId_fkey";
ALTER TABLE "RedeemRedemption" ADD  CONSTRAINT "RedeemRedemption_codeId_fkey"
  FOREIGN KEY ("codeId") REFERENCES "RedeemCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedeemRedemption" DROP CONSTRAINT IF EXISTS "RedeemRedemption_userId_fkey";
ALTER TABLE "RedeemRedemption" ADD  CONSTRAINT "RedeemRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── OrderItem: duration + custom design snapshots ──────────────────────────
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "durationMonths" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "durationDays"   INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "durationLabel"  TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "customTag"      TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "customDesign"   TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "redeemCode"     TEXT;

-- ── UserProduct: expiry + revocation bookkeeping ───────────────────────────
ALTER TABLE "UserProduct" ADD COLUMN IF NOT EXISTS "durationMonths"   INTEGER;
ALTER TABLE "UserProduct" ADD COLUMN IF NOT EXISTS "rankKey"          TEXT;
ALTER TABLE "UserProduct" ADD COLUMN IF NOT EXISTS "expiryNoticeAt"   TIMESTAMP(3);
ALTER TABLE "UserProduct" ADD COLUMN IF NOT EXISTS "revokedAt"        TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "UserProduct_expiresAt_active_idx" ON "UserProduct"("expiresAt", "active");
