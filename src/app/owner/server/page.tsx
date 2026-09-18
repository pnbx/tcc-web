"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS = [
  { action: "start", label: "روشن‌کردن سرور", danger: false },
  { action: "restart", label: "ری‌استارت سرور", danger: true },
  { action: "stop", label: "خاموش‌کردن سرور", danger: true },
] as const;

export default function OwnerServerControls() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [broadcast, setBroadcast] = useState("");
  const [busy, setBusy] = useState(false);

  async function power(action: string, confirm: boolean) {
    setBusy(true);
    const res = await fetch("/api/server/power", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, confirm }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(json.ok ? `${json.data.message ?? "انجام شد"}` : json.error ?? "خطا");
    router.refresh();
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/server/power", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "broadcast", message: broadcast }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(json.ok ? "پیام ارسال شد ✓" : json.error ?? "خطا");
    if (json.ok) setBroadcast("");
  }

  return (
    <div className="fade-up space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl font-black">کنترل سرور</h1>

      <section className="card p-6">
        <h2 className="font-heading font-bold mb-4">عملیات قدرت</h2>
        <div className="flex flex-wrap gap-3">
          {ACTIONS.map((a) => (
            <button
              key={a.action}
              className={`btn ${a.danger ? "btn-danger" : "btn-purple"}`}
              disabled={busy}
              onClick={() => {
                const ok = a.danger
                  ? window.confirm(
                      a.action === "stop"
                        ? "سرور خاموش شود؟ همه بازیکنان جدا می‌شوند."
                        : "سرور ری‌استارت شود؟ وقفه کوتاهی ایجاد می‌شود.",
                    )
                  : true;
                if (ok) power(a.action, true);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--c-text-faint)] mt-3 leading-5">
          عملیات‌های مخرب نیاز به تأیید صریح دارند و در لاگ حسابرسی با نام شما ثبت می‌شوند.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="font-heading font-bold mb-4">پیام همگانی</h2>
        <form onSubmit={sendBroadcast} className="flex gap-2">
          <input className="input" placeholder="متن پیام به همه بازیکنان…" value={broadcast} onChange={(e) => setBroadcast(e.target.value)} required />
          <button className="btn btn-primary" disabled={busy}>ارسال</button>
        </form>
      </section>

      {msg && <div className="badge badge-amber">{msg}</div>}
    </div>
  );
}
