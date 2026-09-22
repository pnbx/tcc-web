// ── Rank / tag studio ───────────────────────────────────────────────────────
// The member describes the rank tag they want ("من رنک Mythic می‌خواهم ولی تگم
// GOD باشه، طلایی و گرادیانت") and the assistant turns it into a real design.
//
// Moderation is enforced TWICE:
//   1. locally, before the model is even called (instant, deterministic),
//   2. again on whatever the model returns — the model is never trusted.
// Sexual / 18+ / slur / hate content and staff impersonation are refused with a
// clear "I can't help with that" answer.

import { chat } from "./ai";
import { sanitizeMiniMessage } from "./prefix-studio";
import { rankByKey } from "./ranks";

export type TagDesign = {
  tag: string; // the display text, e.g. "GOD"
  effect: "solid" | "gradient" | "rainbow";
  colors: string[];
  bold: boolean;
  /** MiniMessage for the server */
  miniMessage: string;
  /** tokens for the site preview */
  preview: { text: string; color?: string; bold?: boolean }[];
  /** the AI's Persian explanation of what it built */
  note: string;
};

export type ModerationVerdict = { ok: true; tag: string } | { ok: false; reason: string };

const RESERVED = [
  "owner", "admin", "administrator", "staff", "moderator", "mod", "helper", "developer", "dev",
  "console", "system", "server", "tccstaff", "tccthebot", "operator", "op", "root", "myself",
  "سنترال", "ادمین", "مدیر", "استف", "مالک", "اوونر",
];

const NSFW = [
  // English
  "sex", "sexy", "porn", "porno", "xxx", "nude", "naked", "nsfw", "boob", "tits", "dick", "cock",
  "pussy", "penis", "vagina", "cum", "sperm", "horny", "whore", "slut", "rape", "rapist", "incest",
  "onlyfans", "18plus", "18+",
  // Persian / Finglish slang
  "کص", "کیر", "کون", "جنده", "سکس", "سکسی", "لخت", "شهوت", "پورن", "گایید", "گای", "میگا",
  "kos", "kir", "kossher", "kiri", "jende", "siktir", "gaid", "gayid", "seks", "sexy", "lxt", "lokht",
  // slurs / hate
  "nigger", "niga", "faggot", "kike", "retard",
];

/** Fast, deterministic gate. Runs before AND after the model. */
export function moderateTag(input: string): ModerationVerdict {
  const tag = (input ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (tag.length < 3) return { ok: false, reason: "تگ باید حداقل ۳ کاراکتر باشد." };
  if (tag.length > 14) return { ok: false, reason: "تگ حداکثر ۱۴ کاراکتر می‌تواند باشد." };

  const bare = tag.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const lower = tag.toLowerCase();
  const squashed = lower.replace(/[^a-z0-9\u0600-\u06ff]/g, "");

  for (const bad of NSFW) {
    if (containsForbidden(lower, squashed, bad)) {
      return {
        ok: false,
        reason: "متأسفانه نمی‌توانم با این اسم کمک کنم — اسم‌های جنسی، توهین‌آمیز یا +۱۸ را قبول نمی‌کنیم. یک اسم دیگر بگو.",
      };
    }
  }
  for (const word of RESERVED) {
    if (bare === word || squashed === word || lower.includes(word)) {
      return {
        ok: false,
        reason: "این اسم برای رنک‌های مدیریتی رزرو شده و قابل استفاده نیست. یک اسم دیگر انتخاب کن.",
      };
    }
  }
  if (/(.)\1{4,}/.test(bare)) return { ok: false, reason: "حرف تکراری زیاد در تگ مجاز نیست." };
  if (!/^[\p{L}\p{N}_ .!+★✦♛∞]+$/u.test(tag)) {
    return { ok: false, reason: "فقط حرف، عدد، فاصله و چند نماد ساده (★ ✦ ♛ ∞) مجاز است." };
  }
  return { ok: true, tag };
}

/**
 * Normalisation used by every check: NFKC, zero-width removal, Arabic→Persian
 * folding (ي/ك), diacritic stripping and letter-squashing — so "سـکــس",
 * "سکس" and "SEXxx" are all caught the same way.
 */
export function normalizeForModeration(input: string): string {
  return (input ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, "") // zero-width / bidi controls
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ۰-۹
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ٠-٩
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآا]/g, "ا")
    .replace(/[\u064b-\u0652\u0640]/g, "") // diacritics + tatweel
    .replace(/0/g, "o")
    .replace(/1|3/g, "i")
    .replace(/5/g, "s")
    .replace(/7/g, "a")
    .replace(/(.)\1+/g, "$1"); // collapse repeats
}

