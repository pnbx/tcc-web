import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuth, hasPermission, requirePermission } from "@/lib/auth";
import { handleApiError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { audit } from "@/lib/audit";

// GET /api/news?category=&page=&limit=&includeUnpublished=(perm)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") ?? undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 10)));

    const auth = await getAuth(req);
    const canSeeDrafts = !!auth && hasPermission(auth.permissions, "news.view");

    const where = {
      published: canSeeDrafts ? undefined : true,
      category: category ? { slug: category } : undefined,
    };

    const [items, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where,
        orderBy: [{ published: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, slug: true, title: true, excerpt: true, coverImage: true,
          published: true, publishedAt: true, createdAt: true, viewCount: true,
          author: { select: { username: true, displayName: true } },
          category: { select: { slug: true, name: true } },
        },
      }),
      prisma.newsArticle.count({ where }),
    ]);

    return jsonOk({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/).optional(),
  excerpt: z.string().max(400).optional(),
  content: z.string().min(10),
  coverImage: z.string().max(500).optional(),
  categorySlug: z.string().max(60).optional(),
  publishNow: z.boolean().default(false),
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission("news.create");
    const body = await parseBody(req, createSchema);

    let categoryId: string | undefined;
    if (body.categorySlug) {
      const cat = await prisma.newsCategory.findUnique({ where: { slug: body.categorySlug } });
      categoryId = cat?.id;
    }

    const slug =
      body.slug ??
      (body.title
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || `news-${Date.now()}`);

    const article = await prisma.newsArticle.create({
      data: {
        slug,
        title: body.title,
        excerpt: body.excerpt,
        content: body.content,
        coverImage: body.coverImage,
        categoryId,
        authorId: auth.user.id,
        published: body.publishNow,
        publishedAt: body.publishNow ? new Date() : null,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      },
    });

    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "news.create", target: slug, ip: req.headers.get("x-forwarded-for") });
    return jsonOk({ id: article.id, slug: article.slug });
  } catch (err) {
    return handleApiError(err);
  }
}
