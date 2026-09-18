"use client";

import { useState } from "react";
import type { ServerStatus, LiveMetrics } from "@/lib/mc/types";
import { formatNumber } from "@/components/format";

export function ServerStatusCard({
  status,
  metrics,
  canCommand,
  canBroadcast,
  consoleAvailable,
}: {
  status: ServerStatus;
  metrics: LiveMetrics | null;
  canCommand: boolean;
  canBroadcast: boolean;
  consoleAvailable: boolean;
}) {
  const [cmd, setCmd] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [broadcast, setBroadcast] = useState("");
  const [msg, setMsg] = useState("");

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/server/console", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    });
    const json = await res.json();
    if (json.ok) setOutput(json.data.output ?? []);
    else setMsg(json.error ?? "خطا");
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/server/power", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "broadcast", message: broadcast }),
    });
    const json = await res.json();
    setMsg(json.ok ? "ارسال شد ✓" : json.error ?? "خطا");
    if (json.ok) setBroadcast("");
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold">وضعیت</h2>
          <span className={`badge ${status.online ? "badge-green" : "badge-red"}`}>{status.online ? "آنلاین" : "آفلاین"}</span>
        </div>
        <dl className="space-y-2.5 text-sm">
          <Row label="بازیکنان" value={status.online ? `${formatNumber(status.playersOnline)} / ${formatNumber(status.playersMax)}` : "—"} />
          <Row label="نسخه" value={<span className="mono text-xs">{status.version ?? "—"}</span>} />
          <Row label="منبع" value={<span className="mono text-xs uppercase">{status.source}</span>} />
          {metrics && (
            <>
              <Row label="TPS" value={metrics.tps != null ? <span className="num">{metrics.tps.toFixed(1)}</span> : "—"} />
              <Row label="MSPT" value={metrics.mspt != null ? <span className="num">{metrics.mspt.toFixed(1)}</span> : "—"} />
              <Row
                label="RAM"
                value={
                  metrics.memoryUsedMb != null && metrics.memoryMaxMb != null ? (
                    <span className="num">{formatNumber(Math.round(metrics.memoryUsedMb))} / {formatNumber(Math.round(metrics.memoryMaxMb))} MB</span>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="CPU" value={metrics.cpuPercent != null ? <span className="num">{metrics.cpuPercent.toFixed(0)}%</span> : "—"} />
            </>
          )}
        </dl>
      </div>

      <div className="space-y-6">
        {canCommand && (
          <div className="card p-6">
            <h2 className="font-heading font-bold mb-3">اجرای دستور</h2>
            <form onSubmit={runCommand} className="flex gap-2">
              <input className="input ltr mono" placeholder="say hello" value={cmd} onChange={(e) => setCmd(e.target.value)} required />
              <button className="btn btn-purple">اجرا</button>
            </form>
            {output.length > 0 && (
              <pre className="console mt-4 p-3 max-h-48 overflow-auto">{output.join("\n")}</pre>
            )}
            {consoleAvailable && (
              <p className="text-xs text-[var(--c-text-faint)] mt-3">کنسول کامل در پنل توسعه‌دهنده/مالک در دسترس است.</p>
            )}
          </div>
        )}
        {canBroadcast && (
          <div className="card p-6">
            <h2 className="font-heading font-bold mb-3">پیام همگانی</h2>
            <form onSubmit={sendBroadcast} className="flex gap-2">
              <input className="input" placeholder="متن پیام…" value={broadcast} onChange={(e) => setBroadcast(e.target.value)} required />
              <button className="btn btn-primary">ارسال</button>
            </form>
          </div>
        )}
        {msg && <div className="badge badge-green">{msg}</div>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--c-text-dim)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
