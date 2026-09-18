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
  {
    key: "sword",
    name: "شمشیر",
    desc: "دئل‌های 1v1 با شمشیر — لیگ اصلی تیر TCC.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M14.5 3.5 20 9l-8.5 8.5a3 3 0 0 1-4.24 0l-.76-.76a3 3 0 0 1 0-4.24L14.5 3.5Z" />
        <path d="M4 20l3-3M9.5 14.5 7 12l-2 2 2.5 2.5L5 19l-1 1" />
      </svg>
    ),
  },
  {
    key: "axe",
    name: "تبر",
    desc: "مبارزه با تبر و سپر؛ سرعت بالا و تایمینگ دقیق.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M17 3l4 4-7 2-3 3-2-2 3-3 5-4z" />
        <path d="M9 10 4 15l5 5 5-5" />
        <path d="M9 15l-4 5" />
      </svg>
    ),
  },
  {
    key: "nethpot",
    name: "نت‌پات",
    desc: "کلاسیک NetherPot با پچ‌های اختصاصی TCC.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M9 3h6M10 3v4l-4.5 8A3.5 3.5 0 0 0 8.6 20h6.8a3.5 3.5 0 0 0 3.1-5L14 7V3" />
        <path d="M7.5 14h9" />
      </svg>
    ),
  },
  {
    key: "uhc",
    name: "UHC",
    desc: "USpeedUHC و مبارزه‌های سلامت‌محور.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    n: "01",
    title: "وارد شو",
    desc: `ماینکرفت جاوا ۱.۲۱+ رو باز کن و به آدرس زیر وصل شو. بدون ماد، بدون تنظیمات اضافه.`,
    code: MC_HOST,
  },
  {
    n: "02",
    title: "حسابت رو وصل کن",
    desc: "توی پنل کاربری یه کد بگیر و با دستور /tccweb link توی بازی وصلش کن — پروفایل و آمارت فعال می‌شه.",
    code: "/tccweb link",
  },
  {
    n: "03",
    title: "تیر بگیر",
    desc: "توی دئل‌ها رتبه جمع کن، از برنز تا الماس صعود کن و اسمت بالای جدول فیکس بشه.",
    code: "/duel",
  },
];

