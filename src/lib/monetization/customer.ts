import { NextRequest } from "next/server";
import { getTrustedClientIp, getVerifiedRequestUser, hashForRateLimit } from "@/lib/requestIdentity";
import { getTelegramUser } from "@/lib/telegramServer";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { monRpc } from "./db";
import { MonetizationError } from "./errors";

export interface Customer {
  accountId: string;
  identityId: string;
  status: "active" | "blocked";
  provider: "google" | "telegram";
  email: string | null;
  /** Telegram contact phone shared with the bot (verified by Telegram). */
  verifiedPhone: string | null;
  telegramUserId?: number;
}

/** Normalise a phone to E.164 (+998901234567). Returns null when it is not a valid number. */
export function normalizeE164(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/[\s()\-.]/g, "");
  if (!digits) return null;
  if (!digits.startsWith("+")) {
    digits = digits.replace(/^00/, "");
    if (/^998\d{9}$/.test(digits)) digits = `+${digits}`;
    else if (/^\d{9}$/.test(digits)) digits = `+998${digits}`;
    else digits = `+${digits}`;
  }
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** Non-reversible client identifier for audit logs and rate limits. */
export function requestIpHash(req: NextRequest): string {
  return hashForRateLimit(getTrustedClientIp(req));
}

/**
 * The customer behind this request, from credentials the server verifies itself
 * (Supabase JWT/cookie, or signed Telegram initData). Creates the account on first
 * use. A client-supplied user id is never trusted.
 */
export async function resolveCustomer(req: NextRequest, opts: { requireActive?: boolean } = {}): Promise<Customer> {
  const user = await getVerifiedRequestUser(req);
  if (!user) throw new MonetizationError("registration_required");

  let provider: "google" | "telegram";
  let subject: string;
  let verifiedPhone: string | null = null;
  let displayName: string | null = null;

  if (user.source === "telegram" && user.telegramUserId) {
    provider = "telegram";
    subject = String(user.telegramUserId);
    const subscriber = await getTelegramUser(user.telegramUserId).catch(() => null);
    verifiedPhone = normalizeE164(subscriber?.phone);
    displayName = [subscriber?.first_name, subscriber?.last_name].filter(Boolean).join(" ") || null;
  } else {
    provider = "google";
    subject = user.id;
    displayName = user.email || null;
  }

  const rows = await monRpc<Array<{ account_id: string; identity_id: string; account_status: string }>>(
    "mon_resolve_customer_account",
    {
      p_provider: provider,
      p_subject: subject,
      p_email: user.email ?? null,
      p_phone_e164: verifiedPhone,
      p_phone_verified: Boolean(verifiedPhone),
      p_telegram_username: user.telegramUsername ?? null,
      p_display_name: displayName,
    }
  );
  const row = rows?.[0];
  if (!row) throw new MonetizationError("internal", "account resolution returned nothing");

  const customer: Customer = {
    accountId: row.account_id,
    identityId: row.identity_id,
    status: row.account_status === "blocked" ? "blocked" : "active",
    provider,
    email: user.email ?? null,
    verifiedPhone,
    telegramUserId: user.telegramUserId,
  };
  if (opts.requireActive && customer.status !== "active") throw new MonetizationError("account_blocked");
  return customer;
}

/** Shared rate limit (database backed, works across serverless instances). */
export async function enforceRateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.warn("[monetization] rate limit check failed:", error.message);
    return;
  }
  if (data === false) throw new MonetizationError("rate_limited");
}
