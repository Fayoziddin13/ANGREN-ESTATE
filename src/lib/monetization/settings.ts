import { supabaseAdmin } from "@/lib/supabaseServer";
import { audit, monRpc, unwrap } from "./db";
import { MonetizationError } from "./errors";

export interface MonetizationSettings {
  /** Master switch. Off: the old free application form is used and no new orders are created. */
  enabled: boolean;
  listing_payment_enabled: boolean;
  sticker_payment_enabled: boolean;
  free_first_listing_enabled: boolean;
  free_listing_limit: number;
  free_submissions_per_30_days: number;
  order_ttl_minutes: number;
  revision_attempts: number;
}

export const SETTINGS_KEY = "monetization_settings";

const BOOLEAN_KEYS = [
  "enabled",
  "listing_payment_enabled",
  "sticker_payment_enabled",
  "free_first_listing_enabled",
] as const;

const NUMBER_LIMITS: Record<string, [number, number]> = {
  free_listing_limit: [0, 10],
  free_submissions_per_30_days: [1, 50],
  order_ttl_minutes: [5, 1440],
  revision_attempts: [0, 10],
};

/** Settings with defaults applied by the database (single source of truth). */
export async function getMonetizationSettings(): Promise<MonetizationSettings> {
  return monRpc<MonetizationSettings>("mon_settings");
}

/** Validate a partial update coming from the admin panel. */
export function validateSettingsPatch(input: unknown): Partial<MonetizationSettings> {
  if (!input || typeof input !== "object") throw new MonetizationError("validation");
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of BOOLEAN_KEYS) {
    if (key in src) {
      if (typeof src[key] !== "boolean") throw new MonetizationError("validation", key);
      out[key] = src[key];
    }
  }
  for (const [key, [min, max]] of Object.entries(NUMBER_LIMITS)) {
    if (key in src) {
      const n = Number(src[key]);
      if (!Number.isInteger(n) || n < min || n > max) throw new MonetizationError("validation", key);
      out[key] = n;
    }
  }
  if (Object.keys(out).length === 0) throw new MonetizationError("validation");
  return out as Partial<MonetizationSettings>;
}

/** Merge a validated patch into the stored settings and write an audit entry. */
export async function updateMonetizationSettings(
  patch: Partial<MonetizationSettings>,
  actorId: string,
  ipHash?: string | null
): Promise<MonetizationSettings> {
  const before = await getMonetizationSettings();
  const stored = unwrap(
    await supabaseAdmin.from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle()
  ) as { value?: Record<string, unknown> } | null;
  const merged = { ...(stored?.value && typeof stored.value === "object" ? stored.value : {}), ...patch };

  unwrap(
    await supabaseAdmin
      .from("app_settings")
      .upsert({ key: SETTINGS_KEY, value: merged, updated_at: new Date().toISOString() }, { onConflict: "key" })
  );

  const after = await getMonetizationSettings();
  await audit({
    actorType: "admin",
    actorId,
    action: "settings.updated",
    entity: "monetization_settings",
    before,
    after,
    ipHash,
  });
  return after;
}
