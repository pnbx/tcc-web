import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonOk, parseBody } from "@/lib/api";

const schema = z.object({
  displayName: z.string().max(60).optional(),
  bio: z.string().max(500).optional(),
  privacy: z
    .object({
      profile: z.enum(["public", "members", "private"]).optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await parseBody(req, schema);

    const current = (JSON.parse(auth.user.privacy || "{}") as { profile?: string }) ?? {};
    const nextPrivacy = { ...current, ...(body.privacy ?? {}) };

    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        displayName: body.displayName,
        bio: body.bio,
        privacy: JSON.stringify(nextPrivacy),
      },
    });
    return jsonOk({ username: user.username });
  } catch (err) {
    return handleApiError(err);
  }
}
