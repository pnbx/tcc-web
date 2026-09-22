// ── The in-game rank ladder ─────────────────────────────────────────────────
// ONE source of truth for: store products, the site's rank pages, the perks a
// member reads before paying, and the LuckPerms permissions that make a rank
// real on the server.
//
// Fulfilment does two things per rank:
//   1. `lp group <key> permission set <node> true` for every node below
//      (idempotent — this is what makes the rank *actually work*),
//   2. `lp user <uuid> parent addtemp <key> <days>d` for the purchased period.
// When a period ends the expiry job removes the parent again.
//
// Everything here is seeded into RankProfile and can be edited in the owner
// panel without touching code (/owner/ranks).

export type RankDef = {
  key: string; // LuckPerms group name
  name: string; // site + in-game display name
  order: number; // ladder position (0 = member, higher = better)
  color: string; // accent colour for the site
  icon: string; // small glyph for cards
  tagline: string;
  /** Base price for ONE month in Toman — durations multiply this. */
  priceCents: number;
  perks: string[]; // human readable, shown before the member confirms
  permissions: string[]; // LuckPerms nodes granted to the group
  commands: string[]; // extra console commands run on grant ({uuid}/{player})
};

/** 1 / 3 / 12 months. `priceFactor` is applied to the rank's monthly price. */
export const DURATIONS = [
  { months: 1, days: 30, label: "۱ ماهه", priceFactor: 1 },
  { months: 3, days: 90, label: "۳ ماهه", priceFactor: 2.5, badge: "٪۱۷ ارزان‌تر" },
  { months: 12, days: 365, label: "۱۲ ماهه", priceFactor: 8, badge: "پرفروش‌ترین ⭐" },
] as const;

export type DurationMonths = (typeof DURATIONS)[number]["months"];

export function durationDef(months: number) {
  return DURATIONS.find((d) => d.months === months) ?? DURATIONS[0];
}

export function durationPrice(baseMonthlyPrice: number, months: number): number {
  const d = durationDef(months);
  return Math.round((baseMonthlyPrice * d.priceFactor) / 1000) * 1000;
}

// Perks escalate down the ladder; every rank keeps everything below it
// (LuckPerms inheritance already chains ember → frost → … → eternal).
const P = {
  basic: ["دسترسی به چت رنگی", "پریفیکس اختصاصی", "تگ کنار اسم در بازی"],
  flight: ["پرواز در لابی (/fly)"],
  utility: ["/heal و /feed", "/enderchest از هرجا"],
  homes: ["۲ خانه شخصی", "/back بعد از مرگ"],
  kit1: ["کیت اختصاصی سطح ۱"],
  cosmetics: ["۲ اسلات کازمتیک اضافه"],
  kit2: ["کیت اختصاصی سطح ۲", "۳ خانه شخصی"],
  priority: ["ورود به سرور شلوغ (اولویت صف)"],
  cosmetics4: ["۵ اسلات کازمتیک اضافه"],
  nick: ["تغییر نام نمایشی (/nick)"],
  kit3: ["کیت اختصاصی سطح ۳", "۵ خانه شخصی"],
  vanish: ["/vanish نامرئی شدن"],
  pets: ["دسترسی به پت و افکت‌های ویژه"],
  cosmeticsAll: ["همه اسلات‌های کازمتیک"],
  kit4: ["کیت اختصاصی سطح ۴", "۸ خانه شخصی"],
  god: ["/god و /repair نامحدود"],
  custom: ["درخواست تگ اختصاصی با دستیار هوش مصنوعی"],
  legend: ["لقب LEGEND در چت و لیست بازیکنان", "خرید کد تخفیف اختصاصی"],
};

