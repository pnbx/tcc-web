"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "خانه" },
  { href: "/tiers", label: "تیرها" },
  { href: "/players", label: "بازیکنان" },
  { href: "/news", label: "اخبار" },
  { href: "/store", label: "استور" },
];

export function SiteHeader({ authed }: { authed: boolean }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(10,8,18,0.75)] border-b hairline">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {/* pixel cube mark */}
          <span className="relative grid place-items-center w-8 h-8 rounded-[9px] bg-gradient-to-br from-[var(--c-purple)] to-[var(--c-pink-strong)] shadow-[0_4px_18px_-4px_rgba(236,72,153,0.6)]">
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white" fill="currentColor" style={{ width: 18, height: 18 }}>
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.2 6.5 3.6L12 11.4 5.5 7.8 12 4.2ZM5 9.6l6 3.3v6.9l-6-3.3V9.6Zm8 10.2v-6.9l6-3.3v6.9l-6 3.3Z" />
            </svg>
          </span>
          <span className="font-heading font-black text-lg tracking-tight">
            TCC <span className="text-gradient">MC</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link ${pathname === l.href ? "active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          {authed ? (
            <Link href="/dashboard" className="btn btn-ghost !py-1.5">پنل کاربری</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost !py-1.5 hidden sm:inline-flex">ورود</Link>
              <Link href="/login" className="btn btn-primary !py-1.5">شروع بازی</Link>
            </>
          )}
        </div>
      </div>
      {/* mobile nav */}
      <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link whitespace-nowrap ${pathname === l.href ? "active" : ""}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
