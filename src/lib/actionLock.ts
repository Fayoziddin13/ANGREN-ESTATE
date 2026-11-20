import { supabaseAdmin, isSupabaseConfigured } from "./supabaseServer";

/**
 * Short-lived cross-instance guard for actions that must not run twice in parallel
 * (e.g. an admin double-clicking "send to Telegram"). Uses the atomic
 * check_rate_limit() RPC, so it works across serverless instances.
 *
 * Returns true when the caller may proceed. Fails open if the database is not
 * reachable, so the guard can never block the feature itself.
 */
export async function acquireActionLock(key: string, windowSeconds: number): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: `lock:${key}`,
      p_max: 1,
      p_window_seconds: windowSeconds,
    });
    if (error || typeof data !== "boolean") return true;
    return data;
  } catch {
    return true;
  }
}
