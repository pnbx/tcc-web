import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuth, hasPermission } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { formatDateTime } from "@/components/format";

export const dynamic = "force-dynamic";

// Extremely small, safe rich-text renderer: paragraphs, line breaks.
// (Markdown parsing is intentionally minimal to avoid XSS surface; admin
// content is trusted, but we still render text-only nodes.)
function renderContent(content: string) {
  return content.split(/\n{2,}/).map((para, i) => (
    <p key={i} className="mb-4 leading-8 text-[var(--c-text-dim)] whitespace-pre-line">
      {para}
    </p>
  ));
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await getAuth();
  const canSeeDrafts = !!auth && hasPermission(auth.permissions, "news.view");

  const article = await prisma.newsArticle.findUnique({
    where: { slug },
    include: {
      author: { select: { username: true, displayName: true } },
      category: { select: { name: true, slug: true } },
    },
  });
  if (!article || (!article.published && !canSeeDrafts)) notFound();

  await prisma.newsArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);

  return (
    <div className="min-h-screen">
      <SiteHeader authed={!!auth} />
      <main className="max-w-3xl mx-auto px-4 py-12 fade-up">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--c-text-faint)] mb-6">
          {article.category && <Link href={`/news?category=${article.category.slug}`} className="badge badge-purple">{article.category.name}</Link>}
          <span>{formatDateTime(article.publishedAt ?? article.createdAt)}</span>
          <span>نویسنده: {article.author.displayName ?? article.author.username}</span>
          {!article.published && <span className="badge badge-amber">پیش‌نویس — تنها برای مدیران</span>}
          <span className="num">{article.viewCount} بازدید</span>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-black leading-relaxed mb-8">{article.title}</h1>

        <article className="text-base">{renderContent(article.content)}</article>

        <div className="mt-12 pt-6 border-t hairline">
          <Link href="/news" className="text-sm text-[var(--c-pink)] hover:underline">← بازگشت به اخبار</Link>
        </div>
      </main>
    </div>
  );
}
