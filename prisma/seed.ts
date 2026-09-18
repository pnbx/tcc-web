import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSION_KEYS, ROLE_DEFAULT_PERMISSIONS, ROLES } from "../src/lib/permissions";

const adapter = new PrismaPg({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "",
});
const prisma = new PrismaClient({ adapter });

async function seedRbac() {
  for (const key of PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key },
      update: {},
    });
  }
  for (const roleName of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName, builtin: true },
      update: { builtin: true },
    });
    const perms = ROLE_DEFAULT_PERMISSIONS[roleName];
    for (const key of perms) {
      const perm = key === "*" ? null : await prisma.permission.findUnique({ where: { key } });
      if (!perm) continue; // wildcard "*" is handled in code, not as a row
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        create: { roleId: role.id, permissionId: perm.id },
        update: {},
      });
    }
  }
}

async function seedTiers() {
  const categories: { key: string; name: string; tiers: [string, string?][] }[] = [
    {
      key: "sword",
      name: "شمشیر (Sword)",
      tiers: [
        ["HT1", "elite"], ["LT1", "elite"], ["HT2", "high"], ["LT2", "high"],
        ["HT3", "mid"], ["LT3", "mid"], ["HT4", "low"], ["LT4", "low"], ["HT5", "low"], ["LT5", "low"],
      ],
    },
    {
      key: "axe",
      name: "تبر (Axe)",
      tiers: [
        ["HT1", "elite"], ["LT1", "elite"], ["HT2", "high"], ["LT2", "high"],
        ["HT3", "mid"], ["LT3", "mid"], ["HT4", "low"], ["LT4", "low"], ["HT5", "low"], ["LT5", "low"],
      ],
    },
    {
      key: "nethpot",
      name: "نت‌پات (NethPot)",
      tiers: [
        ["HT1", "elite"], ["LT1", "elite"], ["HT2", "high"], ["LT2", "high"],
        ["HT3", "mid"], ["LT3", "mid"], ["HT4", "low"], ["LT4", "low"], ["HT5", "low"], ["LT5", "low"],
      ],
    },
    {
      key: "uhc",
      name: "UHC",
      tiers: [
        ["HT1", "elite"], ["LT1", "elite"], ["HT2", "high"], ["LT2", "high"],
        ["HT3", "mid"], ["LT3", "mid"], ["HT4", "low"], ["LT4", "low"], ["HT5", "low"], ["LT5", "low"],
      ],
    },
  ];

  for (const [ci, cat] of categories.entries()) {
    const category = await prisma.tierCategory.upsert({
      where: { key: cat.key },
      create: { key: cat.key, name: cat.name, position: ci },
      update: { name: cat.name, position: ci },
    });
    for (const [ti, [tierName, style]] of cat.tiers.entries()) {
      await prisma.tier.upsert({
        where: { categoryId_name: { categoryId: category.id, name: tierName } },
        create: { categoryId: category.id, name: tierName, position: ti },
        update: { position: ti },
      });
      void style;
    }
  }
}

async function seedNews() {
  for (const [slug, name] of [
    ["updates", "به‌روزرسانی‌ها"],
    ["events", "رویدادها"],
    ["tournaments", "مسابقات"],
    ["announcements", "اطلاعیه‌ها"],
  ] as const) {
    await prisma.newsCategory.upsert({ where: { slug }, create: { slug, name }, update: {} });
  }
}

async function seedStore() {
  const cats: [string, string][] = [
    ["ranks", "رنک‌ها"],
    ["cosmetics", "کازمتیک"],
    ["prefixes", "پریفیکس"],
    ["chat-colors", "رنگ چت"],
    ["tags", "تگ"],
  ];
  for (const [slug, name] of cats) {
    await prisma.productCategory.upsert({ where: { slug }, create: { slug, name }, update: {} });
  }

  const products: {
    slug: string; name: string; cat: string; desc: string; price: number; kind: string; duration?: string; commands: string[];
  }[] = [
    {
      slug: "rank-warrior", name: "رنک Warrior", cat: "ranks",
      desc: "رنک پایه با رنگ نام اختصاصی، دستور /hat و اسلات سرور در شلوغی.",
      price: 350000, kind: "RANK", duration: "permanent",
      commands: ["lp user {uuid} parent add warrior"],
    },
    {
      slug: "rank-elite", name: "رنک Elite", cat: "ranks",
      desc: "دسترسی به سرور VIP، کیت اختصاصی، /fly در لابی و ۲ برابرXP.",
      price: 850000, kind: "RANK", duration: "permanent",
      commands: ["lp user {uuid} parent add elite"],
    },
    {
      slug: "rank-legend-30", name: "رنک Legend (۳۰ روزه)", cat: "ranks",
      desc: "بالاترین رنک موقت: اولویت ورود، کیت لجند و افکت پیام ورود.",
      price: 620000, kind: "RANK", duration: "30d",
      commands: ["lp user {uuid} parent addtemp legend 30d"],
    },
    {
      slug: "cosmetic-wings", name: "بال‌های بنفش", cat: "cosmetics",
      desc: "افکت بال بنفش متحرک پشت کاراکتر در لابی.",
      price: 180000, kind: "COSMETIC", duration: "permanent",
      commands: ["tcc cosmetics grant {uuid} wings_purple"],
    },
    {
      slug: "prefix-tcc", name: "پریفیکس [TCC]", cat: "prefixes",
      desc: "پریفیکس رسمی طرفداران TCC در چت.",
      price: 95000, kind: "PREFIX", duration: "permanent",
      commands: ["lp user {uuid} meta addprefix 50 \"&d[TCC]&r\""],
    },
    {
      slug: "chatcolor-pink", name: "رنگ چت صورتی", cat: "chat-colors",
      desc: "رنگ صورتی برای متن چت شما.",
      price: 75000, kind: "CHATCOLOR", duration: "permanent",
      commands: ["lp user {uuid} meta addchatcolor pink"],
    },
    {
      slug: "tag-ace", name: "تگ «تکاور»", cat: "tags",
      desc: "تگ نمایشی کنار نام شما.",
      price: 120000, kind: "TAG", duration: "permanent",
      commands: ["tcc tags grant {uuid} ace"],
    },
  ];

  for (const [i, p] of products.entries()) {
    const cat = await prisma.productCategory.findUnique({ where: { slug: p.cat } });
    if (!cat) continue;
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.desc,
        priceCents: p.price,
        currency: "IRT",
        categoryId: cat.id,
        kind: p.kind,
        duration: p.duration ?? null,
        commands: JSON.stringify(p.commands),
        position: i,
      },
      update: {
        name: p.name,
        description: p.desc,
        priceCents: p.price,
        kind: p.kind,
        duration: p.duration ?? null,
        commands: JSON.stringify(p.commands),
        position: i,
      },
    });
  }
}

async function main() {
  await seedRbac();
  await seedTiers();
  await seedNews();
  await seedStore();
  console.log("Seed complete. Builtin roles/permissions/tiers/categories/products ready.");
  console.log("NOTE: no users are created here — run the app and finish /setup to create the owner + developer.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
