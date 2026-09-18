import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { ProfileSettingsClient } from "./client";
import type { ProfileForm } from "./client";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const auth = await getAuth();
  if (!auth) return null;

  const linked = await prisma.minecraftAccount.findFirst({
    where: { userId: auth.user.id, linkedAt: { not: null } },
    select: { username: true },
  });

  let privacy: ProfileForm["privacyProfile"] = "public";
  try {
    const parsed = JSON.parse(auth.user.privacy) as { profile?: ProfileForm["privacyProfile"] };
    if (parsed.profile) privacy = parsed.profile;
  } catch {
    // default
  }

  const initial: ProfileForm & { linked: { username: string } | null } = {
    displayName: auth.user.displayName ?? "",
    bio: auth.user.bio ?? "",
    privacyProfile: privacy,
    linked,
  };

  return <ProfileSettingsClient initial={initial} />;
}
