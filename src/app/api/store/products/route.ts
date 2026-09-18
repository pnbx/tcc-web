import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { handleApiError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";

// GET /api/store/products — public catalog
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cat = url.searchParams.get("category") ?? undefined;
    const products = await prisma.product.findMany({
      where: { available: true, category: cat ? { slug: cat } : undefined },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { category: { select: { slug: true, name: true } } },
    });
    return jsonOk({ products });
  } catch (err) {
    return handleApiError(err);
  }
}

const productSchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(100),
  description: z.string().min(2).max(2000),
  priceCents: z.number().int().min(0),
  currency: z.string().max(6).default("IRT"),
  categorySlug: z.string().min(2),
  kind: z.enum(["RANK", "COSMETIC", "PREFIX", "CHATCOLOR", "TAG", "OTHER"]).default("RANK"),
  duration: z.string().max(20).nullable().optional(),
  available: z.boolean().default(true),
  imageUrl: z.string().max(500).nullable().optional(),
  commands: z.array(z.string().max(300)).max(20).default([]),
});

// POST /api/store/products — create (store.create)
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission("store.create");
    const body = await parseBody(req, productSchema);
    const cat = await prisma.productCategory.findUnique({ where: { slug: body.categorySlug } });
    if (!cat) return handleApiError(new Error("category not found"));

    const product = await prisma.product.upsert({
      where: { slug: body.slug },
      create: {
        slug: body.slug,
        name: body.name,
        description: body.description,
        priceCents: body.priceCents,
        currency: body.currency,
        categoryId: cat.id,
        kind: body.kind,
        duration: body.duration ?? null,
        available: body.available,
        imageUrl: body.imageUrl ?? null,
        commands: JSON.stringify(body.commands),
      },
      update: {
        name: body.name,
        description: body.description,
        priceCents: body.priceCents,
        currency: body.currency,
        categoryId: cat.id,
        kind: body.kind,
        duration: body.duration ?? null,
        available: body.available,
        imageUrl: body.imageUrl ?? null,
        commands: JSON.stringify(body.commands),
      },
    });

    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "store.upsert", target: body.slug });
    return jsonOk({ id: product.id });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/store/products?slug= — store.delete
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission("store.delete");
    const slug = new URL(req.url).searchParams.get("slug");
    if (!slug) return handleApiError(new Error("slug required"));
    await prisma.product.update({ where: { slug }, data: { available: false } });
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "store.disable", target: slug });
    return jsonOk({ disabled: true });
  } catch (err) {
    return handleApiError(err);
  }
}
