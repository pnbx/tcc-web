"use client";

import { useCallback, useEffect, useState } from "react";

type UserRow = {
  id: string;
  username: string;
  displayName: string | null;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  roles: { role: { name: string } }[];
  minecraftAccounts: { username: string; uuid: string; linkedAt: string | null }[];
};

const ROLE_NAMES = ["MEMBER", "MODERATOR", "ADMIN", "OWNER", "DEVELOPER"];

export function AdminPlayersClient({ canBan, canRoles, canLink }: { canBan: boolean; canRoles: boolean; canLink: boolean }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (query: string) => {
    const res = await fetch(`/api/admin/players?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (json.ok) setRows(json.data.users);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  async function act(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setMsg(json.ok ? "انجام شد ✓" : json.error ?? "خطا");
    load(q);
  }

  return (
    <div className="fade-up space-y-6">
      <h1 className="font-display text-2xl font-black">بازیکنان و کاربران</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="flex gap-2"
      >
        <input className="input !w-64 ltr" placeholder="جستجوی نام کاربری…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-ghost">جستجو</button>
      </form>

      {msg && <div className="badge badge-green">{msg}</div>}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>کاربر</th>
              <th>حساب MC</th>
              <th>نقش‌ها</th>
              <th>وضعیت</th>
              <th>آخرین ورود</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-ui font-semibold">{u.displayName ?? u.username}</td>
                <td className="mono text-xs">
                  {u.minecraftAccounts.length ? u.minecraftAccounts.map((m) => m.username).join(", ") : "—"}
                </td>
                <td>
                  {canRoles ? (
                    <RolePicker
                      current={u.roles.map((r) => r.role.name)}
                      onChange={(roles) => act({ action: "setRoles", userId: u.id, roles })}
                    />
                  ) : (
                    <span className="text-xs">{u.roles.map((r) => r.role.name).join(", ") || "MEMBER"}</span>
                  )}
                </td>
                <td>
                  {u.banned ? <span className="badge badge-red">مسدود</span> : <span className="badge badge-green">عادی</span>}
                </td>
                <td className="text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("fa-IR") : "—"}</td>
                <td>
                  <div className="flex gap-2">
                    {canBan && !u.banned && (
                      <button
                        className="btn btn-danger !py-1 !px-2 text-xs"
                        onClick={() => {
                          const reason = window.prompt("دلیل مسدودسازی؟") ?? undefined;
                          if (reason !== null) act({ action: "ban", userId: u.id, reason });
                        }}
                      >
                        مسدودسازی
                      </button>
                    )}
                    {canBan && u.banned && (
                      <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => act({ action: "unban", userId: u.id })}>
                        رفع مسدودی
                      </button>
                    )}
                    {canLink &&
                      u.minecraftAccounts.map((m) => (
                        <button
                          key={m.uuid}
                          className="btn btn-ghost !py-1 !px-2 text-xs"
                          onClick={() => {
                            if (window.confirm(`اتصال حساب ${m.username} قطع شود؟`)) {
                              void m;
                              setMsg("برای قطع اتصال، شناسه حساب لازم است — از API استفاده کنید.");
                            }
                          }}
                        >
                          قطع اتصال {m.username}
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center">کاربری یافت نشد.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RolePicker({ current, onChange }: { current: string[]; onChange: (roles: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(current);

  return (
    <div className="relative">
      <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setOpen(!open)} type="button">
        {selected.join(", ") || "MEMBER"} ▾
      </button>
      {open && (
        <div className="absolute z-20 mt-1 card-raised p-3 space-y-2 w-44">
          {ROLE_NAMES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(r)}
                onChange={(e) =>
                  setSelected((s) => (e.target.checked ? [...s, r] : s.filter((x) => x !== r)))
                }
              />
              <span className="mono">{r}</span>
            </label>
          ))}
          <button
            className="btn btn-primary !py-1 w-full text-xs"
            type="button"
            onClick={() => {
              onChange(selected);
              setOpen(false);
            }}
          >
            ذخیره نقش‌ها
          </button>
        </div>
      )}
    </div>
  );
}
