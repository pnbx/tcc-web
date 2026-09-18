"use client";

import { useState } from "react";

const FONT_OPTIONS = ["Dana", "Peyda", "Yekan Bakh", "Vazirmatn", "Estedad"];
const SLOTS = [
  ["display", "فونت نمایش (Hero)"],
  ["heading", "فونت تیترها"],
  ["ui", "فونت رابط کاربری"],
  ["body", "فونت متن"],
  ["mono", "فونت فنی/کنسول"],
] as const;

type Settings = {
  fonts: Record<string, string>;
  storeEnabled: boolean;
  heroHeadline: string;
  heroSubline: string;
  discordUrl: string | null;
};

export function OwnerSettingsClient({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setMsg(json.ok ? "ذخیره شد — کل سایت از فونت‌های جدید پیروی می‌کند ✓" : json.error ?? "خطا");
  }

  return (
    <div className="fade-up max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-black">تنظیمات پلتفرم</h1>

      <form onSubmit={save} className="space-y-6">
        <section className="card p-6">
          <h2 className="font-heading font-bold mb-1">تایپوگرافی</h2>
          <p className="text-xs text-[var(--c-text-faint)] mb-4 leading-5">
            فونت‌های تجاری (Peyda، Yekan Bakh، Dana) فقط وقتی بارگذاری می‌شوند که فایل‌های woff2
            دارای مجوز در مسیر <span className="mono">public/fonts/</span> قرار داشته باشند.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {SLOTS.map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <select
                  className="select"
                  value={form.fonts[key] ?? "Vazirmatn"}
                  onChange={(e) => setForm({ ...form, fonts: { ...form.fonts, [key]: e.target.value } })}
                >
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="font-heading font-bold">صفحه اصلی</h2>
          <div>
            <label className="label">تیتر اصلی</label>
            <input className="input" value={form.heroHeadline} onChange={(e) => setForm({ ...form, heroHeadline: e.target.value })} />
          </div>
          <div>
            <label className="label">زیرتیتر</label>
            <textarea className="textarea" rows={2} value={form.heroSubline} onChange={(e) => setForm({ ...form, heroSubline: e.target.value })} />
          </div>
          <div>
            <label className="label">لینک دیسکورد (اختیاری)</label>
            <input className="input ltr" value={form.discordUrl ?? ""} onChange={(e) => setForm({ ...form, discordUrl: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={form.storeEnabled} onChange={(e) => setForm({ ...form, storeEnabled: e.target.checked })} />
            استور فعال باشد
          </label>
        </section>

        {msg && <div className="badge badge-green">{msg}</div>}
        <button className="btn btn-primary">ذخیره تنظیمات</button>
      </form>
    </div>
  );
}
