"use client";

import { useState } from "react";

export function AdminTiersClient({
  categories,
  canAssign,
  canCreate,
}: {
  categories: { key: string; name: string; tiers: string[] }[];
  canAssign: boolean;
  canCreate: boolean;
}) {
  const [msg, setMsg] = useState("");
  const [assign, setAssign] = useState({ username: "", categoryKey: categories[0]?.key ?? "", tierName: "", region: "", note: "" });
  const [newTier, setNewTier] = useState({ categoryKey: categories[0]?.key ?? "", name: "" });

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/tiers/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: assign.username,
        categoryKey: assign.categoryKey,
        tierName: assign.tierName,
        region: assign.region || undefined,
        note: assign.note || undefined,
      }),
    });
    const json = await res.json();
    setMsg(json.ok ? `تیر ${assign.tierName} به ${assign.username} اختصاص یافت ✓` : json.error ?? "خطا");
  }

  async function submitTier(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/tiers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "tier", categoryKey: newTier.categoryKey, name: newTier.name }),
    });
    const json = await res.json();
    setMsg(json.ok ? "تیر ساخته شد ✓" : json.error ?? "خطا");
  }

  const tierOptions = categories.find((c) => c.key === assign.categoryKey)?.tiers ?? [];

  return (
    <div className="fade-up space-y-8 max-w-2xl">
      {canAssign && (
        <section className="card p-6">
          <h2 className="font-heading font-bold mb-4">اختصاص تیر</h2>
          <form onSubmit={submitAssign} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">نام بازیکن</label>
                <input className="input ltr" value={assign.username} onChange={(e) => setAssign({ ...assign, username: e.target.value })} required />
              </div>
              <div>
                <label className="label">دسته</label>
                <select className="select" value={assign.categoryKey} onChange={(e) => setAssign({ ...assign, categoryKey: e.target.value, tierName: "" })}>
                  {categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">تیر</label>
                <select className="select ltr" value={assign.tierName} onChange={(e) => setAssign({ ...assign, tierName: e.target.value })} required>
                  <option value="">انتخاب…</option>
                  {tierOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">ریجن (اختیاری)</label>
                <input className="input ltr !w-28" maxLength={10} value={assign.region} onChange={(e) => setAssign({ ...assign, region: e.target.value })} placeholder="EU" />
              </div>
            </div>
            <div>
              <label className="label">یادداشت (ثبت در تاریخچه)</label>
              <textarea className="textarea" rows={2} value={assign.note} onChange={(e) => setAssign({ ...assign, note: e.target.value })} />
            </div>
            <button className="btn btn-primary">اختصاص تیر</button>
          </form>
        </section>
      )}

      {canCreate && (
        <section className="card p-6">
          <h2 className="font-heading font-bold mb-4">تیر جدید</h2>
          <form onSubmit={submitTier} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label">دسته</label>
              <select className="select" value={newTier.categoryKey} onChange={(e) => setNewTier({ ...newTier, categoryKey: e.target.value })}>
                {categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">نام تیر (مثل LT2)</label>
              <input className="input ltr !w-32" maxLength={10} value={newTier.name} onChange={(e) => setNewTier({ ...newTier, name: e.target.value })} required />
            </div>
            <button className="btn btn-purple">ایجاد</button>
          </form>
          <p className="text-xs text-[var(--c-text-faint)] mt-3">
            تیرها به انتهای دسته اضافه می‌شوند؛ ترتیب در پایگاه داده قابل ویرایش است.
          </p>
        </section>
      )}

      {msg && <div className="badge badge-green">{msg}</div>}
    </div>
  );
}
