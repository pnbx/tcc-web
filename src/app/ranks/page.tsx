import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { RANKS, DURATIONS } from "@/lib/ranks";
import { priceLabel } from "@/components/format";

export const dynamic = "force-dynamic";

// Full ladder + prices + every perk, so a member can compare before buying.
export default async function RanksPage() {
  const [auth, products] = await Promise.all([
    getAuth(),
    prisma.product.findMany({
      where: { available: true, rankKey: { not: null } },
      include: { durations: { where: { active: true }, orderBy: { months: "asc" } } },
    }),
  ]);

  const byRank = new Map(products.map((p) => [p.rankKey!, p]));
  const ladder = RANKS.filter((r) => r.order > 0);

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />
      <main className="max-w-6xl mx-auto px-4 py-10 fade-up">
        <h1 className="font-display text-3xl font-black mb-2">رنک‌های TCC</h1>
        <p className="text-sm text-[var(--c-text-dim)] mb-8">
          همه‌ی رنک‌ها ۱ ماهه، ۳ ماهه و ۱۲ ماهه فروخته می‌شوند و هر کدام همه‌ی مزیت‌های رنک‌های پایین‌تر را هم دارد.
          بعد از پرداخت، رنک و دسترسی‌هایش خودکار روی سرور فعال می‌شود و پایانش در تلگرام به تو اطلاع داده می‌شود.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ladder.map((rank) => {
            const product = byRank.get(rank.key);
            const durations = product?.durations ?? [];
            const oneMonth = durations.find((d) => d.months === 1)?.priceCents ?? rank.priceCents;
            return (
              <div key={rank.key} className="card p-5 flex flex-col" style={{ borderTop: `3px solid ${rank.color}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl" style={{ color: rank.color }}>{rank.icon}</span>
                  <h2 className="font-heading font-bold" style={{ color: rank.color }}>{rank.name}</h2>
                </div>
                <p className="text-xs text-[var(--c-text-dim)] mb-3">{rank.tagline}</p>

                <ul className="text-xs text-[var(--c-text-dim)] space-y-1 mb-4">
                  {rank.perks.slice(0, 6).map((p) => (
                    <li key={p} className="flex gap-1.5">
                      <span style={{ color: rank.color }}>✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                  {rank.perks.length > 6 ? (
                    <li className="text-[var(--c-text-faint)]">+{rank.perks.length - 6} مزیت دیگر</li>
                  ) : null}
                </ul>

                <div className="mt-auto">
                  <div className="text-[11px] text-[var(--c-text-faint)] mb-1">ماهانه از</div>
                  <div className="num text-lg font-bold mb-3" style={{ color: rank.color }}>
                    {rank.priceCents > 0 ? priceLabel(oneMonth, "IRT") : "فقط با کد ریدیم"}
                  </div>

                  {durations.length ? (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {durations.map((d) => (
                        <span key={d.months} className="badge text-[10px]">
                          {d.label || `${d.months} ماهه`} · {priceLabel(d.priceCents, "IRT")}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[var(--c-text-faint)] mb-3">
                      {DURATIONS.map((d) => d.label).join(" · ")}
                    </div>
                  )}

                  {rank.priceCents > 0 ? (
                    <Link href="/store?category=ranks" className="btn btn-primary w-full !py-1.5">خرید</Link>
                  ) : (
                    <Link href="/redeem" className="btn btn-ghost w-full !py-1.5">با کد ریدیم</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
