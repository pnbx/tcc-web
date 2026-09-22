"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Status = {
  configured: boolean;
  bot: string;
  linked: boolean;
  username?: string | null;
  linkedAt?: string | null;
  required: boolean;
};

export function TelegramConnect({ next }: { next: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/account/telegram");
    const json = await res.json();
    const data = json?.data ?? json;
    setStatus(data as Status);
    return data as Status;
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // poll while a code is on screen — the bot confirms the link server-side
  useEffect(() => {
    if (!code) return;
    const t = setInterval(async () => {
      const s = await loadStatus();
      if (s?.linked) window.location.href = next;
    }, 4000);
    return () => clearInterval(t);
  }, [code, loadStatus, next]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const json = await res.json();
      const data = json?.data ?? json;
      if (!data?.ok) {
        setError(data?.error ?? "ساخت کد ناموفق بود.");
        return;
      }
      setCode(data.code);
      setDeepLink(data.deepLink);
    } finally {
      setBusy(false);
    }
  }

  if (status?.linked) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="font-heading font-bold text-lg mb-2">تلگرام وصل است</h2>
        <p className="text-sm text-[var(--c-text-dim)] mb-6">
          {status.username ? `حساب @${status.username} ` : ""}به حسابت متصل شده و اطلاع‌رسانی پایان رنک فعال است.
        </p>
        <Link href={next} className="btn btn-primary">ادامه ←</Link>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h1 className="font-display text-2xl font-black mb-2">اتصال تلگرام (الزامی)</h1>
      <p className="text-sm text-[var(--c-text-dim)] mb-6 leading-6">
        پایان هر رنک را در تلگرام به تو اطلاع می‌دهیم؛ به همین دلیل اتصال تلگرام برای همه‌ی اعضا الزامی است.
        در سه مرحله انجام می‌شود.
      </p>

      {!status ? (
        <div className="skeleton h-24 w-full" />
      ) : !status.configured ? (
        <div className="text-sm text-amber-400">
          ربات تلگرام هنوز روی سایت تنظیم نشده (TELEGRAM_BOT_TOKEN). فعلاً این مرحله غیرفعال است — با پشتیبانی تماس بگیر.
        </div>
      ) : (
        <>
          <ol className="text-sm text-[var(--c-text-dim)] space-y-2 mb-6">
            <li>۱. دکمه‌ی زیر را بزن تا کد اختصاصی‌ات ساخته شود.</li>
            <li>۲. روی «باز کردن تلگرام» بزن — ربات <b>@{status.bot}</b> باز می‌شود.</li>
            <li>۳. در ربات دکمه‌ی Start را بزن؛ اتصال خودکار تأیید می‌شود.</li>
          </ol>

          {!code ? (
            <button className="btn btn-primary w-full" onClick={start} disabled={busy}>
              {busy ? "…" : "ساخت کد اتصال"}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-xs text-[var(--c-text-dim)] mb-1">کد شما</div>
                <div className="num text-3xl font-black tracking-widest text-[var(--c-pink)]">{code}</div>
                <div className="text-[11px] text-[var(--c-text-faint)] mt-1">
                  اگر ربات باز نشد، در ربات بنویس: <span className="mono">/start {code}</span>
                </div>
              </div>
              {deepLink ? (
                <a href={deepLink} target="_blank" rel="noreferrer" className="btn btn-primary w-full">
                  باز کردن تلگرام ←
                </a>
              ) : null}
              <div className="text-center text-xs text-[var(--c-text-dim)]">در انتظار تأیید… (این صفحه خودش تازه می‌شود)</div>
              <button className="btn btn-ghost w-full" onClick={() => void loadStatus()}>بررسی دستی</button>
            </div>
          )}
        </>
      )}

      {error ? <div className="text-sm text-[var(--c-pink)] mt-4">{error}</div> : null}

      <div className="mt-6 text-center">
        <Link href="/dashboard" className="text-xs text-[var(--c-text-faint)] hover:text-[var(--c-pink)]">
          بعداً (بدون تلگرام نمی‌توانی خرید کنی)
        </Link>
      </div>
    </div>
  );
}
