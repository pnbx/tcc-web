import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCachedStatus, MC_ADDRESS } from "@/lib/mc";
import { readMetricSnapshot } from "@/lib/mc/agent";
import { formatNumber, priceLabel, timeAgo } from "@/components/format";
import { TgCopyIp } from "./copy";

export const dynamic = "force-dynamic";

// Telegram Mini App: the site in a phone-sized frame, opened from the bot's menu
// button. Kept deliberately compact — one screen for status, then the actions a
// player actually came for.
export default async function TelegramMiniApp() {
  const [status, metrics, news, ranks] = await Promise.all([
    getCachedStatus(),
    readMetricSnapshot().catch(() => null),
    prisma.newsArticle.findMany({ where: { published: true }, orderBy: { publishedAt: "desc" }, take: 3, select: { title: true, slug: true, publishedAt: true } }),
    prisma.product.findMany({ where: { available: true, category: { slug: "ranks" } }, orderBy: { position: "asc" }, take: 4, select: { slug: true, name: true, priceCents: true, currency: true } }),
  ]);

  const online = status.online;
  const state = status.state ?? (online ? "online" : "offline");

  const actions = [
    { href: "/store", label: "استور", hint: "رنک و پریفیکس", icon: "🛒" },
    { href: "/tiers", label: "جدول تیرها", hint: "رتبه‌ی همه", icon: "🏆" },
    { href: "/players", label: "بازیکنان", hint: "پروفایل‌ها", icon: "👤" },
    { href: "/news", label: "اخبار", hint: "بروزرسانی‌ها", icon: "📰" },
  ];

  return (
    <div className="min-h-screen pb-8">
      {/* hero */}
      <div className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 hero-bg" />
        <div className="relative px-4 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--c-purple)] to-[var(--c-pink-strong)] text-white text-sm font-black">T</span>
            <div>
              <div className="font-heading font-black leading-5">شبکه TCC</div>
              <div className="text-[11px] text-[var(--c-text-faint)] mono">1.21.8 · Velocity</div>
            </div>
            <span className={`badge ms-auto ${state === "online" ? "badge-green" : state === "unknown" ? "badge-amber" : "badge-red"}`}>
              {state === "online" ? "آنلاین" : state === "unknown" ? "نامشخص" : "آفلاین"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <MiniStat value={status.playersOnline != null ? formatNumber(status.playersOnline) : "—"} label="بازیکن" />
            <MiniStat value={metrics?.tps != null ? formatNumber(Math.round(metrics.tps)) : "—"} label="TPS" />
            <MiniStat value={metrics?.mspt != null ? metrics.mspt.toFixed(0) : "—"} label="MSPT" />
          </div>

          <TgCopyIp address={MC_ADDRESS} />

          <a href={`minecraft://${MC_ADDRESS}`} className="btn btn-primary w-full mt-2 !py-3 text-sm">
            ورود مستقیم به سرور
          </a>
        </div>
      </div>

      {/* quick actions */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="card p-3.5 flex items-center gap-3">
            <span className="text-xl">{a.icon}</span>
            <span className="min-w-0">
              <span className="block font-heading font-bold text-sm">{a.label}</span>
              <span className="block text-[11px] text-[var(--c-text-faint)]">{a.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* ranks */}
      {ranks.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="font-heading font-bold text-sm">رنک‌ها</h2>
            <Link href="/store" className="text-[11px] text-[var(--c-pink)]">همه ←</Link>
          </div>
          <div className="card divide-y divide-[var(--c-border)]">
            {ranks.map((r) => (
              <Link key={r.slug} href="/store" className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-sm">{r.name}</span>
                <span className="num text-xs text-[var(--c-pink)] font-semibold">{priceLabel(r.priceCents, r.currency)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* news */}
      {news.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="font-heading font-bold text-sm">آخرین اخبار</h2>
            <Link href="/news" className="text-[11px] text-[var(--c-pink)]">آرشیو ←</Link>
          </div>
          <div className="space-y-2">
            {news.map((n) => (
              <Link key={n.slug} href={`/news/${n.slug}`} className="card block p-3.5">
                <div className="text-sm leading-6">{n.title}</div>
                <div className="text-[11px] text-[var(--c-text-faint)] mt-1">
                  {n.publishedAt ? timeAgo(n.publishedAt) : ""}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-6">
        <Link href="/" className="btn btn-ghost w-full !py-2.5 text-xs">نمایش نسخه‌ی کامل سایت</Link>
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="font-display text-lg font-black num">{value}</div>
      <div className="text-[10px] text-[var(--c-text-faint)] font-ui">{label}</div>
    </div>
  );
}
