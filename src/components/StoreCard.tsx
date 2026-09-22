"use client";

// Product card + duration picker + "add to basket".
// Shows what the member gets (perks) BEFORE they confirm — the requirement was
// "let the member see the info before confirming to buy".

import Link from "next/link";
import { useState } from "react";
import { useCart, priceToman } from "./cart";

export type DurationOption = { months: number; days: number; priceCents: number; label: string; badge?: string };

export type ProductCardData = {
  slug: string;
  name: string;
  description: string;
  kind: string;
  rankKey?: string | null;
  priceCents: number;
  durations: DurationOption[];
  perks: string[];
  categoryName: string;
};

export function AddToCart({ product, authed }: { product: ProductCardData; authed: boolean }) {
  const cart = useCart();
  const [months, setMonths] = useState<number | null>(product.durations[0]?.months ?? null);
  const [added, setAdded] = useState(false);

  const chosen = product.durations.find((d) => d.months === months) ?? null;
  const price = chosen?.priceCents ?? product.priceCents;

  if (!authed) {
    return (
      <Link href="/login" className="btn btn-ghost !py-1.5">
        ورود برای خرید
      </Link>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {product.durations.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {product.durations.map((d) => (
            <button
              key={d.months}
              type="button"
              onClick={() => setMonths(d.months)}
              className={`badge ${months === d.months ? "badge-pink" : ""}`}
              title={priceToman(d.priceCents)}
            >
              {d.label || `${d.months} ماهه`}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="num text-lg font-bold text-[var(--c-pink)]">{priceToman(price)}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-primary !py-1.5"
            onClick={() => {
              cart.add({
                slug: product.slug,
                name: product.name,
                kind: product.kind,
                rankKey: product.rankKey ?? null,
                months: chosen?.months,
                label: chosen?.label,
                unitPrice: price,
                quantity: 1,
              });
              setAdded(true);
              setTimeout(() => setAdded(false), 1600);
            }}
          >
            {added ? "✓ اضافه شد" : "افزودن به سبد"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PerkList({ perks, limit = 4 }: { perks: string[]; limit?: number }) {
  if (!perks.length) return null;
  return (
    <ul className="text-xs text-[var(--c-text-dim)] space-y-1 mt-2">
      {perks.slice(0, limit).map((p) => (
        <li key={p} className="flex gap-1.5">
          <span className="text-[var(--c-pink)]">▸</span>
          <span>{p}</span>
        </li>
      ))}
      {perks.length > limit ? <li className="text-[var(--c-text-faint)]">+{perks.length - limit} مزیت دیگر</li> : null}
    </ul>
  );
}

export function CartBadge() {
  const cart = useCart();
  if (!cart.ready || cart.count === 0) return null;
  return (
    <Link href="/store/cart" className="btn btn-primary !py-1.5 relative">
      🛒 سبد
      <span className="num absolute -top-2 -left-2 bg-[var(--c-pink)] text-black text-[10px] font-black rounded-full w-5 h-5 grid place-items-center">
        {cart.count}
      </span>
    </Link>
  );
}
