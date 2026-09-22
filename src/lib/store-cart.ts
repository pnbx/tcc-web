// ── Cart pricing ────────────────────────────────────────────────────────────
// One implementation shared by the review screen and the checkout API, so the
// numbers a member sees before confirming are exactly the numbers charged.
// Nothing here trusts the browser: prices come from the products table, the
// chosen duration comes from ProductDuration, and discounts come from a
// redeem code the member actually holds.

import { prisma } from "@/lib/db";
import { rankByKey } from "@/lib/ranks";
import { checkCode, type CodeRow } from "@/lib/redeem";

export type CartLine = {
  slug: string;
  quantity?: number;
  months?: number;
  /** AI-designed custom tag + design for TAG products */
  customTag?: string | null;
  customDesign?: string | null;
};

export type PricedLine = {
  productId: string;
  slug: string;
  name: string;
  kind: string;
  rankKey: string | null;
  rankName: string | null;
  quantity: number;
  unitPriceCents: number;
  months: number | null;
  days: number | null;
  label: string | null;
  perks: string[];
  customTag: string | null;
  customDesign: string | null;
  lineTotalCents: number;
};

export type Priced = {
  lines: PricedLine[];
  subtotalCents: number;
  discountPercent: number;
  discountCents: number;
  totalCents: number;
  code: { id: string; code: string; label: string; kind: string; rankKey: string | null; months: number | null } | null;
  /** a discount credit already redeemed on /redeem and not yet spent */
  creditRedemptionId: string | null;
  notes: string[];
};

export type PriceResult = { ok: true; priced: Priced } | { ok: false; error: string };

function jsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function priceCart(
  input: CartLine[],
  opts: { userId: string; codeRaw?: string | null },
): Promise<PriceResult> {
  if (input.length === 0) return { ok: false, error: "سبد خرید خالی است." };

  const slugs = [...new Set(input.map((l) => l.slug))];
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs }, available: true },
    include: { durations: { where: { active: true }, orderBy: { months: "asc" } } },
  });
  if (products.length !== slugs.length) return { ok: false, error: "برخی محصولات نامعتبر یا ناموجود هستند." };

  const notes: string[] = [];
  const lines: PricedLine[] = [];

  for (const line of input) {
    const product = products.find((p) => p.slug === line.slug)!;
    const quantity = Math.min(10, Math.max(1, line.quantity ?? 1));
    const duration = product.durations.length
      ? product.durations.find((d) => d.months === line.months) ?? product.durations[0]
      : null;
    if (product.durations.length && line.months && !product.durations.some((d) => d.months === line.months)) {
      return { ok: false, error: `مدت انتخاب‌شده برای ${product.name} موجود نیست.` };
    }

    const unitPriceCents = duration ? duration.priceCents : product.priceCents;
    const rank = product.rankKey ? rankByKey(product.rankKey) : undefined;

    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      kind: product.kind,
      rankKey: product.rankKey ?? null,
      rankName: rank?.name ?? null,
      quantity,
      unitPriceCents,
      months: duration?.months ?? null,
      days: duration?.days ?? null,
      label: duration?.label ?? null,
      perks: [...jsonList(product.perks), ...(rank?.perks ?? [])].slice(0, 12),
      customTag: line.customTag ?? null,
      customDesign: line.customDesign ?? null,
      lineTotalCents: unitPriceCents * quantity,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);

  // A discount already redeemed on /redeem (orderId still null) is spent here.
  let discountPercent = 0;
  let code: Priced["code"] = null;
  let creditRedemptionId: string | null = null;

  if (opts.codeRaw) {
    const check = await checkCode(opts.codeRaw, opts.userId);
    if (!check.ok) return { ok: false, error: check.error };
    const row: CodeRow = check.code;
    discountPercent = row.discountPercent;
    code = { id: row.id, code: row.code, label: row.label, kind: row.kind, rankKey: row.rankKey, months: row.months };
    if (row.kind === "RANK") {
      notes.push("این کد رنک هدیه است؛ برای دریافت آن به صفحه‌ی ریدیم برو.");
      discountPercent = 0;
    }
  } else {
    const credit = await prisma.redeemRedemption.findFirst({
      where: { userId: opts.userId, orderId: null, discountPercent: { gt: 0 } },
      orderBy: { usedAt: "desc" },
      include: { code: true },
    });
    if (credit) {
      creditRedemptionId = credit.id;
      discountPercent = credit.discountPercent;
      code = {
        id: credit.code.id,
        code: credit.code.code,
        label: credit.code.label,
        kind: credit.code.kind,
        rankKey: credit.code.rankKey,
        months: credit.code.months,
      };
      notes.push(`کد ${credit.code.code} به‌صورت خودکار روی این سفارش اعمال شد.`);
    }
  }

  const discountCents = Math.round((subtotalCents * discountPercent) / 100);
  const totalCents = Math.max(0, subtotalCents - discountCents);

  return {
    ok: true,
    priced: { lines, subtotalCents, discountPercent, discountCents, totalCents, code, creditRedemptionId, notes },
  };
}
