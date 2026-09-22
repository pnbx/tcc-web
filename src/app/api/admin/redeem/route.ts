import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { generateRedeemCode, normalizeCode, describeCode } from "@/lib/redeem";
import { audit } from "@/lib/audit";

// Owner / developer panel: mint and manage redeem codes.
// Example the owner asked for: "mythic + ۱ ماه، ۱۰ نفر، ۱۰٪ تخفیف".

const createSchema = z.object({
  code: z.string().max(40).optional(),
  label: z.string().max(120).default(""),
  kind: z.enum(["RANK", "DISCOUNT", "BUNDLE"]).default("BUNDLE"),
  rankKey: z.string().max(40).nullable().optional(),
  months: z.number().int().min(1).max(24).nullable().optional(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  maxUses: z.number().int().min(1).max(10_000).default(1),
  perUser: z.number().int().min(1).max(50).default(1),
  expiresAt: z.string().max(40).nullable().optional(),
  note: z.string().max(300).default(""),
});

const patchSchema = z.object({
  id: z.string().min(4),
  active: z.boolean().optional(),
  label: z.string().max(120).optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  maxUses: z.number().int().min(1).max(10_000).optional(),
  perUser: z.number().int().min(1).max(50).optional(),
  months: z.number().int().min(1).max(24).nullable().optional(),
  expiresAt: z.string().max(40).nullable().optional(),
  note: z.string().max(300).optional(),
});

export async function GET() {
  try {
    await requirePermission("store.edit");
    const codes = await prisma.redeemCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { redemptions: { take: 5, orderBy: { usedAt: "desc" }, include: { user: { select: { username: true } } } } },
    });
    return jsonOk({
      codes: codes.map((c) => ({
        ...c,
        description: describeCode(c),
        remaining: Math.max(0, c.maxUses - c.usedCount),
        expired: Boolean(c.expiresAt && c.expiresAt.getTime() < Date.now()),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission("store.edit");
    const body = await parseBody(req, createSchema);

    const code = normalizeCode(body.code && body.code.length >= 4 ? body.code : generateRedeemCode());
    const existing = await prisma.redeemCode.findUnique({ where: { code } });
    if (existing) return jsonError("این کد قبلاً ساخته شده است.", 409);

    const row = await prisma.redeemCode.create({
      data: {
        code,
        label: body.label,
        kind: body.kind,
        rankKey: body.rankKey ?? null,
        months: body.months ?? null,
        discountPercent: body.discountPercent,
        maxUses: body.maxUses,
        perUser: body.perUser,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        note: body.note,
        createdBy: auth.user.username,
      },
    });

    await audit({
      actorId: auth.user.id,
      actorName: auth.user.username,
      action: "store.redeem_created",
      target: code,
      detail: { kind: row.kind, rank: row.rankKey, months: row.months, percent: row.discountPercent, uses: row.maxUses },
    });

    return jsonOk({ ok: true, code: row, description: describeCode(row) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission("store.edit");
    const body = await parseBody(req, patchSchema);
    const row = await prisma.redeemCode.update({
      where: { id: body.id },
      data: {
        active: body.active,
        label: body.label,
        discountPercent: body.discountPercent,
        maxUses: body.maxUses,
        perUser: body.perUser,
        months: body.months,
        expiresAt: body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(body.expiresAt) : null,
        note: body.note,
      },
    });
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "store.redeem_updated", target: row.code });
    return jsonOk({ ok: true, code: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission("store.edit");
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    const row = await prisma.redeemCode.update({ where: { id }, data: { active: false } });
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "store.redeem_disabled", target: row.code });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
