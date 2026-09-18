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
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[rgba(10,8,18,0.82)] border-b hairline">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="font-heading font-extrabold text-lg tracking-tight">
          TCC <span className="text-[var(--c-pink)]">MC</span>
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
            <Link href="/login" className="btn btn-primary !py-1.5">ورود</Link>
          )}
        </div>
      </div>
      {/* mobile nav */}
      <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link whitespace-nowrap ${pathname === l.href ? "active" : ""}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
