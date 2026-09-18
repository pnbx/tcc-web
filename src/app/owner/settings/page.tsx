import { getAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { OwnerSettingsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function OwnerSettingsPage() {
  await getAuth();
  const settings = await getSettings();
  return (
    <OwnerSettingsClient
      initial={{
        fonts: settings.fonts as unknown as Record<string, string>,
        storeEnabled: settings.storeEnabled,
        heroHeadline: settings.heroHeadline,
        heroSubline: settings.heroSubline,
        discordUrl: settings.discordUrl,
      }}
    />
  );
}
