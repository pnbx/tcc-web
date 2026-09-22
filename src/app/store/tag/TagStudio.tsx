"use client";

// The rank/tag assistant: pick the rank you want, describe the tag you want
// beside your name, and the AI builds it — with server-side moderation that
// refuses 18+/slur/impersonation requests.

import Link from "next/link";
import { useState } from "react";
import { useCart, priceToman } from "@/components/cart";

export type StudioRank = {
  slug: string;
  name: string;
  rankKey: string;
  color: string;
  icon: string;
  tagline: string;
  perks: string[];
  durations: { months: number; days: number; priceCents: number; label: string }[];
};

type Design = {
  tag: string;
  effect: string;
  colors: string[];
  bold: boolean;
  miniMessage: string;
  preview: { text: string; color?: string; bold?: boolean }[];
  note: string;
};

export function TagStudio({ ranks }: { ranks: StudioRank[] }) {
  const cart = useCart();
  const [rankKey, setRankKey] = useState(ranks[0]?.rankKey ?? "");
  const [months, setMonths] = useState<number | null>(ranks[0]?.durations[0]?.months ?? null);
  const [request, setRequest] = useState("");
  const [design, setDesign] = useState<Design | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  const rank = ranks.find((r) => r.rankKey === rankKey);
  const duration = rank?.durations.find((d) => d.months === months) ?? rank?.durations[0] ?? null;
  const price = duration?.priceCents ?? 0;

  async function design_it() {
    setBusy(true);
    setError(null);
    setRefusal(null);
    setDesign(null);
    try {
      const res = await fetch("/api/store/rank-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, rankKey }),
      });
      const json = await res.json();
      const data = json?.data ?? json;
      if (!res.ok) {
        const msg = typeof json?.error === "string" ? json.error : (json?.error?.message ?? "دستیار جواب نداد.");
        if (res.status === 422) setRefusal(msg);
        else setError(msg);
        return;
      }
      setDesign(data.design as Design);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
      {/* ── builder ── */}
      <div className="space-y-5">
        <div className="card p-5">
          <div className="label mb-2">۱. رنکی که می‌خواهی</div>
          <div className="flex flex-wrap gap-2">
            {ranks.map((r) => (
              <button
                key={r.rankKey}
                type="button"
                onClick={() => {
                  setRankKey(r.rankKey);
                  setMonths(r.durations[0]?.months ?? null);
                  setDesign(null);
                }}
                className={`badge ${rankKey === r.rankKey ? "badge-pink" : ""}`}
                style={rankKey === r.rankKey ? { borderColor: r.color } : undefined}
              >
                {r.icon} {r.name}
              </button>
            ))}
          </div>
          {rank ? <div className="text-xs text-[var(--c-text-dim)] mt-3">{rank.tagline}</div> : null}
        </div>

        {rank && rank.durations.length ? (
          <div className="card p-5">
            <div className="label mb-2">۲. مدت</div>
            <div className="flex flex-wrap gap-2">
              {rank.durations.map((d) => (
                <button
                  key={d.months}
                  type="button"
                  onClick={() => setMonths(d.months)}
                  className={`badge ${months === d.months ? "badge-pink" : ""}`}
                >
                  {d.label || `${d.months} ماهه`} — {priceToman(d.priceCents)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card p-5">
          <div className="label mb-2">۳. تگ کنار اسمت را توصیف کن</div>
          <textarea
            className="input min-h-24"
            placeholder="مثلاً: تگم بشه GOD، طلایی با گرادیانت به قرمز و بولد"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            maxLength={400}
          />
          <button className="btn btn-primary w-full mt-3" onClick={design_it} disabled={busy || request.trim().length < 2}>
            {busy ? "دستیار در حال طراحی…" : "✦ بسازش"}
          </button>
          <div className="text-[11px] text-[var(--c-text-faint)] mt-2 leading-5">
            دستیار فقط اسم‌های محترمانه را می‌سازد؛ اسم‌های +۱۸، توهین‌آمیز یا جعل هویت مدیران رد می‌شوند.
          </div>
        </div>
      </div>

      {/* ── result ── */}
      <div className="space-y-5">
        <div className="card p-5">
          <div className="label mb-3">پیش‌نمایش</div>

          {refusal ? (
            <div className="text-sm text-[var(--c-pink)] leading-6">⛔ {refusal}</div>
          ) : error ? (
            <div className="text-sm text-amber-400 leading-6">{error}</div>
          ) : !design ? (
            <div className="text-sm text-[var(--c-text-dim)]">هنوز چیزی طراحی نشده. توصیفت را بنویس و «بسازش» را بزن.</div>
          ) : (
            <>
              <div className="bg-[rgba(0,0,0,0.35)] rounded-lg p-4 mb-4 flex items-center gap-2" dir="ltr">
                <span className="badge" style={{ borderColor: ranks.find((r) => r.rankKey === rankKey)?.color }}>
                  {ranks.find((r) => r.rankKey === rankKey)?.name}
                </span>
                <span className="text-sm text-[var(--c-text-dim)]" dir="ltr">
                  {ranks.find((r) => r.rankKey === rankKey)?.name}:
                </span>
                <span
                  className="font-black text-lg"
                  style={{
                    background: design.preview?.[0]?.color?.startsWith("linear-gradient") ? design.preview[0].color : undefined,
                    color: design.preview?.[0]?.color?.startsWith("#") ? design.preview[0].color : undefined,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: design.preview?.[0]?.color?.startsWith("linear-gradient") ? "transparent" : undefined,
                  }}
                  dir="ltr"
                >
                  {design.tag}
                </span>
              </div>

              <div className="text-xs text-[var(--c-text-dim)] mb-4">{design.note}</div>

              <div className="flex items-center justify-between mb-4">
                <span className="num text-lg font-bold text-[var(--c-pink)]">{priceToman(price)}</span>
                <span className="badge">{duration?.label || (months ? `${months} ماهه` : "")}</span>
              </div>

              <button
                className="btn btn-primary w-full"
                onClick={() => {
                  if (!rank) return;
                  cart.add({
                    slug: rank.slug,
                    name: `${rank.name} + تگ ${design.tag}`,
                    kind: "TAG",
                    rankKey: rank.rankKey,
                    months: duration?.months,
                    label: duration?.label,
                    unitPrice: price,
                    quantity: 1,
                    customTag: design.tag,
                    customDesign: JSON.stringify(design),
                  });
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1800);
                }}
              >
                {added ? "✓ به سبد اضافه شد" : "افزودن به سبد"}
              </button>
              <Link href="/store/cart" className="btn btn-ghost w-full mt-2">دیدن سبد</Link>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="label mb-2">مزیت‌های این رنک</div>
          <ul className="text-xs text-[var(--c-text-dim)] space-y-1">
            {(rank?.perks ?? []).map((p) => (
              <li key={p} className="flex gap-1.5">
                <span className="text-[var(--c-pink)]">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
