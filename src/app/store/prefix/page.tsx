import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { designPrefix, PREFIX_PRODUCTS, type PrefixTier } from "@/lib/prefix-studio";
import { priceLabel } from "@/components/format";
import { PrefixBuy } from "./buy";

export const dynamic = "force-dynamic";

// AI prefix studio checkout: the bot (or the store) sends the player here with
// their request, the server re-designs it, shows a chat-style preview and the
// price tier, and the buy button creates the order with the exact command.
export default async function PrefixStudioPage({ searchParams }: { searchParams: Promise<{ q?: string; design?: string }> }) {
  const auth = await getAuth();
  if (!auth) redirect("/login");

  const { q, design } = await searchParams;
  const request = (q ?? "").trim();
  const designed = request ? await designPrefix(request) : null;

  const tier: PrefixTier | null = designed?.ok ? designed.design.tier : null;
  const product = tier
    ? (await prisma.product.findUnique({ where: { slug: PREFIX_PRODUCTS[tier].slug } })) ?? null
    : null;

  return (
    <div className="min-h-screen">
      <SiteHeader authed />
      <main className="max-w-2xl mx-auto px-4 py-10 fade-up space-y-6">
        <div>
          <h1 className="font-display text-2xl font-black mb-2">🎨 استودیوی پریفیکس</h1>
          <p className="text-sm text-[var(--c-text-dim)] leading-7">
            توضیح بده چه پیشوندی می‌خواهی؛ هوش مصنوعی آن را طراحی می‌کند، پیش‌نمایش را می‌بینی، و بعد از پرداخت
            خودکار روی سرور اعمال می‌شود.
          </p>
        </div>

        <form method="get" className="card p-5 space-y-3">
          <label className="label" htmlFor="q">چه پیشوندی می‌خواهی؟</label>
          <input
            id="q"
            name="q"
            defaultValue={request}
            className="input"
            placeholder="مثلاً: بنفش به صورتی با گرادیانت و بولد"
          />
          <button className="btn btn-primary w-full !py-2.5">طراحی کن</button>
        </form>

        {request && !designed?.ok && (
          <div className="badge badge-red w-full justify-center">{designed?.error ?? "طراحی ناموفق بود."}</div>
        )}

        {designed?.ok && product && (
          <div className="card p-6 space-y-5">
            <div>
              <div className="text-xs text-[var(--c-text-faint)] mb-2">پیش‌نمایش در چت بازی</div>
              {/* fake chat line */}
              <div className="rounded-lg bg-[#0b0b0f] border hairline px-4 py-3 font-ui text-sm">
                <span className="text-[#6b7280]">[</span>
                {designed.design.preview.map((token, i) => (
                  <span
                    key={i}
                    style={{
                      color: token.color?.startsWith("linear-gradient") ? "transparent" : token.color,
                      backgroundImage: token.color?.startsWith("linear-gradient") ? token.color : undefined,
                      backgroundClip: token.color?.startsWith("linear-gradient") ? "text" : undefined,
                      fontWeight: token.bold ? 800 : undefined,
                      fontStyle: token.italic ? "italic" : undefined,
                    }}
                  >
                    {token.text}
                  </span>
                ))}
                <span className="text-[#6b7280]">]</span>
                <span className="text-[#9ca3af]"> PlayerName</span>
                <span className="text-[#4b5563]"> : سلام، چه خبر؟</span>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="stat-box">
                <div className="stat-num">{priceLabel(product.priceCents, product.currency)}</div>
                <div className="stat-label">قیمت</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">{[...designed.design.label].length}</div>
                <div className="stat-label">طول پیشوند</div>
              </div>
            </dl>

            <div>
              <div className="text-xs text-[var(--c-text-faint)] mb-1.5">کد فنی (MiniMessage)</div>
              <code className="chip-code block break-all">{designed.design.miniMessage}</code>
            </div>

            <PrefixBuy
              slug={product.slug}
              design={designed.design.miniMessage}
              canBuy={Boolean(auth.user && !auth.user.banned)}
            />

            <p className="text-[11px] text-[var(--c-text-faint)] leading-5">
              بعد از تأیید پرداخت، دستور اعمال پریفیکس در صف قرار می‌گیرد و حداکثر تا ۳۰ ثانیه روی سرور اجرا می‌شود.
              حساب ماینکرفتت باید در <Link href="/dashboard/profile" className="text-[var(--c-pink)]">پنل کاربری</Link> وصل شده باشد.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
