import { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth(req);
    if (!auth) return jsonOk({ authenticated: false });
    return jsonOk({
      authenticated: true,
      user: {
        id: auth.user.id,
        username: auth.user.username,
        displayName: auth.user.displayName,
        avatarUrl: auth.user.avatarUrl,
        twoFactorEnabled: auth.user.twoFactorEnabled,
      },
      permissions: [...auth.permissions],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
