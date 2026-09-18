import { NextRequest } from "next/server";
import { z } from "zod";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { createSession, getClientIp, isLoginRateLimited, recordLoginAttempt, setSessionCookie } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  username: z.string().min(2).max(100),
  password: z.string().min(1).max(200),
  totp: z.string().max(10).optional(),
});

export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "login", 20, 60_000);
    const ip = getClientIp(req);
    const { username, password, totp } = await parseBody(req, schema);
    const usernameLower = username.toLowerCase();

    if (await isLoginRateLimited(usernameLower, ip)) {
      return jsonError("تلاش‌های ناموفق بیش از حد مجاز. لطفاً ۱۰ دقیقه دیگر دوباره امتحان کنید.", 429);
    }

    const user = await prisma.user.findUnique({ where: { usernameLower } });
    const ok = user && !user.deleted && !user.banned && user.passwordHash
      ? await argon2Verify(user.passwordHash, password)
      : false;

    if (!ok || !user) {
      await recordLoginAttempt(usernameLower, ip, false, user?.id);
      return jsonError("نام کاربری یا گذرواژه اشتباه است.", 401);
    }

    if (user.twoFactorEnabled) {
      if (!totp) {
        return jsonError("کد دومرحله‌ای لازم است.", 401, { needTotp: true });
      }
      const { verifyTotp } = await import("@/lib/auth");
      if (!(await verifyTotp(user, totp))) {
        await recordLoginAttempt(usernameLower, ip, false, user.id);
        return jsonError("کد دومرحله‌ای نامعتبر است.", 401, { needTotp: true });
      }
    }

    await recordLoginAttempt(usernameLower, ip, true, user.id);
    const { token, expiresAt } = await createSession(user.id, ip, req.headers.get("user-agent") ?? undefined);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ actorId: user.id, actorName: user.username, action: "auth.login", ip });

    const res = jsonOk({ username: user.username, needTotp: false });
    setSessionCookie(res, token, expiresAt);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
