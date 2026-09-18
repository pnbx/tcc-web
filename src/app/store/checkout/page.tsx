"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CheckoutInner() {
  const params = useSearchParams();
  const slug = params.get("slug");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [target, setTarget] = useState("");

  async function pay() {
    setState("loading");
    setError("");
    const res = await fetch("/api/store/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: slug ? [{ slug, quantity: 1 }] : [], targetUsername: target || undefined }),
    });
    const json = await res.json();
    if (json.ok && json.data.redirectUrl) {
      window.location.href = json.data.redirectUrl;
    } else {
      setState("error");
      setError(json.error ?? "خطا در ایجاد پرداخت");
    }
  }

  return (
    <div className="max-w-lg mx-auto card p-8">
      <h1 className="font-display text-xl font-black mb-2">تسویه حساب</h1>
      <p className="text-sm text-[var(--c-text-dim)] mb-6">
        محصول: <span className="mono">{slug}</span>
      </p>
      <label className="label" htmlFor="target">نام کاربری ماینکرفت گیرنده (اختیاری)</label>
      <input
        id="target"
        className="input ltr mb-6"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="e.g. Farbod"
      />
      {error && <div className="badge badge-red mb-4">{error}</div>}
      <button className="btn btn-primary w-full !py-3" onClick={pay} disabled={state === "loading"}>
        {state === "loading" ? "در حال اتصال به درگاه…" : "ادامه و پرداخت"}
      </button>
      <p className="text-xs text-[var(--c-text-faint)] mt-4 leading-5">
        پرداخت به‌صورت سروربه‌سرور تأیید می‌شود؛ محصولات فقط پس از تأیید درگاه اعمال می‌شوند.
      </p>
      <div className="mt-4 text-center">
        <Link href="/store" className="text-sm text-[var(--c-pink)] hover:underline">← بازگشت به استور</Link>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <Suspense fallback={<div className="skeleton w-96 h-72" />}>
        <CheckoutInner />
      </Suspense>
    </main>
  );
}
