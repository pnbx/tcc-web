// Prefix studio.
//
// The AI only *designs*: it turns a Persian request ("بنفش به صورتی، بولد، با
// اسم خودم") into a small structured spec. Code renders the actual Minecraft
// prefix, decides the price tier, and — critically — sanitises the result,
// because that string ends up inside a console command on the game server.

import { chat } from "./ai";

export type PrefixTier = "solid" | "gradient" | "animated";

export type PrefixDesign = {
  tier: PrefixTier;
  label: string;
  /** MiniMessage string handed to LuckPerms */
  miniMessage: string;
  /** tokens for the site preview (color / text / bold / italic) */
  preview: { text: string; color?: string; bold?: boolean; italic?: boolean }[];
  /** plain-text approximation for Telegram */
  plain: string;
};

const TIER_ORDER: PrefixTier[] = ["solid", "gradient", "animated"];

// LuckPerms/TAB will render whichever codes their setup supports; we only emit
// tags from this list so a design can never inject anything else.
const ALLOWED_TAGS = /^<\/?(bold|italic|underlined|strikethrough|obfuscated|gradient|rainbow|color)(:[^<>]*)?>$/;

const DESIGN_PROMPT = `تو یک طراح پریفیکس ماینکرفت هستی. درخواست کاربر را به یک JSON دقیق تبدیل کن — فقط JSON، بدون توضیح و بدون بلوک کد:
{"tier":"solid|gradient|animated","label":"<یک اسم کوتاه لاتین یا فارسی برای پریفیکس، حداکثر ۱۲ کاراکتر>","colors":["#rrggbb","#rrggbb"],"bold":true|false,"italic":true|false,"rainbow":true|false}

قواعد انتخاب tier:
- solid: یک رنگ ساده، بدون گرادیانت
- gradient: دو رنگ یا گرادیانت
- animated: رنگ متحرک/rainbow/چشمک‌زن یا بیش از دو رنگ

label باید فقط حرف/عدد/زیرخط/فاصله داشته باشد (بدون کاراکتر ویژه). اگر کاربر اسم خودش را خواست، همان را بگذار.`;

type Spec = { tier?: string; label?: string; colors?: string[]; bold?: boolean; italic?: boolean; rainbow?: boolean };

function parseSpec(raw: string): Spec | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Spec;
  } catch {
    return null;
  }
}

const hex = (c: string | undefined, fallback: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec((c ?? "").trim());
  return m ? `#${m[1].toLowerCase()}` : fallback;
};

/** Everything that is not a whitelisted tag or a safe character is dropped. */
export function sanitizeMiniMessage(input: string): string {
  const tags = input.match(/<[^<>]*>/g) ?? [];
  const safeTags = tags.filter((t) => ALLOWED_TAGS.test(t)).join("");
  const text = input
    .replace(/<[^<>]*>/g, "")
    .replace(/["'`;$\\\n\r\t]/g, "")
    .slice(0, 60);
  return (safeTags + text).slice(0, 160);
}

function render(spec: Spec): { miniMessage: string; preview: PrefixDesign["preview"]; plain: string } {
  const label = (spec.label ?? "TCC").replace(/[^\p{L}\p{N}_ ]/gu, "").trim().slice(0, 14) || "TCC";
  const c1 = hex(spec.colors?.[0], "#a855f7");
  const c2 = hex(spec.colors?.[1], "#ec4899");

  if (spec.rainbow) {
    return {
      miniMessage: sanitizeMiniMessage(`<rainbow><bold>${label}</bold></rainbow> <dark_gray>|`),
      preview: [{ text: label, color: "rainbow", bold: true }, { text: " |", color: "#6b7280" }],
      plain: `${label} | (رنگین‌کمانی)`,
    };
  }

  const tier = spec.tier === "solid" || spec.tier === "animated" ? spec.tier : "gradient";
  const bold = Boolean(spec.bold);
  const italic = Boolean(spec.italic);
  const inner = `${bold ? "<bold>" : ""}${italic ? "<italic>" : ""}${label}${italic ? "</italic>" : ""}${bold ? "</bold>" : ""}`;

  if (tier === "solid") {
    return {
      miniMessage: sanitizeMiniMessage(`<color:${c1}>${inner}</color> <dark_gray>|`),
      preview: [{ text: label, color: c1, bold, italic }, { text: " |", color: "#6b7280" }],
      plain: `${label} | (رنگ ${c1})`,
    };
  }

  const gradient = `<gradient:${c1}:${c2}>${inner}</gradient>`;
  return {
    miniMessage: sanitizeMiniMessage(`${gradient} <dark_gray>|`),
    preview: [{ text: label, color: `linear-gradient(90deg, ${c1}, ${c2})`, bold, italic }, { text: " |", color: "#6b7280" }],
    plain: `${label} | (گرادیانت ${c1} → ${c2})`,
  };
}

export const PREFIX_PRODUCTS: Record<PrefixTier, { slug: string; name: string; price: number }> = {
  solid: { slug: "prefix-custom-solid", name: "پریفیکس سفارشی — ساده", price: 95_000 },
  gradient: { slug: "prefix-custom-gradient", name: "پریفیکس سفارشی — گرادیانت", price: 175_000 },
  animated: { slug: "prefix-custom-animated", name: "پریفیکس سفارشی — متحرک", price: 265_000 },
};

export async function designPrefix(request: string): Promise<{ ok: true; design: PrefixDesign } | { ok: false; error: string }> {
  const result = await chat([
    { role: "system", content: DESIGN_PROMPT },
    { role: "user", content: request.slice(0, 400) },
  ]);
  if (!result.ok) return { ok: false, error: result.error };

  const spec = parseSpec(result.text);
  if (!spec) return { ok: false, error: "طراحی قابل خواندن نبود؛ دوباره تلاش کن." };

  const tier: PrefixTier = spec.rainbow
    ? "animated"
    : TIER_ORDER.includes(spec.tier as PrefixTier)
      ? (spec.tier as PrefixTier)
      : "gradient";
  const { miniMessage, preview, plain } = render({ ...spec, tier });
  const label = preview[0]?.text ?? "TCC";

  return { ok: true, design: { tier, label, miniMessage, preview, plain } };
}

/** The command that applies a design to a player (placeholders handled later). */
export function prefixCommand(design: { miniMessage: string }, priority = 60): string {
  return `lp user {uuid} meta setprefix ${priority} "${design.miniMessage.replace(/"/g, "")}"`;
}
