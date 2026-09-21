import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth, hasPermission } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

const links = [
  { href: "/tester", label: "دادن تیر" },
  { href: "/tester/tiers", label: "تعریف تیرها" },
];

export default async function TesterLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!hasPermission(auth.permissions, "panel.tester") && !hasPermission(auth.permissions, "tiers.assign")) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(10,8,18,0.75)] border-b hairline">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/tester" className="font-heading font-black">
            TCC <span className="text-gradient">TESTER</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link">
                {l.label}
              </Link>
            ))}
            <Link href="/tiers" className="nav-link">
              جدول عمومی تیرها
            </Link>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <span className="badge badge-purple hidden sm:inline-flex">{auth.user.username}</span>
            <Link href="/dashboard" className="btn btn-ghost !py-1.5 text-xs">
              پنل کاربری
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link whitespace-nowrap">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
