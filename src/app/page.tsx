import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getCachedStatus, MC_ADDRESS } from "@/lib/mc";
import { getSettings } from "@/lib/settings";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SiteHeader } from "@/components/SiteHeader";
import { CopyIp } from "@/components/CopyIp";
import { TierBadge } from "@/components/TierBadge";
import { Reveal, CountUp } from "@/components/Reveal";
import { formatNumber, formatDate, priceLabel } from "@/components/format";

export const dynamic = "force-dynamic";

// Public landing data changes rarely; cache it so a cold function does not pay
// six database round-trips on every visit.
const loadLandingData = unstable_cache(
  async () => {
    const [latestNews, topTiers, storeProducts, modeCategories, productCount] = await Promise.all([
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
      prisma.product.count({ where: { available: true } }).catch(() => 0),
    ]);
    return { latestNews, topTiers, storeProducts, modeCategories, productCount };
  },
  ["landing-data"],
  { revalidate: 300, tags: ["landing"] },
);

const GAME_MODES = [
  {
    key: "sword",
    name: "شمشیر",
    tag: "لیگ اصلی",
    desc: "دئل‌های 1v1 با شمشیر — قلب تپنده‌ی لیگ تیر TCC و معتبرترین رتبه‌ی شبکه.",
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
    tag: "پرسرعت",
    desc: "مبارزه با تبر و سپر؛ ترکیب‌بندی سریع، جاخالی‌های کوتاه و تایمینگ دقیق.",
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
    tag: "تاکتیکی",
    desc: "کلاسیک NetherPot با پچ‌های اختصاصی TCC — جنگ جادوها و مدیریت قلب.",
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
    tag: "بقا",
    desc: "USpeedUHC و مبارزه‌های سلامت‌محور — هر قلب ارزش دارد، هر اشتباه پایان است.",
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
    desc: "ماینکرفت جاوا 1.21+ را باز کن و به آدرس سرور وصل شو — بدون مود، بدون تنظیمات اضافه.",
    code: MC_ADDRESS,
  },
  {
    n: "02",
    title: "حسابت را وصل کن",
    desc: "از پنل کاربری کد اتصال بگیر و در بازی دستورش را بزن؛ پروفایل و آمار زنده‌ات فعال می‌شود.",
    code: "/tccweb link",
  },
  {
    n: "03",
    title: "تیر بگیر",
    desc: "در دئل‌ها امتیاز جمع کن، از برنز تا الماس صعود کن و اسمت را بالای جدول ثبت کن.",
    code: "/duel",
  },
];

const FAQS = [
  {
    q: "ورود به سرور رایگان است؟",
    a: "بله. اتصال به سرور TCC کاملاً رایگان است؛ هزینه‌ها فقط برای رنک‌ها و آیتم‌های اختیاری استور است که مزایای ظاهری و رفاهی دارند و تعادل بازی را به هم نمی‌زنند.",
  },
  {
    q: "چطور حساب ماینکرفتم را به سایت وصل کنم؟",
    a: "کافی است وارد پنل کاربری شوید، نام کاربری ماینکرفت را ثبت کنید و کد ۱۵ دقیقه‌ای را با دستور /tccweb link در بازی بزنید. رمز ماینکرفت هرگز به سایت داده نمی‌شود.",
  },
  {
    q: "تیر (Tier) چیست و چطور بالا می‌روم؟",
    a: "تیر، رتبه‌ی مهارتی شما در هر حالت بازی است. با بردن حریف‌های بالاتر از خودتان در دئل‌ها امتیاز می‌گیرید و از برنز به سیلور، گلد و در نهایت الماس صعود می‌کنید.",
  },
  {
    q: "بعد از خرید، رنک کی فعال می‌شود؟",
    a: "پرداخت به‌صورت آنلاین و از طریق درگاه بانکی انجام می‌شود. بلافاصله پس از تأیید درگاه، دستورهای اعطای رنک به‌صورت خودکار روی سرور اجرا می‌شود — معمولاً در چند ثانیه.",
  },
];

// Deterministic skyline heights (no hydration mismatch)
const SKYLINE = [34, 58, 42, 74, 50, 62, 38, 80, 46, 68, 55, 40, 72, 48, 60, 36, 66, 52, 44, 78];

