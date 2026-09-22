// ── Telegram bridge ─────────────────────────────────────────────────────────
// Members must link their site account to Telegram: that is where rank-expiry
// notices (and purchase receipts) are delivered. The bot itself lives in the
// sibling project, so the site both SENDS messages (bot token) and RECEIVES the
// link confirmation (bot → POST /api/bot/link with BOT_API_TOKEN).
//
// Fail-open by design: if the bot token is not configured, the "must link"
// gate is skipped instead of locking every member out of the site.

import { prisma } from "@/lib/db";
import { randomBytes } from "node:crypto";

const API = "https://api.telegram.org";
const LINK_TTL_MINUTES = 30;

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function telegramConfigured(): boolean {
  return Boolean(botToken());
}

export function botUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME || "tccthebot").replace(/^@/, "");
}

export function deepLink(payload: string): string {
  return `https://t.me/${botUsername()}?start=${encodeURIComponent(payload)}`;
}

/** Plain text → the small HTML subset Telegram accepts. */
export function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(
  chatId: string,
  html: string,
  opts: { disablePreview?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
  const token = botToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        chat_id: chatId,
        text: html.slice(0, 4000),
        parse_mode: "HTML",
        disable_web_page_preview: opts.disablePreview ?? true,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) return { ok: false, error: data.description ?? "telegram error" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Send to a site user (no-op when they have not linked Telegram yet). */
export async function notifyUser(userId: string, html: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
  if (!user?.telegramId) return false;
  const res = await sendTelegramMessage(user.telegramId, html);
  return res.ok;
}

/** "TCC-4F7K2Q" — short enough to type, random enough to not be guessed. */
export function newLinkCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  const body = Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
  return `TCC-${body}`;
}

export async function createLinkCode(userId: string): Promise<{ code: string; deepLink: string; expiresAt: Date }> {
  const code = newLinkCode();
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60_000);
  await prisma.user.update({
    where: { id: userId },
    data: { telegramLinkCode: code, telegramLinkExpires: expiresAt },
  });
  return { code, deepLink: deepLink(code), expiresAt };
}

export type LinkResult =
  | { ok: true; username: string; alreadyMine: boolean }
  | { ok: false; error: string };

/** Called by the bot when a member sends `/start <code>`. */
export async function linkByCode(code: string, telegramId: string, telegramUsername?: string | null): Promise<LinkResult> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: "کد خالی است." };

  const owner = await prisma.user.findUnique({ where: { telegramLinkCode: clean } });
  if (!owner) return { ok: false, error: "این کد معتبر نیست یا منقضی شده." };
  if (owner.telegramLinkExpires && owner.telegramLinkExpires.getTime() < Date.now()) {
    return { ok: false, error: "کد منقضی شده؛ از سایت کد تازه بگیر." };
  }

  // One Telegram account can only serve one site account.
  const taken = await prisma.user.findUnique({ where: { telegramId } });
  if (taken && taken.id !== owner.id) {
    return { ok: false, error: "این تلگرام قبلاً به حساب دیگری وصل شده است." };
  }
  if (owner.telegramId && owner.telegramId !== telegramId) {
    return { ok: false, error: "این حساب سایت قبلاً به تلگرام دیگری وصل شده." };
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      telegramId,
      telegramUsername: telegramUsername ?? null,
      telegramLinkedAt: new Date(),
      telegramLinkCode: null,
      telegramLinkExpires: null,
    },
  });
  return { ok: true, username: owner.username, alreadyMine: false };
}

export async function userByTelegram(telegramId: string) {
  return prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, username: true, banned: true, telegramUsername: true },
  });
}

export function isLinked(user: { telegramId?: string | null }): boolean {
  return Boolean(user.telegramId);
}

/** The gate: true when this user must connect Telegram before buying. */
export function mustConnectTelegram(user: { telegramId?: string | null }): boolean {
  if (!telegramConfigured()) return false; // rollout safety — never lock everyone out
  return !isLinked(user);
}

export function linkExpiryHint(): string {
  return `${LINK_TTL_MINUTES} دقیقه`;
}
