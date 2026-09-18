import { NextRequest } from "next/server";
import { clearSessionCookie, getAuth } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function POST(_req: NextRequest) {
  try {
    const auth = await getAuth();
    const res = jsonOk({ loggedOut: true });
    await clearSessionCookie(res);
    if (auth) {
      await audit({ actorId: auth.user.id, actorName: auth.user.username, action: "auth.logout" });
    }
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