export default async function HomePage() {
  const [status, settings, auth] = await Promise.all([
    getCachedStatus(),
    getSettings(),
    getAuth(),
  ]);

  const [latestNews, topTiers, storeProducts, modeCategories] = await Promise.all([
    prisma.newsArticle.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 3,
      include: { author: { select: { username: true } }, category: { select: { name: true } } },
    }).catch(() => []),
    prisma.playerTier.findMany({
      where: { category: { key: "sword" } },
      include: { account: { select: { username: true } }, tier: true, category: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }).catch(() => []),
    prisma.product.findMany({
      where: { available: true },
      orderBy: { position: "asc" },
      take: 3,
    }).catch(() => []),
    prisma.tierCategory.findMany({
      select: { id: true, key: true, name: true, _count: { select: { tiers: true, playerTiers: true } } },
    }).catch(() => []),
  ]);

  const online = status.online;
  const totalTiers = modeCategories.reduce((a, c) => a + c._count.tiers, 0);
  const rankedPlayers = modeCategories.reduce((a, c) => a + c._count.playerTiers, 0);
  const podium = topTiers.slice(0, 3);

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />

      {/* ══════════ Hero ══════════ */}
      <section className="relative overflow-hidden">
        {/* layered background */}
        <div aria-hidden className="absolute inset-0 hero-bg" />
        <div aria-hidden className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.07) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)" }} />
        {/* floating cubes */}
        <div aria-hidden className="hero-cube hero-cube-1" />
        <div aria-hidden className="hero-cube hero-cube-2" />
        <div aria-hidden className="hero-cube hero-cube-3" />

        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
            <div className="fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--c-border-strong)] bg-[rgba(139,92,246,0.08)] px-3.5 py-1.5 text-xs font-ui font-semibold text-[#c4b5fd] mb-6">
                <span className={`live-dot ${online ? "live-dot-on" : "live-dot-off"}`} />
                {online
                  ? `${formatNumber(status.playersOnline ?? 0)} بازیکن همین حالا آنلاینه`
                  : "سرور در حال بوت است"}
                <span className="w-px h-3 bg-[var(--c-border-strong)]" />
                <span className="text-[var(--c-text-faint)] mono">1.21.4</span>
              </div>

              <h1 className="font-display text-4xl md:text-6xl font-black leading-[1.3] mb-5">
                {settings.heroHeadline.split(" ").slice(0, -1).join(" ")}{" "}
                <span className="text-gradient">{settings.heroHeadline.split(" ").slice(-1)}</span>
              </h1>
              <p className="text-[var(--c-text-dim)] text-lg leading-9 max-w-xl mb-9">
                {settings.heroSubline}
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <a href={`minecraft://${MC_HOST}`} className="btn btn-primary !px-7 !py-3.5 text-base hero-cta">
                  بازی کن — رایگانه
                </a>
                <CopyIp ip={MC_HOST} className="!px-6 !py-3.5 text-base" />
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-[var(--c-text-faint)] font-ui">آدرس سرور:</span>
                <span className="ip-address font-semibold text-[var(--c-text)] text-base select-all">
                  {MC_HOST}
                  {MC_PORT !== 25565 ? `:${MC_PORT}` : ""}
                </span>
              </div>
            </div>

            {/* Server panel */}
            <div className="fade-up lg:justify-self-end w-full max-w-sm">
              <div className="card-glow relative p-6">
                <div className="flex items-center gap-4 mb-6">
                  {status.favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`data:image/png;base64,${status.favicon}`} alt="آیکون سرور" className="w-14 h-14 rounded-xl pixelated border hairline" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--c-purple-deep)] to-[var(--c-pink-strong)] grid place-items-center font-heading font-black text-xl">T</div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold truncate">{MC_HOST}</span>
                      <span className={`badge ${online ? "badge-green" : "badge-red"}`}>{online ? "آنلاین" : "آفلاین"}</span>
                    </div>
                    <div className="mono text-xs text-[var(--c-text-faint)] mt-1">
                      {status.version ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="stat-box">
                    <div className="stat-num">{online ? formatNumber(status.playersOnline ?? 0) : "—"}</div>
                    <div className="stat-label">از {online ? formatNumber(status.playersMax ?? 0) : "—"} بازیکن</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-num">{status.latencyMs != null ? formatNumber(status.latencyMs) : "—"}</div>
                    <div className="stat-label">میلی‌ثانیه پینگ</div>
                  </div>
                </div>

                {status.motd?.clean?.length ? (
                  <div className="rounded-lg bg-[#07060c] border hairline p-3">
                    {status.motd.clean.map((line, i) => (
                      <div key={i} className="mono text-[11px] text-[var(--c-text-dim)] leading-5">{line}</div>
                    ))}
                  </div>
                ) : null}
              </div>

              <p className="text-[11px] text-[var(--c-text-faint)] text-center mt-3 font-ui">
                وضعیت زنده — مستقیم از سرور، بدون کش طولانی
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ Stats strip ══════════ */}
      <section className="max-w-6xl mx-auto px-4 -mt-2 mb-6">
        <div className="card grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse hairline overflow-hidden">
          <Stat label="بازیکن رتبه‌دار" value={formatNumber(rankedPlayers)} />
          <Stat label="تیر تعریف‌شده" value={formatNumber(totalTiers)} />
          <Stat label="حالت بازی" value={formatNumber(modeCategories.length || 4)} />
          <Stat label="محصول استور" value={formatNumber(storeProducts.length)} />
        </div>
      </section>

      {/* ══════════ Steps ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <SectionHead title="چطور شروع کنم؟" kicker="سه قدم تا اولین دئل" />
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6 relative overflow-hidden group">
              <div className="text-5xl font-display font-black text-[rgba(139,92,246,0.14)] absolute -top-2 end-3 select-none group-hover:text-[rgba(236,72,153,0.2)] transition-colors">{s.n}</div>
              <h3 className="font-heading font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-[var(--c-text-dim)] leading-7 mb-4">{s.desc}</p>
              <code className="chip-code">{s.code}</code>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ Game modes ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <SectionHead
          title="حالت‌های بازی"
          kicker="هر حالت، یک لیگ مستقل با تیرهای خودش"
          link={{ href: "/tiers", label: "همه‌ی تیرها" }}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {GAME_MODES.map((m) => {
            const cat = modeCategories.find((c) => c.key === m.key);
            return (
              <Link key={m.key} href={`/tiers?category=${m.key}`} className="mode-card group">
                <div className="mode-icon">{m.icon}</div>
                <div className="font-heading font-bold text-lg mb-1.5 group-hover:text-[var(--c-pink)] transition-colors">{m.name}</div>
                <p className="text-sm text-[var(--c-text-dim)] leading-6 mb-4">{m.desc}</p>
                <div className="mt-auto flex items-center gap-2 text-xs text-[var(--c-text-faint)]">
                  <span className="badge badge-purple">{formatNumber(cat?._count.playerTiers ?? 0)} بازیکن</span>
                  <span className="badge">{formatNumber(cat?._count.tiers ?? 0)} تیر</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ══════════ Top players podium ══════════ */}
      {podium.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-14">
          <SectionHead
            title="صدرنشین‌های لیگ شمشیر"
            kicker="بازیکنانی که بالاترین تیر رو در اختیار دارن"
            link={{ href: "/tiers?category=sword", label: "جدول کامل" }}
          />
          <div className="grid md:grid-cols-3 gap-5">
            {podium.map((pt, i) => (
              <Link key={pt.id} href={`/players/${pt.account.username}`} className={`podium-card ${i === 0 ? "podium-first" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                  <TierBadge name={pt.tier.name} />
                  <span className="rank-chip">#{formatNumber(i + 1)}</span>
                </div>
                <div className="font-heading font-black text-2xl mb-1">{pt.account.username}</div>
                <div className="text-xs text-[var(--c-text-faint)] font-ui">{pt.category.name} — آخرین تغییر {formatDate(pt.updatedAt)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════ News ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <SectionHead title="اخبار و بروزرسانی‌ها" kicker="جدیدترین اتفاق‌های شبکه" link={{ href: "/news", label: "آرشیو اخبار" }} />
        {latestNews.length === 0 ? (
          <div className="card p-10 text-center text-[var(--c-text-dim)]">هنوز خبری منتشر نشده است.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {latestNews.map((a) => (
              <Link key={a.id} href={`/news/${a.slug}`} className="card p-6 hover:border-[var(--c-border-strong)] hover:-translate-y-0.5 transition-all duration-200">
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

      {/* ══════════ Store CTA ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="cta-banner p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-1">
              <h2 className="font-display text-2xl md:text-3xl font-black mb-3">رنک بگیر، مزایا بگیر</h2>
              <p className="text-[var(--c-text-dim)] leading-8">
                رنک‌های Elite و VIP با پرداخت آنلاین چندثانیه‌ای روی سرور اعمال می‌شن — پرداخت با تمام درگاه‌های بانکی، تحویل خودکار.
              </p>
            </div>
            <div className="flex md:flex-col gap-3 shrink-0">
              <Link href="/store" className="btn btn-primary !px-8 !py-3.5 text-base">مشاهده استور</Link>
              <Link href="/dashboard" className="btn btn-ghost !px-8 !py-3.5">پنل کاربری</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHead({ title, kicker, link }: { title: string; kicker?: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-end justify-between mb-7">
      <div>
        {kicker && <div className="text-xs font-ui font-semibold text-[var(--c-pink)] tracking-wide mb-1.5">{kicker}</div>}
        <h2 className="font-heading text-2xl md:text-3xl font-bold">{title}</h2>
      </div>
      {link && <Link href={link.href} className="text-sm font-ui text-[var(--c-text-dim)] hover:text-[var(--c-pink)] transition-colors whitespace-nowrap">{link.label} ←</Link>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 text-center">
      <div className="font-display text-2xl md:text-3xl font-black text-gradient">{value}</div>
      <div className="text-xs font-ui text-[var(--c-text-faint)] mt-1">{label}</div>
    </div>
  );
}
