import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/SiteHeader";
import { priceLabel } from "@/components/format";

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
      include: { category: { select: { name: true, slug: true } } },
    }),
  ]);

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
        <h1 className="font-display text-3xl font-black mb-2">استور TCC</h1>
        <p className="text-sm text-[var(--c-text-dim)] mb-6">
          پس از پرداخت تأییدشده، محصولات به‌صورت خودکار روی سرور اعمال می‌شوند.
        </p>

        {/* AI prefix studio: design and preview for free, pay only when you like it */}
        <Link href="/store/prefix" className="block cta-banner p-5 mb-8 hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🎨</span>
            <span className="min-w-0">
              <span className="block font-heading font-bold mb-1">استودیوی پریفیکس — خودت طراحی کن</span>
              <span className="block text-sm text-[var(--c-text-dim)] leading-6">
                توضیح بده چه پیشوندی می‌خواهی؛ هوش مصنوعی آن را می‌سازد و <b>پیش‌نمایش واقعی در چت بازی</b> را می‌بینی.
                رایگان امتحان کن، فقط وقتی خوشت آمد بخر.
              </span>
            </span>
            <span className="ms-auto badge badge-pink shrink-0 hidden sm:inline-flex">رایگان امتحان کن ←</span>
          </div>
        </Link>

        <div className="flex flex-wrap gap-2 mb-8">
          <Link href="/store" className={`badge ${!category ? "badge-pink" : ""}`}>همه</Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/store?category=${c.slug}`} className={`badge ${category === c.slug ? "badge-pink" : ""}`}>
              {c.name}
            </Link>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="card p-6 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <h2 className="font-heading font-bold">{p.name}</h2>
                <span className="badge">{p.category.name}</span>
              </div>
              <p className="text-sm text-[var(--c-text-dim)] leading-6 mb-4">{p.description}</p>
              <div className="mt-auto flex items-center justify-between">
                <span className="num text-lg font-bold text-[var(--c-pink)]">{priceLabel(p.priceCents, p.currency)}</span>
                {auth ? (
                  <form action="/store/checkout" method="get">
                    <input type="hidden" name="slug" value={p.slug} />
                    <button className="btn btn-primary !py-1.5" type="submit">خرید</button>
                  </form>
                ) : (
                  <Link href="/login" className="btn btn-ghost !py-1.5">ورود برای خرید</Link>
                )}
              </div>
              {p.duration && p.duration !== "permanent" ? (
                <div className="text-xs text-[var(--c-text-faint)] mt-3">مدت: {p.duration}</div>
              ) : null}
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="card p-10 text-center text-[var(--c-text-dim)]">محصولی در این دسته نیست.</div>
        )}
      </main>
    </div>
  );
}
