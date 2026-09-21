"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// First-run bootstrap: creates the OWNER and DEVELOPER accounts.
// Requires SETUP_KEY from the server environment — only someone with shell
// access can complete this. Passwords are Argon2id-hashed server-side.
export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    setupKey: "",
    ownerUsername: "",
    ownerPassword: "",
    developerUsername: "root",
    developerPassword: "",
  });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } else {
      setError(json.error ?? "خطا");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-up">
        <div className="text-center mb-8">
          <div className="font-heading font-extrabold text-3xl">
            TCC <span className="text-[var(--c-pink)]">MC</span>
          </div>
          <p className="text-sm text-[var(--c-text-dim)] mt-2">راه‌اندازی اولیه پلتفرم</p>
        </div>

        {done ? (
          <div className="card p-8 text-center">
            <div className="badge badge-green mx-auto mb-4">انجام شد</div>
            <p className="text-sm text-[var(--c-text-dim)]">
              حساب مالک و توسعه‌دهنده ساخته شد. در حال انتقال به صفحه ورود…
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6 space-y-4">
            <div>
              <label className="label" htmlFor="setupKey">کلید راه‌اندازی (SETUP_KEY در .env سرور)</label>
              <input id="setupKey" className="input ltr" value={form.setupKey} onChange={set("setupKey")} required />
            </div>
            <div className="border-t hairline pt-4">
              <div className="text-xs font-ui font-semibold text-[var(--c-pink)] mb-3">حساب مالک (Owner)</div>
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="ownerUsername">نام کاربری</label>
                  <input id="ownerUsername" className="input ltr" value={form.ownerUsername} onChange={set("ownerUsername")} required />
                </div>
                <div>
                  <label className="label" htmlFor="ownerPassword">گذرواژه (حداقل ۱۰ کاراکتر)</label>
                  <input id="ownerPassword" type="password" className="input ltr" value={form.ownerPassword} onChange={set("ownerPassword")} required minLength={10} />
                </div>
              </div>
            </div>
            <div className="border-t hairline pt-4">
              <div className="text-xs font-ui font-semibold text-[var(--c-purple)] mb-3">حساب توسعه‌دهنده (Developer)</div>
              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="developerUsername">نام کاربری</label>
                  <input id="developerUsername" className="input ltr" value={form.developerUsername} onChange={set("developerUsername")} required />
                </div>
                <div>
                  <label className="label" htmlFor="developerPassword">گذرواژه (حداقل ۱۲ کاراکتر)</label>
                  <input id="developerPassword" type="password" className="input ltr" value={form.developerPassword} onChange={set("developerPassword")} required minLength={12} />
                </div>
              </div>
            </div>
            {error && <div className="badge badge-red w-full justify-center">{error}</div>}
            <button className="btn btn-primary w-full !py-2.5" disabled={loading}>
              {loading ? "در حال ساخت…" : "ایجاد حساب‌ها"}
            </button>
            <p className="text-xs text-[var(--c-text-faint)] leading-5">
              گذرواژه‌ها با Argon2id هش می‌شوند و هرگز توسط API بازگردانده نمی‌شوند.
              این صفحه پس از تکمیل، غیرفعال می‌شود.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
