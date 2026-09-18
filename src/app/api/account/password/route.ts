import { NextRequest } from "next/server";
import { z } from "zod";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});

export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "pw-change", 5, 60_000);
    const auth = await requireAuth();
    const { currentPassword, newPassword } = await parseBody(req, schema);

    if (!auth.user.passwordHash || !(await argon2Verify(auth.user.passwordHash, currentPassword))) {
      return jsonError("گذرواژه فعلی اشتباه است.", 403);
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { passwordHash: await argon2Hash(newPassword) },
    });
    // Revoke all other sessions after a credential change.
    await prisma.session.updateMany({
      where: { userId: auth.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "account.password_change" });

    return jsonOk({ changed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
