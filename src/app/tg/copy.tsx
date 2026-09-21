"use client";

import { useState } from "react";

// Mini App copy button: clipboard inside Telegram's webview + a haptic tap when
// the WebApp SDK is available.
export function TgCopyIp({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // older webviews: fall back to a selection prompt
      window.prompt("آدرس سرور را کپی کن:", address);
    }
    setCopied(true);
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { notificationOccurred?: (t: string) => void } } } }).Telegram?.WebApp;
    tg?.HapticFeedback?.notificationOccurred?.("success");
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" onClick={copy} className="w-full card px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform">
      <span className="ip-address text-sm font-semibold select-all">{address}</span>
      <span className={`text-xs font-ui ${copied ? "text-[var(--c-green)]" : "text-[var(--c-pink)]"}`}>
        {copied ? "کپی شد ✓" : "کپی"}
      </span>
    </button>
  );
}
