"use client";

// Owner / developer panel: mint redeem codes.
// Example: رنک Mythic، ۱ ماهه، ۱۰ نفر، ۱۰٪ تخفیف  →  کد TCC-XXXX-XXXX

import { useCallback, useEffect, useState } from "react";

type CodeRow = {
  id: string;
  code: string;
  label: string;
  kind: string;
  rankKey: string | null;
  months: number | null;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  remaining: number;
  perUser: number;
  active: boolean;
  expired: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  description: string;
};

const RANK_KEYS = [
  "", "ember", "frost", "mystic", "lunar", "solar", "spencer", "amethyst",
  "nebula", "eclipse", "phoenix", "celestial", "eternal", "legend",
];

export function RedeemManager() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "",
    rankKey: "mythic",
    months: 1,
    discountPercent: 10,
    maxUses: 10,
    perUser: 1,
    note: "",
    code: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/redeem");
    const json = await res.json();
    const data = json?.data ?? json;
    setCodes(data?.codes ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const kind = form.rankKey && form.discountPercent > 0 ? "BUNDLE" : form.rankKey ? "RANK" : "DISCOUNT";
      const res = await fetch("/api/admin/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          kind,
          code: form.code || undefined,
          rankKey: form.rankKey || null,
          months: form.rankKey ? form.months : null,
        }),
      });
      const json = await res.json();
      const data = json?.data ?? json;
      if (!res.ok) {
        setMessage(typeof json?.error === "string" ? json.error : "ساخت کد ناموفق بود.");
        return;
      }
      setMessage(`کد ساخته شد: ${data.code.code} — ${data.description}`);
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: CodeRow) {
    await fetch("/api/admin/redeem", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, active: !row.active }),
    });
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-heading font-bold text-lg mb-4">ساخت کد ریدیم</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="رنک (خالی = فقط تخفیف)">
            <select className="input" value={form.rankKey} onChange={(e) => setForm({ ...form, rankKey: e.target.value })}>
              {RANK_KEYS.map((k) => (
                <option key={k} value={k}>{k || "— بدون رنک —"}</option>
              ))}
            </select>
          </Field>
          <Field label="مدت (ماه)">
            <input type="number" min={1} max={24} className="input num" value={form.months}
              onChange={(e) => setForm({ ...form, months: Number(e.target.value) })} />
          </Field>
          <Field label="درصد تخفیف">
            <input type="number" min={0} max={100} className="input num" value={form.discountPercent}
              onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })} />
          </Field>
          <Field label="تعداد نفرات (ظرفیت)">
            <input type="number" min={1} className="input num" value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })} />
          </Field>
          <Field label="سهم هر نفر">
            <input type="number" min={1} className="input num" value={form.perUser}
              onChange={(e) => setForm({ ...form, perUser: Number(e.target.value) })} />
          </Field>
          <Field label="کد دلخواه (خالی = تصادفی)">
            <input className="input ltr" placeholder="TCC-XXXX-XXXX" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="برچسب / توضیح">
            <input className="input" placeholder="مثلاً: هدیه‌ی رویداد" value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </Field>
          <Field label="یادداشت داخلی">
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
        <button className="btn btn-primary mt-5" onClick={create} disabled={busy}>
          {busy ? "…" : "ساخت کد"}
        </button>
        {message ? <div className="text-sm text-emerald-400 mt-3">{message}</div> : null}
      </div>

      <div className="card p-6">
        <h2 className="font-heading font-bold text-lg mb-4">کدهای موجود</h2>
        {codes.length === 0 ? (
          <p className="text-sm text-[var(--c-text-dim)]">هنوز کدی ساخته نشده.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--c-text-faint)]">
                <tr className="text-right">
                  <th className="py-2">کد</th>
                  <th className="py-2">پاداش</th>
                  <th className="py-2">استفاده</th>
                  <th className="py-2">سازنده</th>
                  <th className="py-2">وضعیت</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-line)]">
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 mono text-xs">{c.code}</td>
                    <td className="py-2 text-xs text-[var(--c-text-dim)]">{c.description}</td>
                    <td className="py-2 num text-xs">{c.usedCount}/{c.maxUses}</td>
                    <td className="py-2 text-xs">{c.createdBy ?? "—"}</td>
                    <td className="py-2 text-xs">
                      {c.active && !c.expired ? <span className="text-emerald-400">فعال</span> : <span className="text-[var(--c-text-faint)]">غیرفعال</span>}
                    </td>
                    <td className="py-2 text-xs">
                      <button className="btn btn-ghost !py-1 !px-2" onClick={() => toggle(c)}>
                        {c.active ? "غیرفعال کن" : "فعال کن"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
