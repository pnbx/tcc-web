import { getAuth, hasPermission } from "@/lib/auth";
import { ConsoleView } from "@/components/ConsoleView";

export const dynamic = "force-dynamic";

export default async function DeveloperConsolePage() {
  const auth = await getAuth();
  if (!auth) return null;
  return (
    <div className="fade-up">
      <h1 className="font-display text-2xl font-black mb-2">کنسول سرور</h1>
      <p className="text-sm text-[var(--c-text-dim)] mb-6">
        جستجو، فیلتر سطح، اسکرول خودکار و تاریخچه دستور. خروجی فقط از سرور واقعی.
      </p>
      <ConsoleView canCommand={hasPermission(auth.permissions, "server.command")} />
    </div>
  );
}
