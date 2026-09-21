import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth, hasPermission } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect("/login");

  const can = (p: string) => hasPermission(auth.permissions, p);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[rgba(10,8,18,0.85)] border-b hairline">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="font-heading font-extrabold text-lg">
            TCC <span className="text-[var(--c-pink)]">MC</span>
          </Link>
          <span className="text-xs text-[var(--c-text-faint)]">پنل کاربری</span>
          <div className="ms-auto flex items-center gap-2">
            {can("panel.admin") && <Link href="/admin" className="btn btn-ghost !py-1.5 text-xs">ادمین</Link>}
            {can("panel.owner") && <Link href="/owner" className="btn btn-ghost !py-1.5 text-xs">مالک</Link>}
            {can("panel.developer") && <Link href="/developer" className="btn btn-ghost !py-1.5 text-xs">توسعه‌دهنده</Link>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">{children}</div>
    </div>
  );
}
