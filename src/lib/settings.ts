import { prisma } from "@/lib/db";

// Typed settings stored in the Setting table as JSON values.
// Font assignments live here so typography can be changed from the admin
// panel without touching components (see the Persian typography spec).

export type FontSlots = {
  display: string;
  heading: string;
  ui: string;
  body: string;
  mono: string;
};

export type AppSettings = {
  fonts: FontSlots;
  storeEnabled: boolean;
  registrationEnabled: boolean;
  maintenanceMessage: string | null;
  heroHeadline: string;
  heroSubline: string;
  serverDescription: string;
  discordUrl: string | null;
};

export const DEFAULT_SETTINGS: AppSettings = {
  fonts: {
    display: "Dana",
    heading: "Peyda",
    ui: "Peyda",
    body: "Vazirmatn",
    mono: "Vazirmatn",
  },
  storeEnabled: true,
  registrationEnabled: true,
  maintenanceMessage: null,
  heroHeadline: "شبکه حرفه‌ای ماینکرفت ایران",
  heroSubline: "مادهای اختصاصی، لیگ تیر رسمی، استور کامل و اتصال پایدار — همه در یک شبکه.",
  serverDescription:
    "TCC یک شبکه ماینکرفت ایرانی است با سیستم تیر اختصاصی، اقتصادی فعال و تیم توسعه‌ای که خودش پلاگین‌هایش را می‌نویسد.",
  discordUrl: null,
};

const SETTINGS_KEY = "app";

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(row.value) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed, fonts: { ...DEFAULT_SETTINGS.fonts, ...(parsed.fonts ?? {}) } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    fonts: { ...current.fonts, ...(patch.fonts ?? {}) },
  };
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

// ── First-run / bootstrap state ─────────────────────────────────────────────

export async function isSetupComplete(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: "setup_complete" } });
  return row?.value === "true";
}

export async function markSetupComplete() {
  await prisma.setting.upsert({
    where: { key: "setup_complete" },
    create: { key: "setup_complete", value: "true" },
    update: { value: "true" },
  });
}
