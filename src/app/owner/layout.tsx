import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth, hasPermission } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!hasPermission(auth.permissions, "panel.owner")) redirect("/dashboard");

  const links = [
    { href: "/owner", label: "نمای کلی" },
    { href: "/owner/server", label: "سرور" },
    { href: "/owner/console", label: "کنسول" },
    { href: "/owner/monitoring", label: "پایش" },
    { href: "/owner/players", label: "بازیکنان" },
    { href: "/owner/logs", label: "لاگ‌ها" },
    { href: "/owner/settings", label: "تنظیمات" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[rgba(10,8,18,0.85)] border-b hairline">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="font-heading font-extrabold text-lg">
            TCC <span className="text-[var(--c-pink)]">MC</span>
          </Link>
          <span className="badge badge-pink">مالک</span>
          <div className="ms-auto flex items-center gap-2">
            {hasPermission(auth.permissions, "panel.developer") && (
              <Link href="/developer" className="btn btn-ghost !py-1.5 text-xs">توسعه‌دهنده</Link>
            )}
            <Link href="/dashboard" className="btn btn-ghost !py-1.5 text-xs">پنل کاربری</Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto w-full px-4 py-8 flex-1 flex gap-8">
        <aside className="hidden md:block w-48 shrink-0">
          <nav className="space-y-1 sticky top-20">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="panel-nav-link">{l.label}</Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
