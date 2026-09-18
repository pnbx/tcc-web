import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { hasPermission, permissionsFor, type PermissionKey } from "@/lib/permissions";
export { hasPermission };
import type { Session, User } from "@/generated/prisma/client";

export const SESSION_COOKIE = "tcc_session";

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_USER = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export type AuthContext = {
  user: User;
  permissions: Set<string>;
  session: Session;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function createSession(
  userId: string,
  ip?: string,
  userAgent?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      ip: ip ?? null,
      userAgent: userAgent?.slice(0, 300) ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions(), expires: expiresAt });
}

export async function clearSessionCookie(res: NextResponse) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), expires: new Date(0) });
}

export async function getAuth(req?: NextRequest): Promise<AuthContext | null> {
  const cookieStore = req ? req.cookies : await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.banned || session.user.deleted) return null;

  const roles = await prisma.userRole.findMany({
    where: { userId: session.userId },
    include: { role: true },
  });
  const roleNames = roles.map((r) => r.role.name);
  const permissions = permissionsFor(roleNames);

  // Touch lastSeenAt at most once per minute to avoid write storms.
  const now = Date.now();
  if (now - session.lastSeenAt.getTime() > 60_000) {
    prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return { user: session.user, permissions, session };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new AuthError("UNAUTHENTICATED", 401);
  return auth;
}

export async function requirePermission(key: PermissionKey | string): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!hasPermission(auth.permissions, key)) throw new AuthError("FORBIDDEN", 403);
  return auth;
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean, userId?: string) {
  await prisma.loginAttempt.create({
    data: { username: username.slice(0, 100), ip, success, userId: userId ?? null },
  });
}

export async function isLoginRateLimited(username: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const [byIp, byUser] = await Promise.all([
    prisma.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { username: username.slice(0, 100), success: false, createdAt: { gte: since } } }),
  ]);
  return byIp >= MAX_ATTEMPTS_PER_IP || byUser >= MAX_ATTEMPTS_PER_USER;
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

// ── TOTP 2FA (otplib v13 API) ──────────────────────────────────────

export async function verifyTotp(user: User, code: string): Promise<boolean> {
  if (!user.twoFactorSecret) return false;
  const { decryptSecret } = await import("@/lib/crypto");
  const secret = decryptSecret(user.twoFactorSecret);
  if (!secret) return false;
  const { verify } = await import("otplib");
  try {
    const result = await verify({ token: code, secret });
    return result.valid;
  } catch {
    return false;
  }
}

export async function setupTotp(user: User): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
  const [{ generateSecret, generateURI }, { default: QRCode }, { encryptSecret }] = await Promise.all([
    import("otplib"),
    import("qrcode"),
    import("@/lib/crypto"),
  ]);
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: "TCC Minecraft", label: user.username, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: encryptSecret(secret) },
  });
  return { otpauthUrl, qrDataUrl };
}

export async function confirmTotp(user: User, code: string): Promise<boolean> {
  const ok = await verifyTotp(user, code);
  if (ok) {
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  }
  return ok;
}

export async function disableTotp(user: User): Promise<void> {
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: null, twoFactorEnabled: false },
  });
}
