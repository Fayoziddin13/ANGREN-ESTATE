import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Authorization header carrying the current Supabase session JWT.
 * The browser session lives in localStorage (not cookies), so API routes that
 * need to know the signed-in user must receive the token explicitly.
 */
export async function getSupabaseAuthHeaders(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** Signed Telegram Mini App initData, when running inside Telegram. */
export function getTelegramInitData(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const initData = (window as any).Telegram?.WebApp?.initData;
  return typeof initData === "string" && initData.length > 0 ? initData : undefined;
}

/**
 * Every credential the server can verify for the current visitor: the Supabase
 * JWT (Google users) and, inside the Mini App, the signed Telegram initData.
 */
export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const headers = await getSupabaseAuthHeaders();
  const initData = getTelegramInitData();
  if (initData) headers["X-Telegram-Init-Data"] = initData;
  return headers;
}
