import { getAuth, hasPermission } from "@/lib/auth";
import { ConsoleView } from "@/components/ConsoleView";

export const dynamic = "force-dynamic";

export default async function OwnerConsolePage() {
  const auth = await getAuth();
  if (!auth) return null;

  return (
    <div className="fade-up">
      <h1 className="font-display text-2xl font-black mb-2">کنسول زنده سرور</h1>
      <p className="text-sm text-[var(--c-text-dim)] mb-6">
        لاگ‌های واقعی سرور — از طریق پلاگین TCC Bridge. بدون اتصال بریج، این صفحه داده‌ای نمایش نمی‌دهد.
      </p>
      <ConsoleView canCommand={hasPermission(auth.permissions, "server.command")} />
    </div>
  );
}
