import crypto from "crypto";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "./supabaseServer";
import { isSupabaseConfigured } from "./supabase";
import { validateTelegramInitData } from "./telegramServer";

export interface VerifiedRequestUser {
  /** Supabase auth user id, or `tg_<telegram id>` for Telegram Mini App users. */
  id: string;
  source: "google" | "telegram";
  email?: string | null;
  telegramUserId?: number;
  telegramUsername?: string | null;
}

export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";

/**
 * Resolve the caller from credentials the server can verify:
 *  1. signed Telegram Mini App initData (`X-Telegram-Init-Data` header),
 *  2. a Supabase JWT (`Authorization: Bearer …`),
 *  3. a Supabase cookie session.
 * Client-supplied user ids are never trusted. Disabled profiles resolve to null.
 */
export async function getVerifiedRequestUser(req: NextRequest): Promise<VerifiedRequestUser | null> {
  const initData = req.headers.get(TELEGRAM_INIT_DATA_HEADER);
  if (initData) {
    const result = validateTelegramInitData(initData);
    if (result.valid && result.user) {
      return {
        id: `tg_${result.user.id}`,
        source: "telegram",
        telegramUserId: result.user.id,
        telegramUsername: result.user.username || null,
      };
    }
  }

  if (!isSupabaseConfigured) return null;

  let authUser: { id: string; email?: string | null } | null = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7).trim());
      if (data?.user) authUser = data.user;
    } catch {}
  }

  if (!authUser) {
    try {
      const cookieStore = cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
        }
      );
      const { data } = await supabase.auth.getUser();
      if (data?.user) authUser = data.user;
    } catch {}
  }

  if (!authUser) return null;

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("status")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profile?.status === "disabled") return null;
  } catch {}

  return { id: authUser.id, source: "google", email: authUser.email || null };
}

/**
 * Client IP as seen by the platform edge. Vercel/Cloudflare set dedicated headers;
 * for plain X-Forwarded-For only the right-most hop (added by our proxy) is trusted.
 */
export function getTrustedClientIp(req: NextRequest): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return (req as any).ip || "127.0.0.1";
}

/** Non-reversible identifier for rate-limit keys (raw IPs are not stored). */
export function hashForRateLimit(value: string): string {
  return crypto.createHash("sha256").update(`angren-estate:rl:${value}`).digest("hex").slice(0, 32);
}
