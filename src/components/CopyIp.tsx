"use client";

import { useState } from "react";

export function CopyIp({ ip, className }: { ip: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${copied ? "btn-purple" : "btn-ghost"} ${className ?? ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(ip);
        } catch {
          // clipboard API can be blocked; select-style fallback omitted for brevity
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "کپی شد ✓" : "کپی IP"}
    </button>
  );
}
