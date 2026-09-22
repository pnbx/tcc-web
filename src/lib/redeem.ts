// ── Redeem codes ────────────────────────────────────────────────────────────
// An owner/developer creates a bundle — e.g. "mythic + ۱ ماه، ۱۰ نفر، ۱۰٪ تخفیف".
// A member redeems it and either pays less (discount) or receives the rank for
// free (a zero-amount PAID order, so the normal fulfilment path — permissions,
// expiry tracking, Telegram receipt — runs exactly the same way).

import { prisma } from "@/lib/db";
import { randomBytes } from "node:crypto";

export type CodeRow = {
  id: string;
  code: string;
  label: string;
  kind: string;
  rankKey: string | null;
  months: number | null;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  perUser: number;
  expiresAt: Date | null;
  active: boolean;
  note: string;
  createdBy: string | null;
  createdAt: Date;
};

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** "TCC-9F3K-M2QX" — readable blocks, no ambiguous characters. */
export function generateRedeemCode(prefix = "TCC"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  return `${prefix}-${pick(4)}-${pick(4)}`;
}

export type CodeCheck =
  | { ok: true; code: CodeRow; mine: number; remaining: number }
  | { ok: false; error: string; code?: CodeRow };

export async function checkCode(raw: string, userId: string): Promise<CodeCheck> {
  const code = normalizeCode(raw);
  if (code.length < 4) return { ok: false, error: "کد را کامل وارد کن." };

  const row = await prisma.redeemCode.findUnique({ where: { code } });
  if (!row) return { ok: false, error: "این کد وجود ندارد." };
  if (!row.active) return { ok: false, error: "این کد غیرفعال شده است.", code: row };
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "این کد منقضی شده است.", code: row };
  }
  if (row.usedCount >= row.maxUses) {
    return { ok: false, error: "ظرفیت این کد پر شده است.", code: row };
  }

  const mine = await prisma.redeemRedemption.count({ where: { codeId: row.id, userId } });
  if (mine >= row.perUser) {
    return { ok: false, error: "تو قبلاً از این کد استفاده کرده‌ای.", code: row };
  }

  return { ok: true, code: row as CodeRow, mine, remaining: row.maxUses - row.usedCount };
}

/** Reserve one use (checkout) — released again if the payment fails. */
export async function reserveCode(input: {
  codeId: string;
  userId: string;
  orderId?: string | null;
  discountPercent: number;
  rankKey?: string | null;
  months?: number | null;
}) {
  const [, redemption] = await prisma.$transaction([
    prisma.redeemCode.update({ where: { id: input.codeId }, data: { usedCount: { increment: 1 } } }),
    prisma.redeemRedemption.create({
      data: {
        codeId: input.codeId,
        userId: input.userId,
        orderId: input.orderId ?? null,
        discountPercent: input.discountPercent,
        rankKey: input.rankKey ?? null,
        months: input.months ?? null,
      },
    }),
  ]);
  return redemption;
}

export async function releaseCode(orderId: string): Promise<number> {
  const rows = await prisma.redeemRedemption.findMany({ where: { orderId } });
  for (const r of rows) {
    await prisma.redeemCode.update({ where: { id: r.codeId }, data: { usedCount: { decrement: 1 } } }).catch(() => undefined);
  }
  if (rows.length) await prisma.redeemRedemption.deleteMany({ where: { orderId } });
  return rows.length;
}

export async function myRedemptions(userId: string) {
  return prisma.redeemRedemption.findMany({
    where: { userId },
    orderBy: { usedAt: "desc" },
    take: 20,
    include: { code: { select: { code: true, label: true, kind: true, rankKey: true, months: true, discountPercent: true } } },
  });
}

export function describeCode(row: Pick<CodeRow, "kind" | "rankKey" | "months" | "discountPercent" | "label">): string {
  const bits: string[] = [];
  if (row.rankKey) bits.push(`رنک ${row.rankKey}${row.months ? ` — ${row.months} ماهه` : ""}`);
  if (row.discountPercent > 0) bits.push(`${row.discountPercent}٪ تخفیف`);
  if (row.label) bits.push(row.label);
  return bits.length ? bits.join(" + ") : "پاداش ویژه";
}
