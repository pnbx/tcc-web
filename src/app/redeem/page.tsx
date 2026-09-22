"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

type HistoryRow = {
  id: string;
  usedAt: string;
  discountPercent: number;
  rankKey: string | null;
  months: number | null;
  code: { code: string; label: string; kind: string };
};

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [credits, setCredits] = useState<{ id: string; percent: number; code: string }[]>([]);

  async function load() {
    const res = await fetch("/api/store/redeem");
    if (!res.ok) return;
    const data = await res.json();
    setHistory(data?.data?.history ?? data?.history ?? []);
    setCredits(data?.data?.credits ?? data?.credits ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/store/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      const payload = data?.data ?? data;
      if (!res.ok) {
        setMessage({ kind: "err", text: payload?.error?.message ?? payload?.error ?? "کد پذیرفته نشد." });
        return;
      }
      setMessage({ kind: "ok", text: payload.message ?? "انجام شد!" });
      setCode("");
      void load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader authed />
      <main className="max-w-3xl mx-auto px-4 py-10 fade-up">
        <h1 className="font-display text-3xl font-black mb-2">کد ریدیم</h1>
        <p className="text-sm text-[var(--c-text-dim)] mb-8">
          کدی که از رویدادها، حمایت‌ها یا پنل مدیریت گرفته‌ای را اینجا وارد کن. رنک‌ها مستقیم فعال می‌شوند و تخفیف‌ها در خرید بعدی خودکار اعمال می‌شوند.
        </p>

        <div className="card p-6">
          <label className="label" htmlFor="code">کد</label>
          <div className="flex gap-2">
            <input
              id="code"
              className="input flex-1 ltr"
              placeholder="TCC-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? "…" : "فعال‌سازی"}
            </button>
          </div>
          {message ? (
            <div className={`mt-4 text-sm ${message.kind === "ok" ? "text-emerald-400" : "text-[var(--c-pink)]"}`}>
              {message.kind === "ok" ? "✅ " : "⛔ "}
              {message.text}
            </div>
          ) : null}
        </div>

        {credits.length > 0 ? (
          <div className="card p-5 mt-6">
            <h2 className="font-heading font-bold mb-3">تخفیف‌های آماده</h2>
            <ul className="text-sm space-y-1 text-[var(--c-text-dim)]">
              {credits.map((c) => (
                <li key={c.id}>
                  🎟️ <b className="num">{c.percent}٪</b> — کد {c.code} (در خرید بعدی خودکار اعمال می‌شود)
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="card p-5 mt-6">
          <h2 className="font-heading font-bold mb-3">تاریخچه</h2>
          {history.length === 0 ? (
            <p className="text-sm text-[var(--c-text-dim)]">هنوز کدی استفاده نکرده‌ای.</p>
          ) : (
            <ul className="text-sm divide-y divide-[var(--c-line)]">
              {history.map((h) => (
                <li key={h.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="mono text-xs">{h.code.code}</span>
                  <span className="text-[var(--c-text-dim)] text-xs">
                    {h.rankKey ? `رنک ${h.rankKey}` : h.discountPercent ? `${h.discountPercent}٪ تخفیف` : h.code.label}
                  </span>
                  <span className="text-[var(--c-text-faint)] text-xs num">
                    {new Date(h.usedAt).toLocaleDateString("fa-IR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-center mt-8">
          <Link href="/store" className="text-sm text-[var(--c-pink)] hover:underline">← بازگشت به استور</Link>
        </div>
      </main>
    </div>
  );
}