export const RANKS: RankDef[] = [
  {
    key: "member", name: "Member", order: 0, color: "#94a3b8", icon: "•", tagline: "رنک پیش‌فرض همه بازیکنان",
    priceCents: 0, perks: ["دسترسی پایه به سرور"], permissions: [], commands: [],
  },
  {
    key: "ember", name: "Ember", order: 1, color: "#f97316", icon: "🔥", tagline: "شروع مسیر — جرقه‌ی اول",
    priceCents: 55000, perks: [...P.basic, ...P.flight],
    permissions: ["tcc.rank.ember", "essentials.fly", "essentials.fly.safelogin", "essentials.heal", "essentials.feed"],
    commands: [],
  },
  {
    key: "frost", name: "Frost", order: 2, color: "#38bdf8", icon: "❄", tagline: "خنک و آرام، اما کشنده",
    priceCents: 85000, perks: [...P.basic, ...P.flight, ...P.utility],
    permissions: ["tcc.rank.frost", "essentials.enderchest", "essentials.workbench", "essentials.hat"],
    commands: [],
  },
  {
    key: "mystic", name: "Mystic", order: 3, color: "#a855f7", icon: "🔮", tagline: "قدرت‌های پنهان باز می‌شوند",
    priceCents: 120000, perks: [...P.basic, ...P.flight, ...P.utility, ...P.homes, ...P.kit1],
    permissions: ["tcc.rank.mystic", "essentials.sethome", "essentials.home", "essentials.back", "essentials.tpa", "tcc.kit.mystic"],
    commands: [],
  },
  {
    key: "lunar", name: "Lunar", order: 4, color: "#c084fc", icon: "🌙", tagline: "زیر نور ماه، بی‌رقیب",
    priceCents: 160000, perks: [...P.utility, ...P.homes, ...P.kit1, ...P.cosmetics],
    permissions: ["tcc.rank.lunar", "tcc.cosmetic.slots.2", "essentials.speed", "essentials.jump"],
    commands: [],
  },
  {
    key: "solar", name: "Solar", order: 5, color: "#fbbf24", icon: "☀", tagline: "درخشش خورشید روی اسمت",
    priceCents: 210000, perks: [...P.utility, ...P.homes, ...P.kit2, ...P.cosmetics],
    permissions: ["tcc.rank.solar", "tcc.kit.solar", "essentials.ptime", "essentials.pweather"],
    commands: [],
  },
  {
    key: "spencer", name: "Spencer", order: 6, color: "#2dd4bf", icon: "✦", tagline: "اسپانسر رسمی شبکه",
    priceCents: 270000, perks: [...P.kit2, ...P.priority, ...P.cosmetics4, ...P.nick],
    permissions: ["tcc.rank.spencer", "tcc.queue.priority", "essentials.nick", "essentials.anvil"],
    commands: [],
  },
  {
    key: "amethyst", name: "Amethyst", order: 7, color: "#d946ef", icon: "💎", tagline: "بنفشِ اصیل",
    priceCents: 330000, perks: [...P.kit2, ...P.priority, ...P.cosmetics4, ...P.nick, ...P.vanish],
    permissions: ["tcc.rank.amethyst", "essentials.vanish", "essentials.god"],
    commands: [],
  },
  {
    key: "nebula", name: "Nebula", order: 8, color: "#818cf8", icon: "🌌", tagline: "از دل سحابی‌ها",
    priceCents: 400000, perks: [...P.kit3, ...P.priority, ...P.cosmetics4, ...P.pets],
    permissions: ["tcc.rank.nebula", "tcc.kit.nebula", "tcc.cosmetic.pets"],
    commands: [],
  },
  {
    key: "eclipse", name: "Eclipse", order: 9, color: "#64748b", icon: "🌑", tagline: "خورشیدگرفتگی کامل",
    priceCents: 480000, perks: [...P.kit3, ...P.priority, ...P.cosmeticsAll, ...P.vanish, ...P.pets],
    permissions: ["tcc.rank.eclipse", "tcc.cosmetic.slots.all"],
    commands: [],
  },
  {
    key: "phoenix", name: "Phoenix", order: 10, color: "#fb7185", icon: "🦅", tagline: "از خاکستر برخیز",
    priceCents: 570000, perks: [...P.kit4, ...P.cosmeticsAll, ...P.god, ...P.custom],
    permissions: ["tcc.rank.phoenix", "tcc.kit.phoenix", "essentials.repair", "tcc.studio.custom"],
    commands: [],
  },
  {
    key: "celestial", name: "Celestial", order: 11, color: "#22d3ee", icon: "✧", tagline: "آسمانی و دور از دسترس",
    priceCents: 660000, perks: [...P.kit4, ...P.cosmeticsAll, ...P.god, ...P.custom, "۳۰٪ تخفیف روی همه‌ی محصولات استور"],
    permissions: ["tcc.rank.celestial", "tcc.store.discount.30", "essentials.repair.all"],
    commands: [],
  },
  {
    key: "eternal", name: "Eternal", order: 12, color: "#f43f5e", icon: "∞", tagline: "جاویدان — بالاترین رنک پولی",
    priceCents: 750000, perks: [...P.kit4, ...P.cosmeticsAll, ...P.god, ...P.custom, "۵۰٪ تخفیف روی همه‌ی محصولات استور", "تگ MYTHIC اختصاصی"],
    permissions: ["tcc.rank.eternal", "tcc.store.discount.50", "tcc.kit.eternal"],
    commands: [],
  },
  {
    key: "legend", name: "Legend", order: 13, color: "#fde047", icon: "♛", tagline: "افسانه‌ی شبکه — فقط با ریدیم کد یا اهدا",
    priceCents: 0, perks: [...P.legend, "همه‌ی مزایای Eternal"],
    permissions: ["tcc.rank.legend"],
    commands: [],
  },
];

export const SELLABLE_RANKS = RANKS.filter((r) => r.priceCents > 0);
export const STAFF_GROUPS = ["tester", "helper", "mod", "owner", "developer"];

export function rankByKey(key: string): RankDef | undefined {
  return RANKS.find((r) => r.key === key);
}

export function rankName(key: string): string {
  return rankByKey(key)?.name ?? key;
}

/** Ranks a member can hold at once: buying a higher one keeps the lower ones. */
export function rankOrderOf(key: string): number {
  return rankByKey(key)?.order ?? 0;
}
