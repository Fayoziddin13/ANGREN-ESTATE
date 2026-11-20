import crypto from "crypto";

/**
 * Telegram webhook authenticity (Bot API `secret_token`).
 *
 * Telegram sends the secret registered via `setWebhook` in the
 * `X-Telegram-Bot-Api-Secret-Token` header of every update. Requests without
 * the correct header are not from Telegram and must be rejected.
 *
 * Secret source:
 * 1. `TELEGRAM_WEBHOOK_SECRET` env (1–256 chars of A–Z, a–z, 0–9, `_`, `-`), or
 * 2. a value derived from `TELEGRAM_BOT_TOKEN` with HMAC-SHA256, so no extra
 *    env var is required. `scripts/setup-telegram-bot.mjs` uses the same
 *    derivation — keep both in sync.
 */
export const TELEGRAM_SECRET_HEADER = "x-telegram-bot-api-secret-token";

const DERIVATION_LABEL = "angren-estate:telegram-webhook-secret:v1";
const VALID_SECRET = /^[A-Za-z0-9_-]{16,256}$/;

export function getTelegramWebhookSecret(
  botToken: string | undefined = process.env.TELEGRAM_BOT_TOKEN
): string | null {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (explicit) {
    if (VALID_SECRET.test(explicit)) return explicit;
    console.error(
      "[TelegramWebhook] TELEGRAM_WEBHOOK_SECRET is invalid (need 16–256 chars of A-Z a-z 0-9 _ -); falling back to the token-derived secret."
    );
  }
  if (!botToken) return null;
  return crypto.createHmac("sha256", botToken).update(DERIVATION_LABEL).digest("base64url");
}

/** Constant-time check of the secret header sent by Telegram. */
export function isAuthenticTelegramWebhookRequest(
  headerValue: string | null,
  botToken?: string
): boolean {
  const expected = getTelegramWebhookSecret(botToken);
  if (!expected || !headerValue) return false;
  const received = Buffer.from(headerValue);
  const wanted = Buffer.from(expected);
  return received.length === wanted.length && crypto.timingSafeEqual(received, wanted);
}