export default async function HomePage() {
  const [status, settings, auth] = await Promise.all([
    getCachedStatus(),
    getSettings(),
    getAuth(),
  ]);

  const { latestNews, topTiers, storeProducts, modeCategories, productCount } = await loadLandingData();

  const online = status.online;
  const state = status.state ?? (online ? "online" : "offline");
  const stateLabel = state === "online" ? "آنلاین" : state === "unknown" ? "نامشخص" : "آفلاین";
  const stateBadge = state === "online" ? "badge-green" : state === "unknown" ? "badge-amber" : "badge-red";
  const lastSeen = status.reportedAt ? formatDate(status.reportedAt) : null;
  const totalTiers = modeCategories.reduce((a, c) => a + c._count.tiers, 0);
  const rankedPlayers = modeCategories.reduce((a, c) => a + c._count.playerTiers, 0);
  const podium = topTiers.slice(0, 3);
  const tickerPlayers = topTiers.map((pt) => pt.account.username);

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />

      {/* ══════════ Hero ══════════ */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0">
          <div className="aurora aurora-1" />
          <div className="aurora aurora-2" />
          <div className="aurora aurora-3" />
        </div>
        <div aria-hidden className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "linear-gradient(rgba(139,92,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.06) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse 90% 75% at 50% 0%, black 30%, transparent 78%)" }} />
        <div aria-hidden className="hero-cube hero-cube-1" />
        <div aria-hidden className="hero-cube hero-cube-2" />
        <div aria-hidden className="hero-cube hero-cube-3" />

        {/* pixel skyline at hero bottom */}
        <div aria-hidden className="skyline">
          {SKYLINE.map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-28 md:pt-32 md:pb-40">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2.5 rounded-full glass px-4 py-2 text-xs font-ui font-semibold text-[#c4b5fd] mb-7">
                  <span className={`live-dot ${state === "online" ? "live-dot-on" : state === "unknown" ? "live-dot-unknown" : "live-dot-off"}`} />
                  {state === "online"
                    ? `${formatNumber(status.playersOnline ?? 0)} بازیکن همین حالا آنلاین است`
                    : state === "unknown"
                      ? "وضعیت زنده در حال بروزرسانی است"
                      : "سرور در حال راه‌اندازی است"}
                  <span className="w-px h-3 bg-[rgba(139,92,246,0.4)]" />
                  <span className="text-[var(--c-text-faint)] mono">1.21.4</span>
                  {state === "online" && <span className="eq" aria-hidden><i /><i /><i /><i /></span>}
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="font-display text-4xl md:text-6xl font-black leading-[1.35] mb-6">
                  {settings.heroHeadline.split(" ").slice(0, -1).join(" ")}{" "}
                  <span className="gradient-text-live">{settings.heroHeadline.split(" ").slice(-1)}</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="text-[var(--c-text-dim)] text-lg leading-9 max-w-xl mb-9">
                  {settings.heroSubline}
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="flex flex-wrap items-center gap-3 mb-10">
                  <a href={`minecraft://${MC_ADDRESS}`} className="btn btn-primary !px-8 !py-4 text-base hero-cta">
                    بازی کن — رایگانه
                  </a>
                  <CopyIp ip={MC_ADDRESS} className="!px-6 !py-4 text-base" />
                </div>
              </Reveal>

              <Reveal delay={320}>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--c-text-faint)] font-ui">آدرس سرور:</span>
                  <span className="ip-address font-semibold text-[var(--c-text)] text-base select-all">
                    {MC_ADDRESS}
                  </span>
                </div>
              </Reveal>
            </div>

            {/* Server HUD */}
            <Reveal delay={200} className="lg:justify-self-end w-full max-w-sm">
              <div className="border-glow">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    {status.favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`data:image/png;base64,${status.favicon}`} alt="آیکون سرور" className="w-14 h-14 rounded-xl pixelated border hairline" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--c-purple-deep)] to-[var(--c-pink-strong)] grid place-items-center font-heading font-black text-xl shadow-[0_8px_30px_-8px_rgba(236,72,153,0.6)]">T</div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold truncate">{MC_ADDRESS}</span>
                        <span className={`badge ${stateBadge}`}>{stateLabel}</span>
                      </div>
                      <div className="mono text-xs text-[var(--c-text-faint)] mt-1">{status.version ?? "—"}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="stat-box">
                      <div className="stat-num">
                        {status.playersOnline != null ? <CountUp value={status.playersOnline} /> : "—"}
                      </div>
                      <div className="stat-label">
                        {status.playersMax != null ? `از ${formatNumber(status.playersMax)} بازیکن` : "بازیکن"}
                      </div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-num">{status.latencyMs != null ? <CountUp value={status.latencyMs} /> : "—"}</div>
                      <div className="stat-label">میلی‌ثانیه پینگ</div>
                    </div>
                  </div>

                  {lastSeen && state !== "online" && (
                    <p className="text-[11px] text-[var(--c-text-faint)] mb-4 font-ui">
                      آخرین گزارش سرور: {lastSeen}
                    </p>
                  )}

                  {status.motd?.clean?.length ? (
                    <div className="rounded-lg bg-[#07060c] border hairline p-3">
                      {status.motd.clean.map((line, i) => (
                        <div key={i} className="mono text-[11px] text-[var(--c-text-dim)] leading-5">{line}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] text-[var(--c-text-faint)] text-center mt-3 font-ui">
                وضعیت زنده — مستقیم از سرور، بدون کش طولانی
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════ Stats strip ══════════ */}
      <section className="max-w-6xl mx-auto px-4 -mt-16 relative z-10">
        <Reveal>
          <div className="glass-strong grid grid-cols-2 md:grid-cols-4 overflow-hidden">
            <Stat label="بازیکن رتبه‌دار" value={<CountUp value={rankedPlayers} />} />
            <Stat label="تیر تعریف‌شده" value={<CountUp value={totalTiers} />} />
            <Stat label="حالت بازی فعال" value={<CountUp value={modeCategories.length || 4} />} />
            <Stat label="محصول استور" value={<CountUp value={productCount} />} />
          </div>
        </Reveal>
      </section>

      {/* ══════════ Players ticker ══════════ */}
      {tickerPlayers.length > 0 && (
        <section className="mt-12 border-y hairline py-3 bg-[rgba(16,13,28,0.5)]">
          <div className="marquee" dir="ltr">
            <div className="marquee-track">
              {[...tickerPlayers, ...tickerPlayers].map((u, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-sm font-ui text-[var(--c-text-dim)]">
                  <span className="w-1.5 h-1.5 rounded-sm bg-[var(--c-pink)] inline-block" aria-hidden />
                  <span className="mono">{u}</span>
                  <span className="text-[var(--c-text-faint)] text-xs">در لیگ شمشیر</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ Steps ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <Reveal>
          <SectionHead title="چطور شروع کنم؟" kicker="سه قدم تا اولین دئل" />
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="card hover-lift p-7 relative overflow-hidden group h-full">
                <div className="text-6xl font-display font-black text-[rgba(139,92,246,0.13)] absolute -top-3 end-3 select-none group-hover:text-[rgba(236,72,153,0.22)] transition-colors duration-300">{s.n}</div>
                <h3 className="font-heading font-bold text-lg mb-2.5">{s.title}</h3>
                <p className="text-sm text-[var(--c-text-dim)] leading-7 mb-5">{s.desc}</p>
                <code className="chip-code">{s.code}</code>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════ Game modes ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <Reveal>
          <SectionHead
            title="حالت‌های بازی"
            kicker="هر حالت، یک لیگ مستقل با تیرهای خودش"
            link={{ href: "/tiers", label: "همه‌ی تیرها" }}
          />
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {GAME_MODES.map((m, i) => {
            const cat = modeCategories.find((c) => c.key === m.key);
            return (
              <Reveal key={m.key} delay={i * 90}>
                <Link href={`/tiers?category=${m.key}`} className="mode-card group h-full">
                  <div className="mode-icon">{m.icon}</div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-heading font-bold text-lg group-hover:text-[var(--c-pink)] transition-colors">{m.name}</span>
                    <span className="badge badge-purple !text-[10px]">{m.tag}</span>
                  </div>
                  <p className="text-sm text-[var(--c-text-dim)] leading-6 mb-4">{m.desc}</p>
                  <div className="mt-auto flex items-center gap-2 text-xs text-[var(--c-text-faint)]">
                    <span className="badge badge-purple">{formatNumber(cat?._count.playerTiers ?? 0)} بازیکن</span>
                    <span className="badge">{formatNumber(cat?._count.tiers ?? 0)} تیر</span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ══════════ Podium ══════════ */}
      {podium.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-14">
          <Reveal>
            <SectionHead
              title="صدرنشین‌های لیگ شمشیر"
              kicker="بازیکنانی که بالاترین تیر را در اختیار دارند"
              link={{ href: "/tiers?category=sword", label: "جدول کامل" }}
            />
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {podium.map((pt, i) => (
              <Reveal key={pt.id} delay={i * 120}>
                <Link href={`/players/${pt.account.username}`} className={`podium-card hover-lift block h-full ${i === 0 ? "podium-first" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`medal ${i === 0 ? "medal-gold" : i === 1 ? "medal-silver" : "medal-bronze"}`}>{i + 1}</div>
                      <TierBadge name={pt.tier.name} />
                    </div>
                  </div>
                  <div className="font-heading font-black text-2xl mb-1.5">{pt.account.username}</div>
                  <div className="text-xs text-[var(--c-text-faint)] font-ui">{pt.category.name} — آخرین تغییر {formatDate(pt.updatedAt)}</div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ══════════ News ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <Reveal>
          <SectionHead title="اخبار و بروزرسانی‌ها" kicker="جدیدترین اتفاق‌های شبکه" link={{ href: "/news", label: "آرشیو اخبار" }} />
        </Reveal>
        {latestNews.length === 0 ? (
          <div className="card p-10 text-center text-[var(--c-text-dim)]">هنوز خبری منتشر نشده است.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {latestNews.map((a, i) => (
              <Reveal key={a.id} delay={i * 100}>
                <Link href={`/news/${a.slug}`} className="card hover-lift block h-full p-6">
                  <div className="flex items-center gap-2 mb-3 text-xs text-[var(--c-text-faint)]">
                    {a.category && <span className="badge badge-purple">{a.category.name}</span>}
                    <span>{formatDate(a.publishedAt ?? a.createdAt)}</span>
                  </div>
                  <h3 className="font-heading font-bold mb-2 leading-7">{a.title}</h3>
                  {a.excerpt && <p className="text-sm text-[var(--c-text-dim)] leading-6 line-clamp-3">{a.excerpt}</p>}
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* ══════════ Store CTA ══════════ */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <Reveal>
          <div className="border-glow">
            <div className="relative p-8 md:p-12 overflow-hidden">
              <div aria-hidden className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: "linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
              <div className="relative flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                  <h2 className="font-display text-2xl md:text-4xl font-black mb-4">
                    رنک بگیر، <span className="gradient-text-live">مزایا بگیر</span>
                  </h2>
                  <p className="text-[var(--c-text-dim)] leading-8">
                    رنک‌های Elite و VIP با پرداخت آنلاین چندثانیه‌ای روی سرور اعمال می‌شوند — پرداخت با تمام کارت‌های بانکی، تحویل خودکار و فوری.
                  </p>
                </div>
                <div className="flex md:flex-col gap-3 shrink-0">
                  <Link href="/store" className="btn btn-primary !px-9 !py-4 text-base">مشاهده استور</Link>
                  <Link href="/dashboard" className="btn btn-ghost !px-9 !py-4">پنل کاربری</Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="max-w-3xl mx-auto px-4 py-14">
        <Reveal>
          <SectionHead title="سؤال‌های پرتکرار" kicker="هر چیزی که لازم است بدانی" />
        </Reveal>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <Reveal key={i} delay={i * 70}>
              <details className="faq-item">
                <summary>{f.q}</summary>
                <div className="faq-body">{f.a}</div>
              </details>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHead({ title, kicker, link }: { title: string; kicker?: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        {kicker && <div className="text-xs font-ui font-semibold text-[var(--c-pink)] tracking-wide mb-2">{kicker}</div>}
        <h2 className="font-heading text-2xl md:text-3xl font-bold">{title}</h2>
      </div>
      {link && <Link href={link.href} className="text-sm font-ui text-[var(--c-text-dim)] hover:text-[var(--c-pink)] transition-colors whitespace-nowrap">{link.label} ←</Link>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-6 text-center">
      <div className="font-display text-3xl md:text-4xl font-black text-gradient">{value}</div>
      <div className="text-xs font-ui text-[var(--c-text-faint)] mt-1.5">{label}</div>
    </div>
  );
}
