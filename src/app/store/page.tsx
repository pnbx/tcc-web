import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/SiteHeader";
import { priceLabel } from "@/components/format";
import { AddToCart, CartBadge, PerkList, type ProductCardData } from "@/components/StoreCard";
import { mustConnectTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export default async function StorePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [auth, settings, categories, products] = await Promise.all([
    getAuth(),
    getSettings(),
    prisma.productCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { available: true, ...(category ? { category: { slug: category } } : {}) },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        category: { select: { name: true, slug: true } },
        durations: { where: { active: true }, orderBy: { months: "asc" } },
      },
    }),
  ]);

  const needsTelegram = auth ? mustConnectTelegram(auth.user) : false;

  if (!settings.storeEnabled) {
    return (
      <div className="min-h-screen">
        <SiteHeader authed={!!auth} />
        <main className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-2xl font-black mb-3">استور موقتاً بسته است</h1>
          <p className="text-[var(--c-text-dim)]">به‌زودی بازمی‌گردیم.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />
      <main className="max-w-6xl mx-auto px-4 py-10 fade-up">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-display text-3xl font-black">استور TCC</h1>
          <div className="flex items-center gap-2">
            <CartBadge />
          </div>
        </div>
        <p className="text-sm text-[var(--c-text-dim)] mb-6">
          همه‌ی رنک‌ها ۱، ۳ و ۱۲ ماهه هستند. قبل از پرداخت، دقیقاً می‌بینی چه مزیت‌هایی فعال می‌شود.
        </p>

        {needsTelegram ? (
          <Link href="/connect-telegram" className="block card p-4 mb-6 border-r-4 border-[var(--c-pink)]">
            <b>⚠️ قبل از خرید باید تلگرامت را وصل کنی</b>
            <span className="block text-xs text-[var(--c-text-dim)] mt-1">
              برای اطلاع‌رسانی پایان رنک، اتصال تلگرام الزامی است — اینجا وصلش کن.
            </span>
          </Link>
        ) : null}

        {/* AI studios: design it yourself, pay only when you like it */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <Link href="/store/prefix" className="block cta-banner p-5 hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎨</span>
              <span className="min-w-0">
                <span className="block font-heading font-bold mb-1">استودیوی پریفیکس</span>
                <span className="block text-sm text-[var(--c-text-dim)] leading-6">
                  بگو چه پیشوندی می‌خواهی؛ هوش مصنوعی می‌سازد و پیش‌نمایش واقعی می‌بینی.
                </span>
              </span>
            </div>
          </Link>
          <Link href="/store/tag" className="block cta-banner p-5 hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center gap-4">
              <span className="text-3xl">✦</span>
              <span className="min-w-0">
                <span className="block font-heading font-bold mb-1">دستیار تگ اختصاصی</span>
                <span className="block text-sm text-[var(--c-text-dim)] leading-6">
                  رنک را بخر، تگ کنار اسمت را خودت انتخاب کن — مثلاً رنک Mythic با تگ GOD.
                </span>
              </span>
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <Link href="/store" className={`badge ${!category ? "badge-pink" : ""}`}>همه</Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/store?category=${c.slug}`} className={`badge ${category === c.slug ? "badge-pink" : ""}`}>
              {c.name}
            </Link>
          ))}
          <Link href="/ranks" className="badge">مقایسه‌ی کامل رنک‌ها ←</Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            let perks: string[] = [];
            try {
              const parsed = JSON.parse(p.perks) as unknown;
              if (Array.isArray(parsed)) perks = parsed.filter((x): x is string => typeof x === "string");
            } catch {
              perks = [];
            }
            const data: ProductCardData = {
              slug: p.slug,
              name: p.name,
              description: p.description,
              kind: p.kind,
              rankKey: p.rankKey,
              priceCents: p.priceCents,
              durations: p.durations.map((d) => ({ months: d.months, days: d.days, priceCents: d.priceCents, label: d.label })),
              perks,
              categoryName: p.category.name,
            };

            return (
              <div key={p.id} className="card p-6 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-heading font-bold">{p.name}</h2>
                  <span className="badge">{p.category.name}</span>
                </div>
                <p className="text-sm text-[var(--c-text-dim)] leading-6">{p.description}</p>
                <PerkList perks={perks} limit={4} />
                <div className="mt-auto pt-4">
                  {p.durations.length === 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="num text-lg font-bold text-[var(--c-pink)]">{priceLabel(p.priceCents, p.currency)}</span>
                      <span className="badge">قیمت پایه</span>
                    </div>
                  ) : null}
                  <AddToCart product={data} authed={!!auth} />
                  {p.duration && p.duration !== "permanent" && p.durations.length === 0 ? (
                    <div className="text-xs text-[var(--c-text-faint)] mt-3">مدت: {p.duration}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {products.length === 0 && (
          <div className="card p-10 text-center text-[var(--c-text-dim)]">محصولی در این دسته نیست.</div>
        )}
      </main>
    </div>
  );
}
