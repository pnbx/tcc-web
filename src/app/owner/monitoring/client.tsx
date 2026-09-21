"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type MetricItem = { label: string; value: string; hint?: string; tone?: "ok" | "warn" | "bad" | "dim" };
type LiveMetrics = {
  collectedAt: string;
  playersOnline: number | null;
  playersMax: number | null;
  tps: number | null;
  mspt: number | null;
  cpuPercent: number | null;
  memoryUsedMb: number | null;
  memoryMaxMb: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  uptimeSec: number | null;
  source: string;
};
type HistoryPoint = { at: string; players: number | null; max: number | null; tps: number | null; mspt: number | null; ramMb: number | null };
type Capability = { available: boolean; reason?: string };

const num = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function uptime(sec: number | null): string {
  if (sec == null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} روز و ${h} ساعت`;
  if (h > 0) return `${h} ساعت و ${m} دقیقه`;
  return `${m} دقیقه`;
}

export function MonitoringClient() {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [caps, setCaps] = useState<Record<string, Capability>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/server/metrics?history=120", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "خطا در دریافت متریک‌ها");
      setMetrics((json.data.metrics ?? null) as LiveMetrics | null);
      setHistory((json.data.history ?? []) as HistoryPoint[]);
      setCaps((json.data.capabilities ?? {}) as Record<string, Capability>);
      setUpdatedAt(new Date());
      setState("ready");
      setError("");
    } catch (err) {
      setState("error");
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => void load(), 15_000);
    return () => clearInterval(id);
  }, [auto, load]);

  const online = metrics != null;
  const tpsTone: MetricItem["tone"] = metrics?.tps == null ? "dim" : metrics.tps >= 19 ? "ok" : metrics.tps >= 15 ? "warn" : "bad";
  const ramPct = metrics?.memoryUsedMb != null && metrics?.memoryMaxMb ? (metrics.memoryUsedMb / metrics.memoryMaxMb) * 100 : null;
  const ramTone: MetricItem["tone"] = ramPct == null ? "dim" : ramPct < 70 ? "ok" : ramPct < 88 ? "warn" : "bad";

  const items: MetricItem[] = [
    {
      label: "بازیکنان آنلاین",
      value: metrics?.playersOnline == null ? "—" : `${num(metrics.playersOnline)} / ${num(metrics.playersMax)}`,
      tone: online ? "ok" : "dim",
    },
    { label: "TPS", value: num(metrics?.tps, 1), hint: "۲۰ = بدون تأخیر", tone: tpsTone },
    { label: "MSPT", value: num(metrics?.mspt, 1), hint: "زمان هر تیک (میلی‌ثانیه)", tone: metrics?.mspt == null ? "dim" : metrics.mspt <= 50 ? "ok" : "warn" },
    { label: "حافظه", value: metrics?.memoryUsedMb == null ? "—" : `${num(metrics.memoryUsedMb)} / ${num(metrics.memoryMaxMb)} MB`, tone: ramTone },
    { label: "فضای دیسک", value: metrics?.diskUsedGb == null ? "—" : `${num(metrics.diskUsedGb, 2)} GB`, tone: "dim" },
    { label: "آپ‌تایم", value: uptime(metrics?.uptimeSec ?? null), tone: "dim" },
  ];

  const maxPlayers = Math.max(1, ...history.map((h) => h.players ?? 0), metrics?.playersMax ?? 1);

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="font-display text-2xl font-black">پایش زنده سرور</h1>
        <span className={`badge ${online ? "badge-green" : "badge-amber"}`}>{online ? "داده زنده" : "بدون داده"}</span>
        {metrics?.source ? <span className="badge badge-purple">منبع: {metrics.source}</span> : null}
        <div className="ms-auto flex items-center gap-2">
          <label className="text-xs text-[var(--c-text-faint)] font-ui flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            بروزرسانی خودکار
          </label>
          <button className="btn btn-ghost !py-1.5" onClick={() => void load()} disabled={state === "loading"}>
            {state === "loading" ? "…" : "بروزرسانی"}
          </button>
        </div>
      </div>

      {state === "error" && <div className="badge badge-red mb-4">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {items.map((it) => (
          <div key={it.label} className="card p-5">
            <div className="text-xs font-ui text-[var(--c-text-faint)] mb-1.5">{it.label}</div>
            <div
              className="font-display text-2xl font-black num"
              style={{
                color:
                  it.tone === "ok"
                    ? "var(--c-green)"
                    : it.tone === "warn"
                      ? "var(--c-amber)"
                      : it.tone === "bad"
                        ? "var(--c-red)"
                        : "var(--c-text)",
              }}
            >
              {it.value}
            </div>
            {it.hint && <div className="text-[11px] text-[var(--c-text-faint)] mt-1">{it.hint}</div>}
          </div>
        ))}
      </div>

      {/* players history */}
      <div className="card p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-heading font-bold">بازیکنان در نمونه‌های اخیر</h2>
          <span className="text-xs text-[var(--c-text-faint)]">{history.length} نمونه</span>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--c-text-dim)]">
            هنوز نمونه‌ای ثبت نشده است. پلاگین هر ۲۰ ثانیه وضعیت را می‌فرستد؛ بعد از چند دقیقه نمودار پر می‌شود.
          </p>
        ) : (
          <div className="flex items-end gap-1 h-28" dir="ltr">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-[var(--c-purple-deep)] to-[var(--c-pink)] opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${Math.max(2, ((h.players ?? 0) / maxPlayers) * 100)}%` }}
                title={`${h.players ?? 0} بازیکن — ${new Date(h.at).toLocaleTimeString("fa-IR")}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* capabilities + timing */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-heading font-bold mb-3">قابلیت‌های یکپارچگی</h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(caps).map(([key, cap]) => (
              <li key={key} className="flex items-start gap-2">
                <span className={`badge ${cap.available ? "badge-green" : "badge-amber"} shrink-0`}>{cap.available ? "فعال" : "غیرفعال"}</span>
                <span className="mono text-xs text-[var(--c-text-dim)] pt-1">{key}</span>
                {!cap.available && cap.reason && <span className="text-[11px] text-[var(--c-text-faint)] pt-1">{cap.reason}</span>}
              </li>
            ))}
            {Object.keys(caps).length === 0 && <li className="text-[var(--c-text-dim)]">در دسترس نیست.</li>}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-heading font-bold mb-3">وضعیت پایش</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--c-text-dim)]">آخرین بروزرسانی صفحه</dt>
              <dd className="num">{updatedAt ? updatedAt.toLocaleTimeString("fa-IR") : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--c-text-dim)]">زمان نمونه‌گیری سرور</dt>
              <dd className="num">{metrics?.collectedAt ? new Date(metrics.collectedAt).toLocaleTimeString("fa-IR") : "—"}</dd>
            </div>
          </dl>
          <div className="flex gap-2 mt-4">
            <Link href="/developer/console" className="btn btn-ghost !py-1.5">کنسول سرور</Link>
            <Link href="/owner/server" className="btn btn-ghost !py-1.5">مدیریت سرور</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonitoringClient;
