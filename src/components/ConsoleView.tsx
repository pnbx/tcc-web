"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConsoleLine = { ts: number; level: string; thread: string; message: string };

const LEVELS = ["INFO", "WARN", "ERROR", "DEBUG"] as const;

export function ConsoleView({ canCommand }: { canCommand: boolean }) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [grep, setGrep] = useState("");
  const [levels, setLevels] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [connected, setConnected] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<number | undefined>(undefined);

  const poll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (cursorRef.current != null) params.set("after", String(cursorRef.current));
      const res = await fetch(`/api/server/console?${params}`);
      const json = await res.json();
      if (!json.ok) {
        setConnected(false);
        return;
      }
      setConnected(true);
      const fresh: ConsoleLine[] = json.data.lines ?? [];
      if (fresh.length > 0) {
        cursorRef.current = fresh[fresh.length - 1].ts;
        setLines((prev) => [...prev, ...fresh].slice(-2000));
      } else if (cursorRef.current == null) {
        cursorRef.current = Date.now() - 60_000;
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (autoScroll && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  async function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    const res = await fetch("/api/server/console", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const json = await res.json();
    if (json.ok) {
      setHistory((h) => [command, ...h].slice(0, 50));
      setHistoryIdx(-1);
      setCommand("");
      const out: string[] = json.data.output ?? [];
      if (out.length) {
        setLines((prev) => [
          ...prev,
          ...out.map((m) => ({ ts: Date.now(), level: "OTHER", thread: "web", message: `> ${m}` })),
        ]);
      }
    }
  }

  const filtered = lines.filter((l) => {
    if (levels.length && !levels.includes(l.level)) return false;
    if (grep && !l.message.toLowerCase().includes(grep.toLowerCase())) return false;
    return true;
  });

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setCommand(history[next]);
    } else if (e.key === "ArrowDown" && historyIdx >= 0) {
      e.preventDefault();
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setCommand(next >= 0 ? history[next] : "");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input !w-56 ltr"
          placeholder="جستجو در لاگ‌ها…"
          value={grep}
          onChange={(e) => setGrep(e.target.value)}
        />
        {LEVELS.map((lv) => (
          <button
            key={lv}
            type="button"
            className={`badge ${levels.includes(lv) ? "badge-purple" : ""}`}
            onClick={() =>
              setLevels((s) => (s.includes(lv) ? s.filter((x) => x !== lv) : [...s, lv]))
            }
          >
            {lv}
          </button>
        ))}
        <label className="flex items-center gap-2 text-xs text-[var(--c-text-dim)] me-auto cursor-pointer select-none">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          اسکرول خودکار
        </label>
        <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setLines([])}>
          پاک کردن نمایش
        </button>
        <span className={`badge ${connected ? "badge-green" : "badge-red"}`}>{connected ? "متصل" : "قطع"}</span>
      </div>

      <div ref={boxRef} className="console p-2 h-[26rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="console-line console-debug py-2">— no matching lines —</div>
        ) : (
          filtered.map((l, i) => (
            <div key={i} className={`console-line console-${l.level.toLowerCase()}`}>
              <span className="console-ts">
                [{new Date(l.ts).toLocaleTimeString("en-GB", { hour12: false })}]
              </span>{" "}
              {l.message}
            </div>
          ))
        )}
      </div>

      {canCommand && (
        <form onSubmit={sendCommand} className="flex gap-2">
          <span className="mono text-[var(--c-pink)] self-center">›</span>
          <input
            className="input ltr mono flex-1"
            placeholder="/tcc reload — دستور را بدون اسلش وارد کنید"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="btn btn-primary">اجرا</button>
        </form>
      )}
      {history.length > 0 && canCommand && (
        <div className="text-[10px] text-[var(--c-text-faint)] mono truncate">
          history: {history.slice(0, 5).join(" | ")} (↑/↓)
        </div>
      )}
    </div>
  );
}
