import { NextRequest } from "next/server";
import { z } from "zod";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { isSetupComplete, markSetupComplete } from "@/lib/settings";
import { audit } from "@/lib/audit";

const schema = z.object({
  setupKey: z.string().min(1),
  ownerUsername: z.string().min(3).max(32).regex(/^[A-Za-z0-9_]+$/),
  ownerPassword: z.string().min(10).max(200),
  developerUsername: z.string().min(3).max(32).regex(/^[A-Za-z0-9_]+$/).default("root"),
  developerPassword: z.string().min(12).max(200),
});

// POST /api/setup — first-run bootstrap. Requires SETUP_KEY from the server's
// environment so only someone with shell access can create the initial
// OWNER + DEVELOPER accounts. Both passwords are Argon2id-hashed; the
// developer credential is configurable and never returned by any API.
export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "setup", 5, 60_000);
    if (await isSetupComplete()) {
      return jsonError("راه‌اندازی اولیه انجام شده است.", 409);
    }

    const expectedKey = process.env.SETUP_KEY;
    if (!expectedKey) {
      return jsonError("SETUP_KEY در تنظیمات سرور تعریف نشده است. ابتدا آن را در .env قرار دهید.", 503);
    }
    const body = await parseBody(req, schema);
    if (body.setupKey !== expectedKey) {
      return jsonError("کلید راه‌اندازی اشتباه است.", 403);
    }

    const ownerRole = await prisma.role.findUnique({ where: { name: "OWNER" } });
    const devRole = await prisma.role.findUnique({ where: { name: "DEVELOPER" } });
    if (!ownerRole || !devRole) return jsonError("نقش‌های پایه یافت نشدند. دیتابیس را seed کنید.", 503);

    const ownerHash = await argon2Hash(body.ownerPassword);
    const devHash = await argon2Hash(body.developerPassword);

    const [owner] = await Promise.all([
      prisma.user.upsert({
        where: { usernameLower: body.ownerUsername.toLowerCase() },
        create: {
          username: body.ownerUsername,
          usernameLower: body.ownerUsername.toLowerCase(),
          passwordHash: ownerHash,
        },
        update: { passwordHash: ownerHash },
      }),
      prisma.user.upsert({
        where: { usernameLower: body.developerUsername.toLowerCase() },
        create: {
          username: body.developerUsername,
          usernameLower: body.developerUsername.toLowerCase(),
          passwordHash: devHash,
        },
        update: { passwordHash: devHash },
      }),
    ]);

    const developer = await prisma.user.findUnique({ where: { usernameLower: body.developerUsername.toLowerCase() } });
    if (!owner || !developer) return jsonError("خطا در ایجاد حساب‌ها.", 500);

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
      create: { userId: owner.id, roleId: ownerRole.id },
      update: {},
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: developer.id, roleId: devRole.id } },
      create: { userId: developer.id, roleId: devRole.id },
      update: {},
    });

    await markSetupComplete();
    await audit({ actorName: "system", action: "setup.complete", detail: { owner: owner.username, developer: developer.username } });

    return jsonOk({ done: true });
  } catch (err) {
    return handleApiError(err);
  }
}
