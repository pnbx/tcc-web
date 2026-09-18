"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, ...(totp ? { totp } : {}) }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    if (json.needTotp) setNeedTotp(true);
    setError(json.error ?? "خطا در ورود");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-8">
          <div className="font-heading font-extrabold text-3xl">
            TCC <span className="text-[var(--c-pink)]">MC</span>
          </div>
          <p className="text-sm text-[var(--c-text-dim)] mt-2">ورود به حساب کاربری</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label" htmlFor="username">نام کاربری</label>
            <input
              id="username"
              className="input ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">گذرواژه</label>
            <input
              id="password"
              type="password"
              className="input ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {needTotp && (
            <div>
              <label className="label" htmlFor="totp">کد دومرحله‌ای (TOTP)</label>
              <input
                id="totp"
                className="input ltr"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                inputMode="numeric"
                placeholder="123456"
              />
            </div>
          )}
          {error && <div className="badge badge-red w-full justify-center">{error}</div>}
          <button className="btn btn-primary w-full !py-2.5" disabled={loading}>
            {loading ? "در حال ورود…" : "ورود"}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--c-text-faint)] mt-6 leading-5">
          حساب ندارید؟ حساب شما با اتصال حساب ماینکرفت در پنل کاربری ساخته می‌شود.
          <br />
          نخستین راه‌اندازی؟ <a href="/setup" className="text-[var(--c-pink)] hover:underline">راه‌اندازی اولیه</a>
        </p>
      </div>
    </main>
  );
}
