import Link from "next/link";
import { getCachedStatus, MC_HOST, MC_PORT } from "@/lib/mc";
import { getSettings } from "@/lib/settings";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SiteHeader } from "@/components/SiteHeader";
import { CopyIp } from "@/components/CopyIp";
import { TierBadge } from "@/components/TierBadge";
import { formatNumber, formatDate, priceLabel } from "@/components/format";

export const dynamic = "force-dynamic";

const GAME_MODES = [
  { key: "sword", name: "شمشیر", desc: "دئل‌های 1v1 با شمشیر — لیگ اصلی تیر TCC." },
  { key: "axe", name: "تبر", desc: "مبارزه با تبر و سپر؛ سرعت بالا و تایمینگ دقیق." },
  { key: "nethpot", name: "نت‌پات", desc: "کلاسیک NetherPot با پچ‌های اختصاصی TCC." },
  { key: "uhc", name: "UHC", desc: "USpeedUHC و مبارزه‌های سلامت‌محور." },
];

export default async function HomePage() {
  const [status, settings, auth] = await Promise.all([
    getCachedStatus(),
    getSettings(),
    getAuth(),
  ]);

  const [latestNews, topTiers, storeProducts] = await Promise.all([
    prisma.newsArticle.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: { author: { select: { username: true } }, category: { select: { name: true } } },
    }).catch(() => []),
    prisma.playerTier.findMany({
      where: { category: { key: "sword" }, tier: { position: { lte: 3 } } },
      include: { account: { select: { username: true } }, tier: true, category: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }).catch(() => []),
    prisma.product.findMany({
      where: { available: true, category: { slug: "ranks" } },
      orderBy: { position: "asc" },
      take: 3,
    }).catch(() => []),
  ]);

  const online = status.online;

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-10 fade-up">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <div className="badge badge-purple mb-4">شبکه‌ی ماینکرفت TCC</div>
            <h1 className="font-display text-4xl md:text-5xl font-black leading-[1.25] mb-4">
              {settings.heroHeadline}
            </h1>
            <p className="text-[var(--c-text-dim)] text-lg leading-8 max-w-xl mb-8">
              {settings.heroSubline}
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-8">
              <a href={`minecraft://${MC_HOST}`} className="btn btn-primary !px-6 !py-3 text-base">
                بازی کن
              </a>
              <CopyIp ip={MC_HOST} className="!px-6 !py-3 text-base" />
              <Link href="/dashboard" className="btn btn-ghost !px-5 !py-3">پنل کاربری</Link>
            </div>

            <div className="card inline-flex items-center gap-3 px-4 py-3">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${online ? "bg-[var(--c-green)]" : "bg-[var(--c-red)]"}`}
                aria-hidden
              />
              <span className="mono text-sm select-all">
                {MC_HOST}
                {MC_PORT !== 25565 ? `:${MC_PORT}` : ""}
              </span>
              <span className="text-xs text-[var(--c-text-faint)]">
                {online
                  ? `آنلاین — ${formatNumber(status.playersOnline ?? 0)}/${formatNumber(status.playersMax ?? 0)} بازیکن`
                  : "سرور آفلاین"}
              </span>
            </div>
          </div>

          {/* Status card */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-bold text-lg">وضعیت سرور</h2>
              <span className={`badge ${online ? "badge-green" : "badge-red"}`}>
                {online ? "آنلاین" : "آفلاین"}
              </span>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--c-text-dim)]">بازیکنان</dt>
                <dd className="num font-semibold">
                  {online ? `${formatNumber(status.playersOnline)} / ${formatNumber(status.playersMax)}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--c-text-dim)]">نسخه</dt>
                <dd className="mono text-xs">{status.version ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--c-text-dim)]">پینگ (سمت سرور سایت)</dt>
                <dd className="num">{status.latencyMs != null ? `${formatNumber(status.latencyMs)} ms` : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--c-text-dim)]">منبع داده</dt>
                <dd className="mono text-xs uppercase">{status.source}</dd>
              </div>
            </dl>
            {status.motd?.clean?.length ? (
              <div className="mt-5 border-t hairline pt-4">
                <div className="text-xs text-[var(--c-text-faint)] mb-1">MOTD</div>
                {status.motd.clean.map((line, i) => (
                  <div key={i} className="mono text-xs text-[var(--c-text-dim)]">{line}</div>
                ))}
              </div>
            ) : null}
            {!online && status.error ? (
              <p className="mt-4 text-xs text-[var(--c-text-faint)] mono">{status.error}</p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Game modes */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-heading text-2xl font-bold">حالت‌های بازی</h2>
          <Link href="/tiers" className="text-sm text-[var(--c-pink)] hover:underline">لیست تیر ←</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GAME_MODES.map((m) => (
            <Link key={m.key} href={`/tiers?category=${m.key}`} className="card p-5 hover:border-[var(--c-border-strong)] transition-colors group">
              <div className="font-heading font-bold mb-2 group-hover:text-[var(--c-pink)] transition-colors">{m.name}</div>
              <p className="text-sm text-[var(--c-text-dim)] leading-6">{m.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured tiers */}
      {topTiers.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold">بازیکنان برتر</h2>
            <Link href="/tiers?category=sword" className="text-sm text-[var(--c-pink)] hover:underline">همه‌ی تیرها ←</Link>
          </div>
          <div className="card divide-y" style={{ borderColor: "var(--c-border)" }}>
            {topTiers.map((pt) => (
              <Link
                key={pt.id}
                href={`/players/${pt.account.username}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[rgba(139,92,246,0.04)] transition-colors"
              >
                <TierBadge name={pt.tier.name} />
                <span className="font-ui font-semibold">{pt.account.username}</span>
                <span className="ms-auto text-xs text-[var(--c-text-faint)]">{pt.category.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest news */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-heading text-2xl font-bold">آخرین اخبار</h2>
          <Link href="/news" className="text-sm text-[var(--c-pink)] hover:underline">آرشیو اخبار ←</Link>
        </div>
        {latestNews.length === 0 ? (
          <div className="card p-8 text-center text-[var(--c-text-dim)]">هنوز خبری منتشر نشده است.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {latestNews.map((a) => (
              <Link key={a.id} href={`/news/${a.slug}`} className="card p-5 hover:border-[var(--c-border-strong)] transition-colors">
                <div className="flex items-center gap-2 mb-3 text-xs text-[var(--c-text-faint)]">
                  {a.category && <span className="badge badge-purple">{a.category.name}</span>}
                  <span>{formatDate(a.publishedAt ?? a.createdAt)}</span>
                </div>
                <h3 className="font-heading font-bold mb-2 leading-7">{a.title}</h3>
                {a.excerpt && <p className="text-sm text-[var(--c-text-dim)] leading-6 line-clamp-3">{a.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Store teaser */}
      {storeProducts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold">استور</h2>
            <Link href="/store" className="text-sm text-[var(--c-pink)] hover:underline">همه‌ی محصولات ←</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {storeProducts.map((p) => (
              <Link key={p.id} href="/store" className="card p-5 hover:border-[var(--c-border-strong)] transition-colors">
                <div className="font-heading font-bold mb-2">{p.name}</div>
                <p className="text-sm text-[var(--c-text-dim)] line-clamp-2 mb-3">{p.description}</p>
                <div className="num text-[var(--c-pink)] font-semibold">{priceLabel(p.priceCents, p.currency)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
