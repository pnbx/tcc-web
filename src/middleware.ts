import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Security headers on every response. Session auth itself is enforced in the
// backend routes/panels (middleware here is defense-in-depth for headers).
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https://minotar.net https://crafatar.com https://mc-heads.net https://*.tccmc.ir",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js dev needs inline/eval; tighten with nonces in prod hardening
      "connect-src 'self' ws: wss:",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts).*)"],
};
