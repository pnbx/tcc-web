import fs from "node:fs";

const BASE = "https://site.tccmc.ir";
const PAGES = [
  "/dashboard", "/dashboard/profile", "/dashboard/purchases",
  "/admin", "/admin/news", "/admin/tiers", "/admin/store", "/admin/players", "/admin/server",
  "/owner", "/owner/monitoring", "/owner/server", "/owner/console", "/owner/logs", "/owner/players", "/owner/settings",
  "/developer", "/developer/console", "/developer/files", "/developer/monitoring", "/developer/plugins", "/developer/logs", "/developer/system",
];

// log in once
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "owner", password: "Tcc-Owner-2026" }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const ok = (await login.json()).ok;
console.log("login:", ok, "| cookie len:", cookie.length);

const rows = [];
for (const p of PAGES) {
  const res = await fetch(BASE + p, { headers: { cookie } });
  const html = await res.text();
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const errorish = /Internal server error|Application error|خطای سرور/i.test(body);
  const empty = /هنوز|داده‌ای|در دسترس نیست|غیرفعال|پلاگینی گزارش نشد|دسترسی/.test(body);
  rows.push({
    page: p,
    status: res.status,
    chars: body.length,
    error: errorish,
    sample: body.slice(0, 150),
  });
}
for (const r of rows) {
  console.log(`\n${r.page}  [${r.status}] chars=${r.chars}${r.error ? "  ⚠ERROR" : ""}`);
  console.log("   " + r.sample);
}
fs.writeFileSync("panel-audit.json", JSON.stringify(rows, null, 1));
