"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewsEditor({
  categories,
  canPublish,
}: {
  categories: { slug: string; name: string }[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    categorySlug: categories[0]?.slug ?? "",
    scheduledFor: "",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(publish: boolean) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        excerpt: form.excerpt || undefined,
        content: form.content,
        categorySlug: form.categorySlug || undefined,
        publishNow: publish,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) {
      setMsg("مقاله ساخته شد ✓");
      setForm({ ...form, title: "", excerpt: "", content: "" });
      router.refresh();
    } else {
      setMsg(json.error ?? "خطا");
    }
  }

  return (
    <section className="card p-6 max-w-3xl">
      <h2 className="font-heading font-bold mb-4">مقاله جدید</h2>
      <div className="space-y-4">
        <div>
          <label className="label">عنوان</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div>
          <label className="label">خلاصه</label>
          <input className="input" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
        </div>
        <div>
          <label className="label">متن (پاراگراف‌ها را با خط خالی جدا کنید)</label>
          <textarea className="textarea" rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">دسته</label>
            <select className="select" value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}>
              <option value="">— بدون دسته —</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">زمان‌بندی انتشار (اختیاری)</label>
            <input
              type="datetime-local"
              className="input"
              value={form.scheduledFor}
              onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
            />
          </div>
        </div>
        {msg && <div className="badge badge-green">{msg}</div>}
        <div className="flex gap-3">
          <button className="btn btn-ghost" disabled={busy} onClick={() => submit(false)}>ذخیره پیش‌نویس</button>
          {canPublish && (
            <button className="btn btn-primary" disabled={busy} onClick={() => submit(true)}>انتشار فوری</button>
          )}
        </div>
      </div>
    </section>
  );
}
