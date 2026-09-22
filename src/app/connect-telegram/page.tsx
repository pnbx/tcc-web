import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { TelegramConnect } from "./TelegramConnect";

export const dynamic = "force-dynamic";

export default async function ConnectTelegramPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const auth = await getAuth();
  if (!auth) redirect("/login?next=/connect-telegram");
  const { next } = await searchParams;
  const target = next && next.startsWith("/") ? next : "/store";

  return (
    <div className="min-h-screen">
      <SiteHeader authed />
      <main className="max-w-lg mx-auto px-4 py-12 fade-up">
        <TelegramConnect next={target} />
      </main>
    </div>
  );
}
