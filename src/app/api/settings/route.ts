import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuth, requirePermission } from "@/lib/auth";
import { getSettings, updateSettings, type AppSettings, type FontSlots } from "@/lib/settings";
import { handleApiError, jsonOk, parseBody } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    await getAuth();
    return jsonOk(await getSettings());
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  fonts: z
    .object({
      display: z.string().max(40).optional(),
      heading: z.string().max(40).optional(),
      ui: z.string().max(40).optional(),
      body: z.string().max(40).optional(),
      mono: z.string().max(40).optional(),
    })
    .optional(),
  storeEnabled: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  maintenanceMessage: z.string().max(300).nullable().optional(),
  heroHeadline: z.string().max(200).optional(),
  heroSubline: z.string().max(400).optional(),
  serverDescription: z.string().max(600).optional(),
  discordUrl: z.string().url().max(300).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission("settings.manage");
    const body = await parseBody(req, schema);
    const patch: Partial<AppSettings> = {};
    if (body.fonts) patch.fonts = body.fonts as FontSlots;
    if (body.storeEnabled !== undefined) patch.storeEnabled = body.storeEnabled;
    if (body.registrationEnabled !== undefined) patch.registrationEnabled = body.registrationEnabled;
    if (body.maintenanceMessage !== undefined) patch.maintenanceMessage = body.maintenanceMessage;
    if (body.heroHeadline !== undefined) patch.heroHeadline = body.heroHeadline;
    if (body.heroSubline !== undefined) patch.heroSubline = body.heroSubline;
    if (body.serverDescription !== undefined) patch.serverDescription = body.serverDescription;
    if (body.discordUrl !== undefined) patch.discordUrl = body.discordUrl;
    const next = await updateSettings(patch);
    await audit({
      actorId: auth.user.id,
      actorName: auth.user.username,
      action: "settings.update",
      detail: body,
      ip: req.headers.get("x-forwarded-for"),
    });
    return jsonOk(next);
  } catch (err) {
    return handleApiError(err);
  }
}
