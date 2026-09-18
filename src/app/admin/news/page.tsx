import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuth, hasPermission } from "@/lib/auth";
import { formatDateTime } from "@/components/format";
import { NewsEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const [articles, categories] = await Promise.all([
    prisma.newsArticle.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { username: true } }, category: { select: { name: true } } },
    }),
    prisma.newsCategory.findMany(),
  ]);

  const can = (p: string) => hasPermission(auth.permissions, p);

  return (
    <div className="fade-up space-y-8">
      <div>
        <h1 className="font-display text-2xl font-black mb-6">مدیریت اخبار</h1>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>عنوان</th>
                <th>دسته</th>
                <th>نویسنده</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td className="font-ui font-semibold">
                    <Link href={`/news/${a.slug}`} className="hover:text-[var(--c-pink)]">{a.title}</Link>
                  </td>
                  <td>{a.category?.name ?? "—"}</td>
                  <td className="mono text-xs">{a.author.username}</td>
                  <td>
                    <span className={`badge ${a.published ? "badge-green" : "badge-amber"}`}>
                      {a.published ? "منتشرشده" : "پیش‌نویس"}
                    </span>
                  </td>
                  <td className="text-xs">{formatDateTime(a.publishedAt ?? a.createdAt)}</td>
                  <td className="text-xs text-[var(--c-text-faint)] num">{a.viewCount} بازدید</td>
                </tr>
              ))}
              {articles.length === 0 && (
                <tr><td colSpan={6} className="text-center">مطلبی وجود ندارد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {can("news.create") && <NewsEditor categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} canPublish={can("news.publish")} />}
    </div>
  );
}
