import { createClient, SupabaseClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Determine if live, non-placeholder credentials have been configured
export const isSupabaseConfigured = Boolean(
  rawUrl &&
    rawAnonKey &&
    !rawUrl.includes("your-project") &&
    !rawUrl.includes("mock-project") &&
    !rawAnonKey.includes("your-anon-key") &&
    !rawAnonKey.includes("mock-anon-key")
);

const defaultUrl = isSupabaseConfigured ? rawUrl : "https://placeholder-angren.supabase.co";
const defaultAnonKey = isSupabaseConfigured ? rawAnonKey : "placeholder-anon-key";

// Ensure Next.js data cache does not cache Supabase REST queries
const noCacheFetch = (url: any, init?: any) => {
  return fetch(url, {
    ...init,
    cache: "no-store",
  });
};

// Standard Public Client (Subject to RLS)
export const supabase: SupabaseClient = createClient(defaultUrl, defaultAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: noCacheFetch,
  },
});

/**
 * Diagnostic test to verify live connection to Supabase instance
 */
export async function testSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  url: string;
  latencyMs?: number;
  error?: string;
  recordsCount?: number;
}> {
  if (!isSupabaseConfigured) {
    return {
      configured: false,
      connected: false,
      url: rawUrl || "(empty)",
      error: "Supabase credentials in .env.local are template placeholders (your-project.supabase.co).",
    };
  }

  const start = Date.now();
  try {
    const { count, error } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true });

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        configured: true,
        connected: false,
        url: rawUrl,
        latencyMs,
        error: error.message,
      };
    }

    return {
      configured: true,
      connected: true,
      url: rawUrl,
      latencyMs,
      recordsCount: count ?? 0,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      url: rawUrl,
      latencyMs: Date.now() - start,
      error: err?.message || String(err),
    };
  }
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    console.info("[Supabase Auth] Live credentials not configured yet. Simulating Google Auth.");
    return { error: null, data: { url: null } };
  }

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}` : undefined,
    },
  });
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    return { error: null };
  }
  return await supabase.auth.signOut();
}
