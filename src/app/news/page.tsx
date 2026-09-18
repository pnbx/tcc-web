import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth, hasPermission } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { formatDate } from "@/components/format";

export const dynamic = "force-dynamic";

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const { category, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam || 1));
  const limit = 9;

  const auth = await getAuth();
  const canSeeDrafts = !!auth && hasPermission(auth.permissions, "news.view");

  const [categories, articles, total] = await Promise.all([
    prisma.newsCategory.findMany({ include: { _count: { select: { articles: { where: { published: true } } } } } }),
    prisma.newsArticle.findMany({
      where: {
        published: canSeeDrafts ? undefined : true,
        ...(category ? { category: { slug: category } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: { author: { select: { username: true, displayName: true } }, category: { select: { name: true, slug: true } } },
    }),
    prisma.newsArticle.count({
      where: { published: canSeeDrafts ? undefined : true, ...(category ? { category: { slug: category } } : {}) },
    }),
  ]);

  const pages = Math.ceil(total / limit);
  const featured = page === 1 && !category ? articles[0] : null;
  const rest = featured ? articles.slice(1) : articles;

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />
      <main className="max-w-6xl mx-auto px-4 py-10 fade-up">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-8">
          <h1 className="font-display text-3xl font-black">اخبار و اطلاعیه‌ها</h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/news" className={`badge ${!category ? "badge-pink" : ""}`}>همه</Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/news?category=${c.slug}`} className={`badge ${category === c.slug ? "badge-pink" : ""}`}>
                {c.name} <span className="num opacity-60">{c._count.articles}</span>
              </Link>
            ))}
          </div>
        </div>

        {articles.length === 0 ? (
          <div className="card p-10 text-center text-[var(--c-text-dim)]">مطلبی یافت نشد.</div>
        ) : (
          <>
            {featured && (
              <Link href={`/news/${featured.slug}`} className="card-raised block p-8 mb-8 hover:border-[var(--c-pink)] transition-colors">
                <div className="flex items-center gap-3 mb-4 text-xs text-[var(--c-text-faint)]">
                  <span className="badge badge-pink">آخرین خبر</span>
                  {featured.category && <span className="badge">{featured.category.name}</span>}
                  <span>{formatDate(featured.publishedAt ?? featured.createdAt)}</span>
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-extrabold mb-3 leading-relaxed">{featured.title}</h2>
                {featured.excerpt && <p className="text-[var(--c-text-dim)] leading-7 max-w-3xl">{featured.excerpt}</p>}
              </Link>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((a) => (
                <Link key={a.id} href={`/news/${a.slug}`} className="card p-5 hover:border-[var(--c-border-strong)] transition-colors flex flex-col">
                  <div className="flex items-center gap-2 mb-3 text-xs text-[var(--c-text-faint)]">
                    {a.category && <span className="badge">{a.category.name}</span>}
                    {!a.published && <span className="badge badge-amber">پیش‌نویس</span>}
                    <span>{formatDate(a.publishedAt ?? a.createdAt)}</span>
                  </div>
                  <h3 className="font-heading font-bold mb-2 leading-7">{a.title}</h3>
                  {a.excerpt && <p className="text-sm text-[var(--c-text-dim)] leading-6 line-clamp-3">{a.excerpt}</p>}
                  <div className="mt-auto pt-4 text-xs text-[var(--c-text-faint)]">
                    {a.author.displayName ?? a.author.username}
                  </div>
                </Link>
              ))}
            </div>
            {pages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: pages }, (_, i) => (
                  <Link
                    key={i}
                    href={`/news?page=${i + 1}${category ? `&category=${category}` : ""}`}
                    className={`btn btn-ghost !px-3 !py-1.5 text-sm ${page === i + 1 ? "!border-[var(--c-pink)] text-[var(--c-pink)]" : ""}`}
                  >
                    <span className="num">{i + 1}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
