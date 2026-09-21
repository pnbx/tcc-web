import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Logging out changes state, so it must never be reachable by a GET: Next.js
// prefetches <Link> targets, and a GET logout silently destroyed the session of
// anyone who merely opened a panel page that links to this route.
export async function POST(req: NextRequest) {
  const auth = await getAuth(req);
  const res = NextResponse.redirect(new URL("/", req.url));
  await clearSessionCookie(res);
  if (auth) {
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "auth.logout" });
  }
  return res;
}

/** A plain GET just sends the visitor home — it never touches the session. */
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/", req.url));
}
