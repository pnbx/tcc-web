import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth, hasPermission } from "@/lib/auth";
import { RedeemManager } from "./RedeemManager";

export const dynamic = "force-dynamic";

export default async function OwnerRedeemPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!hasPermission(auth.permissions, "panel.owner")) redirect("/dashboard");

  return (
    <div className="fade-up">
      <h1 className="font-display text-2xl font-black mb-2">کدهای ریدیم</h1>
      <p className="text-sm text-[var(--c-text-dim)] mb-6">
        کدهایی بساز که اعضا با آن رنک، مدت و تخفیف می‌گیرند — مثلاً «Mythic، ۱ ماه، ۱۰ نفر، ۱۰٪ تخفیف».
        اعضا کد را در صفحه‌ی <Link href="/redeem" className="text-[var(--c-pink)] underline">/redeem</Link> وارد می‌کنند.
      </p>
      <RedeemManager />
    </div>
  );
}
