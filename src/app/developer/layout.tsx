import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth, hasPermission } from "@/lib/auth";

export default async function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!hasPermission(auth.permissions, "panel.developer")) redirect("/dashboard");

  const links = [
    { href: "/developer", label: "نمای کلی" },
    { href: "/developer/console", label: "کنسول" },
    { href: "/developer/files", label: "فایل‌ها" },
    { href: "/developer/logs", label: "لاگ‌ها" },
    { href: "/developer/plugins", label: "پلاگین‌ها" },
    { href: "/developer/monitoring", label: "پایش" },
    { href: "/developer/system", label: "سیستم" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[rgba(10,8,18,0.85)] border-b hairline">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="font-heading font-extrabold text-lg">
            TCC <span className="text-[var(--c-pink)]">MC</span>
          </Link>
          <span className="badge badge-purple">توسعه‌دهنده</span>
          <div className="ms-auto flex items-center gap-2">
            {hasPermission(auth.permissions, "panel.owner") && (
              <Link href="/owner" className="btn btn-ghost !py-1.5 text-xs">مالک</Link>
            )}
            <Link href="/dashboard" className="btn btn-ghost !py-1.5 text-xs">پنل کاربری</Link>
            <Link href="/logout" className="btn btn-ghost !py-1.5 text-xs">خروج</Link>
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
