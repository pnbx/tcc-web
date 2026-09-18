"use client";

import { useState } from "react";

export type ProfileForm = {
  displayName: string;
  bio: string;
  privacyProfile: "public" | "members" | "private";
};

export function ProfileSettingsClient({ initial }: { initial: ProfileForm & { linked: { username: string } | null } }) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState("");
  const [linkUsername, setLinkUsername] = useState("");
  const [linkCode, setLinkCode] = useState<{ code: string; instruction: string } | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setMsg(json.ok ? "ذخیره شد ✓" : json.error ?? "خطا");
  }

  async function startLink(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/account/link/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: linkUsername }),
    });
    const json = await res.json();
    if (json.ok) setLinkCode({ code: json.data.code, instruction: json.data.instruction });
    else setMsg(json.error ?? "خطا");
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
    });
    const json = await res.json();
    setPwMsg(json.ok ? "گذرواژه تغییر کرد ✓" : json.error ?? "خطا");
  }

  return (
    <div className="space-y-6 fade-up max-w-2xl">
      {/* MC account linking */}
      <section className="card p-6">
        <h2 className="font-heading font-bold mb-1">حساب ماینکرفت</h2>
        {initial.linked ? (
          <p className="text-sm text-[var(--c-text-dim)]">
            متصل شده: <span className="mono text-[var(--c-pink)]">{initial.linked.username}</span>
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--c-text-dim)] mb-4">
              برای تأیید مالکیت، کد بسازید و در بازی دستور آن را اجرا کنید. گذرواژه ماینکرفت شما هرگز
              به وب‌سایت داده نمی‌شود.
            </p>
            <form onSubmit={startLink} className="flex gap-2">
              <input
                className="input ltr !w-56"
                placeholder="MinecraftUsername"
                value={linkUsername}
                onChange={(e) => setLinkUsername(e.target.value)}
                required
              />
              <button className="btn btn-primary">ساخت کد</button>
            </form>
            {linkCode && (
              <div className="card-raised p-4 mt-4">
                <div className="mono text-2xl font-bold text-[var(--c-pink)] text-center select-all">{linkCode.code}</div>
                <p className="text-xs text-[var(--c-text-dim)] mt-3 text-center">{linkCode.instruction}</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* website profile */}
      <section className="card p-6">
        <h2 className="font-heading font-bold mb-4">پروفایل وب‌سایت</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="label" htmlFor="displayName">نام نمایشی</label>
            <input
              id="displayName"
              className="input"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="bio">درباره من</label>
            <textarea
              id="bio"
              className="textarea"
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="privacy">نمایش پروفایل</label>
            <select
              id="privacy"
              className="select"
              value={form.privacyProfile}
              onChange={(e) => setForm({ ...form, privacyProfile: e.target.value as ProfileForm["privacyProfile"] })}
            >
              <option value="public">عمومی</option>
              <option value="members">فقط اعضای واردشده</option>
              <option value="private">خصوصی</option>
            </select>
          </div>
          {msg && <div className="badge badge-green">{msg}</div>}
          <button className="btn btn-primary">ذخیره</button>
        </form>
      </section>

      {/* password */}
      <section className="card p-6">
        <h2 className="font-heading font-bold mb-4">تغییر گذرواژه وب‌سایت</h2>
        <form onSubmit={changePw} className="space-y-4">
          <div>
            <label className="label" htmlFor="curPw">گذرواژه فعلی</label>
            <input id="curPw" type="password" className="input ltr" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </div>
          <div>
            <label className="label" htmlFor="newPw">گذرواژه جدید (حداقل ۱۰)</label>
            <input id="newPw" type="password" className="input ltr" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={10} />
          </div>
          {pwMsg && <div className="badge badge-green">{pwMsg}</div>}
          <button className="btn btn-purple">تغییر گذرواژه</button>
        </form>
      </section>
    </div>
  );
}
