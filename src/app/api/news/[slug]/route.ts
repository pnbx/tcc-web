import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuth, hasPermission, requirePermission } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";

// GET /api/news/[slug]
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await getAuth(req);
    const article = await prisma.newsArticle.findUnique({
      where: { slug },
      include: {
        author: { select: { username: true, displayName: true } },
        category: { select: { slug: true, name: true } },
      },
    });
    if (!article) return jsonError("یافت نشد", 404);

    const canSeeDrafts = !!auth && hasPermission(auth.permissions, "news.view");
    if (!article.published && !canSeeDrafts) return jsonError("یافت نشد", 404);

    if (article.published) {
      await prisma.newsArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
    }

    return jsonOk({ article });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  excerpt: z.string().max(400).optional(),
  content: z.string().min(10).optional(),
  coverImage: z.string().max(500).nullable().optional(),
  categorySlug: z.string().max(60).nullable().optional(),
  published: z.boolean().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});

// PATCH /api/news/[slug] — edit (requires news.edit; publishing requires news.publish)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requirePermission("news.edit");
    const body = await parseBody(req, updateSchema);

    if (body.published !== undefined) {
      const canPublish = hasPermission(auth.permissions, "news.publish");
      if (!canPublish) return jsonError("اجازه انتشار ندارید.", 403);
    }

    let categoryId: string | undefined | null;
    if (body.categorySlug !== undefined) {
      if (body.categorySlug === null) categoryId = null;
      else categoryId = (await prisma.newsCategory.findUnique({ where: { slug: body.categorySlug } }))?.id ?? null;
    }

    const article = await prisma.newsArticle.update({
      where: { slug },
      data: {
        title: body.title,
        excerpt: body.excerpt,
        content: body.content,
        coverImage: body.coverImage,
        categoryId,
        published: body.published,
        publishedAt:
          body.published === true ? new Date() : body.published === false ? null : undefined,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : body.scheduledFor === null ? null : undefined,
      },
    });

    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "news.edit", target: slug });
    return jsonOk({ slug: article.slug, published: article.published });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/news/[slug]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requirePermission("news.delete");
    await prisma.newsArticle.delete({ where: { slug } });
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "news.delete", target: slug });
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
