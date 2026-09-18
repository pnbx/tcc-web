-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TierHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "minecraftAccountId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "fromTierId" TEXT,
    "toTierId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TierHistory_minecraftAccountId_fkey" FOREIGN KEY ("minecraftAccountId") REFERENCES "MinecraftAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TierHistory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TierCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TierHistory_fromTierId_fkey" FOREIGN KEY ("fromTierId") REFERENCES "Tier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TierHistory_toTierId_fkey" FOREIGN KEY ("toTierId") REFERENCES "Tier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TierHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TierHistory" ("categoryId", "createdAt", "createdById", "fromTierId", "id", "minecraftAccountId", "note", "toTierId") SELECT "categoryId", "createdAt", "createdById", "fromTierId", "id", "minecraftAccountId", "note", "toTierId" FROM "TierHistory";
DROP TABLE "TierHistory";
ALTER TABLE "new_TierHistory" RENAME TO "TierHistory";
CREATE INDEX "TierHistory_minecraftAccountId_createdAt_idx" ON "TierHistory"("minecraftAccountId", "createdAt");
CREATE INDEX "TierHistory_categoryId_idx" ON "TierHistory"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
