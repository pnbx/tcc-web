"use client";

import { useCallback, useEffect, useState } from "react";

type Product = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  kind: string;
  available: boolean;
  category: { name: string };
};

export function AdminStoreClient({ canEdit }: { canEdit: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/store/products");
    const json = await res.json();
    if (json.ok) setProducts(json.data.products);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(p: Product) {
    const res = await fetch("/api/store/products", {
      method: canEdit ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: p.slug, name: p.name, description: p.name, priceCents: p.priceCents, categorySlug: "ranks", available: !p.available }),
    });
    const json = await res.json();
    setMsg(json.ok ? "به‌روزرسانی شد ✓" : json.error ?? "خطا");
    load();
  }

  return (
    <div className="fade-up space-y-6">
      <h1 className="font-display text-2xl font-black">مدیریت استور</h1>
      {msg && <div className="badge badge-green">{msg}</div>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>محصول</th>
              <th>دسته</th>
              <th>نوع</th>
              <th>قیمت</th>
              <th>وضعیت</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="font-ui font-semibold">{p.name} <span className="mono text-[10px] text-[var(--c-text-faint)]">{p.slug}</span></td>
                <td>{p.category.name}</td>
                <td className="mono text-xs">{p.kind}</td>
                <td className="num">{p.priceCents.toLocaleString("en-US")}</td>
                <td>
                  <span className={`badge ${p.available ? "badge-green" : "badge-red"}`}>{p.available ? "فعال" : "غیرفعال"}</span>
                </td>
                {canEdit && (
                  <td>
                    <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => toggle(p)}>
                      {p.available ? "غیرفعال‌سازی" : "فعال‌سازی"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--c-text-faint)]">
        ایجاد و ویرایش کامل محصولات از طریق POST /api/store/products انجام می‌شود (فرم کامل در نسخه بعدی پنل).
      </p>
    </div>
  );
}
