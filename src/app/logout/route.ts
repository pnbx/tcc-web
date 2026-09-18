import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  const res = NextResponse.redirect(new URL("/", req.url));
  await clearSessionCookie(res);
  if (auth) {
    await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "auth.logout" });
  }
  return res;
}
