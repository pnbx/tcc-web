import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, parseBody, guardRateLimit } from "@/lib/api";
import { designRankTag } from "@/lib/rank-studio";
import { rankByKey } from "@/lib/ranks";

const schema = z.object({
  request: z.string().min(2).max(400),
  rankKey: z.string().max(40).optional(),
  /** the design the member approved (sent back so the server can rebuild the command) */
  approve: z
    .object({
      tag: z.string().max(24),
      miniMessage: z.string().max(200),
      effect: z.string().max(20),
      colors: z.array(z.string().max(9)).max(3).optional(),
      note: z.string().max(300).optional(),
    })
    .optional(),
});

// POST /api/store/rank-studio — the rank/tag assistant.
// Moderation happens server-side (see lib/rank-studio): sexual / 18+ / slur /
// impersonation requests are refused with a clear message, before AND after the
// model runs. Nothing the model says is trusted.
export async function POST(req: NextRequest) {
  try {
    guardRateLimit(req, "rank-studio", 20, 60_000);
    await requireAuth();
    const body = await parseBody(req, schema);

    if (body.approve) {
      const rank = body.rankKey ? rankByKey(body.rankKey) : undefined;
      return jsonOk({
        ok: true,
        approved: true,
        design: {
          tag: body.approve.tag,
          miniMessage: body.approve.miniMessage,
          effect: body.approve.effect,
          colors: body.approve.colors ?? [],
          note: body.approve.note ?? "",
          preview: [{ text: body.approve.tag, bold: true }],
        },
        rankName: rank?.name ?? null,
      });
    }

    const result = await designRankTag(body.request, { rankKey: body.rankKey ?? null });
    if (!result.ok) {
      return jsonError(result.error, result.refused ? 422 : 503);
    }
    return jsonOk({ ok: true, design: result.design, rankName: body.rankKey ? rankByKey(body.rankKey)?.name ?? null : null });
  } catch (err) {
    return handleApiError(err);
  }
}
