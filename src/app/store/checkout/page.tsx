"use client";

// Checkout = REVIEW then CONFIRM.
// Everything the member is about to buy (item, duration, price, perks, target
// account, discount, Telegram requirement) is shown before the pay button, and
// the numbers come from the server (`preview: true`), not from the basket.

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCart, priceToman } from "@/components/cart";
import { SiteHeader } from "@/components/SiteHeader";

type QuoteLine = {
  slug: string;
  name: string;
  kind: string;
  rankKey: string | null;
  rankName: string | null;
  quantity: number;
  unitPriceCents: number;
  months: number | null;
  label: string | null;
  perks: string[];
  customTag: string | null;
  lineTotalCents: number;
};

type Quote = {
  lines: QuoteLine[];
  subtotalCents: number;
  discountPercent: number;
  discountCents: number;
  totalCents: number;
  code: { code: string; label: string; kind: string } | null;
  notes: string[];
  telegramLinked: boolean;
  account: { username: string; uuid: string } | null;
};

function CheckoutInner() {
  const params = useSearchParams();
  const cart = useCart();
  const directSlug = params.get("slug");
  const seeded = useRef(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsTelegram, setNeedsTelegram] = useState(false);

  // a direct link (/store/checkout?slug=…) seeds the basket once
  useEffect(() => {
    if (!cart.ready || seeded.current) return;
    if (directSlug && !cart.items.some((i) => i.slug === directSlug)) {
      seeded.current = true;
      cart.add({ slug: directSlug, name: directSlug, kind: "PRODUCT", unitPrice: 0, quantity: 1 });
    }
  }, [cart, directSlug]);

  const body = useCallback(
    (preview: boolean, codeRaw?: string) => ({
      preview,
      redeemCode: codeRaw || undefined,
      targetUsername: target || undefined,
      customPrefix: cart.items[0]?.customPrefix,
      items: cart.items.map((i) => ({
        slug: i.slug,
        quantity: i.quantity,
        months: i.months,
        customTag: i.customTag,
        customDesign: i.customDesign,
      })),
    }),
    [cart.items, target],
  );

  const load = useCallback(
    async (codeRaw?: string) => {
      if (!cart.ready || cart.items.length === 0) return;
      setError(null);
      try {
        const res = await fetch("/api/store/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body(true, codeRaw)),
        });
        const json = await res.json();
        const data = json?.data ?? json;
        if (!res.ok) {
          setError(typeof json?.error === "string" ? json.error : (json?.error?.message ?? "خطا در محاسبه‌ی سفارش"));
          return;
        }
        setQuote(data as Quote);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [body, cart.ready, cart.items.length],
  );

  useEffect(() => {
    void load(appliedCode || undefined);
  }, [load, appliedCode]);

  async function confirmOrder() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body(false, appliedCode || undefined)),
      });
      const json = await res.json();
      const data = json?.data ?? json;
      if (res.status === 428) {
        setNeedsTelegram(true);
        setError(typeof json?.error === "string" ? json.error : "اول تلگرامت را وصل کن.");
        return;
      }
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : (json?.error?.message ?? "ساخت سفارش ناموفق بود"));
        return;
      }
      cart.clear();
      window.location.href = data.redirectUrl ?? data.resultUrl ?? `/store/result/${data.orderNumber}`;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const empty = cart.ready && cart.items.length === 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 fade-up">
      <h1 className="font-display text-3xl font-black mb-2">بررسی سفارش</h1>
      <p className="text-sm text-[var(--c-text-dim)] mb-8">
        این‌ها دقیقاً چیزهایی است که بعد از پرداخت روی حسابت اعمال می‌شود. اگر درست است تأیید کن.
      </p>

      {empty ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--c-text-dim)] mb-4">سبد خرید خالی است.</p>
          <Link href="/store" className="btn btn-primary">رفتن به استور</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* ── what you get ── */}
          <div className="space-y-4">
            {!quote && !error ? <div className="card p-8 text-center text-[var(--c-text-dim)]">در حال محاسبه…</div> : null}

            {quote?.lines.map((line) => (
              <div key={`${line.slug}-${line.months ?? 0}-${line.customTag ?? ""}`} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-heading font-bold">
                      {line.name}
                      {line.quantity > 1 ? <span className="num text-[var(--c-text-dim)]"> × {line.quantity}</span> : null}
                    </div>
                    <div className="text-xs text-[var(--c-text-dim)] mt-1 flex flex-wrap gap-2">
                      {line.label ? <span className="badge">{line.label}</span> : null}
                      {line.rankName ? <span className="badge badge-pink">رنک {line.rankName}</span> : null}
                      {line.customTag ? <span className="badge">تگ: {line.customTag}</span> : null}
                    </div>
                  </div>
                  <div className="num text-lg font-bold text-[var(--c-pink)] whitespace-nowrap">{priceToman(line.lineTotalCents)}</div>
                </div>

                {line.perks.length ? (
                  <>
                    <div className="text-[11px] text-[var(--c-text-faint)] mt-4 mb-1">مزیت‌هایی که فعال می‌شود:</div>
                    <ul className="grid sm:grid-cols-2 gap-1">
                      {line.perks.map((p) => (
                        <li key={p} className="text-xs text-[var(--c-text-dim)] flex gap-1.5">
                          <span className="text-[var(--c-pink)]">✓</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ))}

            {quote?.notes?.length ? (
              <div className="card p-4 text-xs text-[var(--c-text-dim)] space-y-1">
                {quote.notes.map((n) => (
                  <div key={n}>ℹ️ {n}</div>
                ))}
              </div>
            ) : null}
          </div>

          {/* ── money + requirements ── */}
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="font-heading font-bold mb-3">پرداخت</h2>

              <label className="label" htmlFor="target">اسم بازیکن گیرنده (اختیاری — برای هدیه)</label>
              <input
                id="target"
                className="input ltr mb-4"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. Farbod"
              />

              <label className="label" htmlFor="code">کد تخفیف یا ریدیم</label>
              <div className="flex items-center gap-2 mb-4">
                <input
                  id="code"
                  className="input flex-1 ltr"
                  placeholder="TCC-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button className="btn btn-ghost" type="button" onClick={() => setAppliedCode(code.trim())}>
                  اعمال
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <Row label="جمع" value={quote ? priceToman(quote.subtotalCents) : "—"} />
                {quote?.discountPercent ? (
                  <Row
                    label={`تخفیف${quote.code ? ` (${quote.code.code})` : ""}`}
                    value={`−${priceToman(quote.discountCents)} · ${quote.discountPercent}٪`}
                    accent
                  />
                ) : null}
                <div className="border-t hairline pt-2 flex items-center justify-between">
                  <span className="text-[var(--c-text-dim)]">قابل پرداخت</span>
                  <span className="num text-2xl font-black text-[var(--c-pink)]">{quote ? priceToman(quote.totalCents) : "—"}</span>
                </div>
                {quote && quote.totalCents === 0 ? (
                  <div className="text-xs text-emerald-400">این سفارش با تخفیف کامل، رایگان ثبت می‌شود.</div>
                ) : null}
              </div>

              <button className="btn btn-primary w-full mt-5" onClick={confirmOrder} disabled={busy || !quote}>
                {busy ? "در حال انتقال به درگاه…" : "تأیید و پرداخت"}
              </button>
              <div className="text-[11px] text-[var(--c-text-faint)] mt-2 text-center">
                پرداخت امن از طریق درگاه بانکی؛ محصولات فقط بعد از تأیید درگاه اعمال می‌شوند.
              </div>
            </div>

            <div className="card p-5 text-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--c-text-dim)]">حساب ماینکرفت</span>
                <span className="num">{quote?.account?.username ?? "وصل نشده"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--c-text-dim)]">تلگرام</span>
                {quote?.telegramLinked ? (
                  <span className="text-emerald-400">وصل است ✓</span>
                ) : (
                  <Link href="/connect-telegram" className="badge badge-pink">وصل کن (الزامی)</Link>
                )}
              </div>
              {quote && !quote.account ? (
                <div className="text-xs text-amber-400">
                  بدون حساب ماینکرفت خریدت ذخیره می‌شود ولی تا وصل نکنی روی بازی اعمال نمی‌شود.
                  <Link href="/dashboard/profile" className="underline ms-1">وصل کردن حساب</Link>
                </div>
              ) : null}
              {quote && !quote.telegramLinked ? (
                <div className="text-xs text-amber-400">تلگرام برای اطلاع‌رسانی پایان رنک الزامی است.</div>
              ) : null}
            </div>

            {needsTelegram ? (
              <Link href="/connect-telegram" className="btn btn-primary w-full">اتصال تلگرام ←</Link>
            ) : null}

            {error ? <div className="card p-4 text-sm text-[var(--c-pink)]">{error}</div> : null}

            <div className="text-center">
              <Link href="/store/cart" className="text-sm text-[var(--c-pink)] hover:underline">← بازگشت به سبد</Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--c-text-dim)]">{label}</span>
      <span className={`num ${accent ? "text-emerald-400" : ""}`}>{value}</span>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader authed />
      <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-16"><div className="skeleton w-full h-64" /></div>}>
        <CheckoutInner />
      </Suspense>
    </div>
  );
}