function containsForbidden(haystackLower: string, haystackSquashed: string, needle: string): boolean {
  const n = normalizeForModeration(needle);
  if (!n) return false;
  const squashedNeedle = n.replace(/[^a-z0-9\u0600-\u06ff]/g, "");
  const plain = normalizeForModeration(haystackLower);
  const plainSquashed = normalizeForModeration(haystackSquashed).replace(/[^a-z0-9\u0600-\u06ff]/g, "");
  if (!squashedNeedle) return false;
  return plain.includes(n) || plainSquashed.includes(squashedNeedle) || haystackSquashed.includes(squashedNeedle);
}

const DESIGN_PROMPT = `تو دستیار «استودیوی رنک» سرور ماینکرفت TCC هستی. کاربر می‌گوید چه رنکی خریده و چه تگی (tag) کنار اسمش می‌خواهد.
فقط و فقط یک JSON برگردان، بدون توضیح اضافه و بدون بلوک کد:
{"ok":true,"tag":"GOD","effect":"solid|gradient|rainbow","colors":["#rrggbb","#rrggbb"],"bold":true,"note":"یک جمله فارسی: چه ساختی"}
اگر درخواست کاربر نام جنسی، +۱۸، توهین، نژادپرستانه، یا جعل هویت مدیران (admin/owner/staff/helper) بود، این را برگردان:
{"ok":false,"reason":"یک جمله فارسی مودبانه که توضیح دهد چرا نمی‌توانی کمک کنی و پیشنهاد یک اسم مناسب دیگر"}
قواعد:
- tag: ۳ تا ۱۴ کاراکتر، فقط حرف/عدد/زیرخط/فاصله و نمادهای ★ ✦ ♛ ∞. اسم رنکی که کاربر خریده را به‌عنوان تگ تکرار نکن.
- effect: تک‌رنگ = solid، دو رنگ = gradient، رنگین‌کمانی = rainbow
- colors: کدهای hex مثل #fbbf24 (برای rainbow یک رنگ بده).
- لحن note: خودی، کوتاه، فارسی.`;

type Spec = { ok?: boolean; reason?: string; tag?: string; effect?: string; colors?: string[]; bold?: boolean; note?: string };

function parseSpec(raw: string): Spec | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  // Models often wrap the JSON in prose: walk every balanced {…} block and take
  // the first one that actually parses.
  for (let start = cleaned.indexOf("{"); start !== -1; start = cleaned.indexOf("{", start + 1)) {
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth += 1;
      else if (cleaned[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1)) as Spec;
          } catch {
            break; // try the next opening brace
          }
        }
      }
    }
  }
  return null;
}

const hex = (c: string | undefined, fallback: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((c ?? "").trim());
  return m ? `#${m[1].toLowerCase()}` : fallback;
};

function render(tag: string, effect: TagDesign["effect"], colors: string[], bold: boolean) {
  const c1 = hex(colors[0], "#fbbf24");
  const c2 = hex(colors[1], "#f472b6");
  const inner = bold ? `<bold>${tag}</bold>` : tag;
  if (effect === "rainbow") {
    return {
      miniMessage: sanitizeMiniMessage(`<rainbow>${inner}</rainbow>`),
      preview: [{ text: tag, color: "rainbow", bold }],
    };
  }
  if (effect === "solid") {
    return {
      miniMessage: sanitizeMiniMessage(`<color:${c1}>${inner}</color>`),
      preview: [{ text: tag, color: c1, bold }],
    };
  }
  return {
    miniMessage: sanitizeMiniMessage(`<gradient:${c1}:${c2}>${inner}</gradient>`),
    preview: [{ text: tag, color: `linear-gradient(90deg, ${c1}, ${c2})`, bold }],
  };
}

