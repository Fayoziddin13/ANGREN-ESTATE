import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabase";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || rawAnonKey;

const isPostgresUrl = (key: string) =>
  key.startsWith("postgres://") ||
  key.startsWith("postgresql://") ||
  key.includes("[YOUR-PASSWORD]");

const sanitizedServiceKey =
  rawServiceKey && !isPostgresUrl(rawServiceKey) ? rawServiceKey : rawAnonKey;

const defaultUrl = isSupabaseConfigured ? rawUrl : "https://placeholder-angren.supabase.co";
const defaultServiceKey = isSupabaseConfigured ? sanitizedServiceKey : "placeholder-service-key";

// Ensure Next.js data cache does not cache Supabase REST queries
const noCacheFetch = (url: any, init?: any) => {
  return fetch(url, {
    ...init,
    cache: "no-store",
  });
};

// Singleton server-side admin client (Server-Only, never bundled to client)
let _supabaseAdminInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdminInstance) {
    _supabaseAdminInstance = createClient(defaultUrl, defaultServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: noCacheFetch,
      },
    });
  }
  return _supabaseAdminInstance;
}

export const supabaseAdmin: SupabaseClient = getSupabaseAdmin();
