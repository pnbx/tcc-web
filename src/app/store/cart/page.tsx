"use client";

import Link from "next/link";
import { useCart, priceToman } from "@/components/cart";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default function CartPage() {
  const cart = useCart();

  return (
    <div className="min-h-screen">
      <SiteHeader authed />
      <main className="max-w-4xl mx-auto px-4 py-10 fade-up">
        <h1 className="font-display text-3xl font-black mb-2">سبد خرید</h1>
        <p className="text-sm text-[var(--c-text-dim)] mb-8">
          هر چند تا می‌خواهی انتخاب کن؛ همه را با یک پرداخت می‌خری.
        </p>

        {!cart.ready ? (
          <div className="card p-10 text-center text-[var(--c-text-dim)]">در حال بارگذاری…</div>
        ) : cart.items.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-[var(--c-text-dim)] mb-4">سبد خالی است.</p>
            <Link href="/store" className="btn btn-primary">رفتن به استور</Link>
          </div>
        ) : (
          <>
            <div className="card divide-y divide-[var(--c-line)]">
              {cart.items.map((item) => (
                <div key={item.key} className="p-4 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-bold truncate">{item.name}</div>
                    <div className="text-xs text-[var(--c-text-dim)] mt-0.5">
                      {item.label ? `مدت: ${item.label}` : null}
                      {item.months ? " · " : ""}
                      {item.customTag ? `تگ اختصاصی: ${item.customTag}` : null}
                    </div>
                    <div className="num text-sm mt-1 text-[var(--c-pink)]">{priceToman(item.unitPrice)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-ghost !py-1 !px-2.5" onClick={() => cart.setQuantity(item.key, item.quantity - 1)}>−</button>
                    <span className="num w-8 text-center">{item.quantity}</span>
                    <button className="btn btn-ghost !py-1 !px-2.5" onClick={() => cart.setQuantity(item.key, item.quantity + 1)}>+</button>
                  </div>
                  <button className="text-xs text-[var(--c-text-faint)] hover:text-[var(--c-pink)]" onClick={() => cart.remove(item.key)}>
                    حذف
                  </button>
                </div>
              ))}
            </div>

            <div className="card p-5 mt-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-[var(--c-text-dim)]">جمع سبد</div>
                <div className="num text-2xl font-black text-[var(--c-pink)]">{priceToman(cart.subtotal)}</div>
                <div className="text-[11px] text-[var(--c-text-faint)] mt-1">تخفیف و کد ریدیم در مرحله‌ی بعد اعمال می‌شود.</div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => cart.clear()}>خالی کردن</button>
                <Link href="/store/checkout" className="btn btn-primary">بررسی و پرداخت ←</Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