export async function designRankTag(
  request: string,
  opts: { rankKey?: string | null } = {},
): Promise<{ ok: true; design: TagDesign } | { ok: false; refused: boolean; error: string }> {
  const rank = opts.rankKey ? rankByKey(opts.rankKey) : undefined;

  // 1) local gate on the raw request — catches obvious cases without the model.
  //    Normalised, so obfuscated spellings ("سـکس", "s3x") are caught too.
  const requestPlain = normalizeForModeration(request);
  const requestSquashed = requestPlain.replace(/[^a-z0-9\u0600-\u06ff]/g, "");
  for (const bad of NSFW) {
    if (containsForbidden(request, requestSquashed, bad)) {
      return {
        ok: false,
        refused: true,
        error:
          "متأسفانه نمی‌توانم با این اسم کمک کنم — اسم‌های جنسی، +۱۸ یا توهین‌آمیز را قبول نمی‌کنیم. یک اسم دیگر پیشنهاد بده تا برایت بسازم.",
      };
    }
  }
  // (reserved words are checked on the produced TAG below — a normal sentence
  //  may legitimately contain words like "مالک", so we do not refuse on those)

  const context = rank ? `رنک خریداری‌شده: ${rank.name} (${rank.key}). ` : "";
  const result = await chat(
    [
      { role: "system", content: DESIGN_PROMPT },
      { role: "user", content: `${context}درخواست: ${request.slice(0, 400)}` },
    ],
    { temperature: 0.5, maxTokens: 400 },
  );
  if (!result.ok) return { ok: false, refused: false, error: `دستیار در دسترس نیست: ${result.error}` };

  const spec = parseSpec(result.text);
  if (!spec) return { ok: false, refused: false, error: "جواب دستیار قابل خواندن نبود؛ دوباره بگو." };

  if (spec.ok === false) {
    return { ok: false, refused: true, error: spec.reason?.slice(0, 240) || "این درخواست را نمی‌توانم انجام دهم." };
  }

  // 2) re-moderate whatever the model produced
  const verdict = moderateTag(spec.tag ?? "");
  if (!verdict.ok) return { ok: false, refused: true, error: verdict.reason };

  const effect: TagDesign["effect"] =
    spec.effect === "rainbow" || spec.effect === "solid" || spec.effect === "gradient" ? spec.effect : "gradient";
  const { miniMessage, preview } = render(verdict.tag, effect, spec.colors ?? [], Boolean(spec.bold));

  return {
    ok: true,
    design: {
      tag: verdict.tag,
      effect,
      colors: (spec.colors ?? []).slice(0, 2).map((c) => hex(c, "#fbbf24")),
      bold: Boolean(spec.bold),
      miniMessage,
      preview,
      note: (spec.note ?? "").slice(0, 200) || "تگ سفارشی‌ات آماده است.",
    },
  };
}

/**
 * The LuckPerms command that applies a custom tag.
 * The tag is a SUFFIX so the rank prefix stays visible: "[MYTHIC] Name ✦GOD✦".
 * Priority grows with the rank so a higher rank never gets hidden.
 */
export function tagCommand(design: { miniMessage: string }, rankOrder = 1): string {
  const priority = 100 + Math.max(1, rankOrder) * 5;
  return `lp user {uuid} meta setsuffix ${priority} "${design.miniMessage.replace(/"/g, "")}"`;
}

export function tagPreviewText(design: TagDesign): string {
  return `${design.tag}${design.effect === "rainbow" ? " (رنگین‌کمانی)" : ""}`;
}
