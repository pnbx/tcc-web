"use client";

import { useState } from "react";

// Buy button for the prefix studio: the server re-validates and re-renders the
// design, so the client only carries the slug + the design string.
export function PrefixBuy({ slug, design, canBuy }: { slug: string; design: string; canBuy: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function buy() {
    setState("loading");
    setError("");
    const res = await fetch("/api/store/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ slug, quantity: 1 }], customPrefix: design }),
    });
    const json = await res.json();
    if (json.ok && json.data?.redirectUrl) {
      window.location.href = json.data.redirectUrl;
      return;
    }
    setState("error");
    setError(json.error ?? "خطا در ایجاد سفارش");
  }

  if (!canBuy) return <div className="badge badge-amber w-full justify-center">برای خرید باید وارد حساب کاربری شوی.</div>;

  return (
    <div className="space-y-2">
      {error && <div className="badge badge-red w-full justify-center">{error}</div>}
      <button className="btn btn-primary w-full !py-3" onClick={buy} disabled={state === "loading"}>
        {state === "loading" ? "در حال اتصال به درگاه…" : "خرید و فعال‌سازی خودکار"}
      </button>
    </div>
  );
}
