import { supabaseAdmin } from "@/lib/supabaseServer";
import { monRpc, unwrap } from "./db";
import { MonetizationError } from "./errors";
import { processRefund } from "./orders";
import type { Customer } from "./customer";

export const STICKER_TYPES = ["top", "tez_sotiladi", "yaxshi_taklif"] as const;
export type StickerType = (typeof STICKER_TYPES)[number];

export function validateBoostInput(body: any) {
  const sticker = STICKER_TYPES.includes(body?.sticker_type) ? (body.sticker_type as StickerType) : null;
  const days = Number(body?.duration_days);
  const propertyId = typeof body?.property_id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(body.property_id) ? body.property_id : null;
  if (!sticker || !propertyId || !Number.isInteger(days) || days < 1 || days > 365) {
    throw new MonetizationError("validation");
  }
  const promo = typeof body?.promo_code === "string" ? body.promo_code.trim().toUpperCase() : "";
  if (promo && !/^[A-Z0-9_-]{3,32}$/.test(promo)) throw new MonetizationError("validation", "promo_code");
  const key = typeof body?.idempotency_key === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.idempotency_key) ? body.idempotency_key : null;
  return { propertyId, sticker, days, promoCode: promo || null, idempotencyKey: key };
}

export async function requestBoost(customer: Customer, input: ReturnType<typeof validateBoostInput>) {
  return monRpc<Record<string, any>>("mon_request_boost", {
    p_account_id: customer.accountId,
    p_property_id: input.propertyId,
    p_sticker_type: input.sticker,
    p_duration_days: input.days,
    p_promo_code: input.promoCode,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function cancelBoost(customer: Customer, boostId: string) {
  const result = await monRpc<{ status: string; refund_id: string | null }>("mon_cancel_boost", {
    p_boost_id: boostId,
    p_account_id: customer.accountId,
  });
  if (result.refund_id) await processRefund(result.refund_id, { type: "system", id: null });
  return result;
}

/** Price list shown to customers: active listing price and sticker prices per duration. */
export async function getPublicPriceList() {
  const plans = unwrap(
    await supabaseAdmin
      .from("pricing_plans")
      .select("id, service, sticker_type, duration_days, price_uzs")
      .eq("is_active", true)
      .order("sort_order")
      .order("duration_days")
  ) as Array<{ id: string; service: string; sticker_type: string | null; duration_days: number | null; price_uzs: number }>;
  return {
    listing: plans.find((p) => p.service === "listing")?.price_uzs ?? null,
    stickers: plans.filter((p) => p.service === "sticker"),
  };
}

/**
 * Stickers that are showing right now, per property. Expiry is decided here, at
 * read time, so a finished period disappears without any background job.
 */
export async function getRunningStickers(propertyIds?: string[]): Promise<Map<string, Set<StickerType>>> {
  const map = new Map<string, Set<StickerType>>();
  const nowIso = new Date().toISOString();
  let query = supabaseAdmin
    .from("property_boosts")
    .select("property_id, sticker_type")
    .eq("status", "ACTIVE")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso);
  if (propertyIds && propertyIds.length) query = query.in("property_id", propertyIds);
  const { data, error } = await query;
  if (error) {
    // Monetization tables may not exist yet (e.g. production before the migration):
    // the site must keep working exactly as before.
    return map;
  }
  for (const row of data || []) {
    if (!row.property_id) continue;
    if (!map.has(row.property_id)) map.set(row.property_id, new Set());
    map.get(row.property_id)!.add(row.sticker_type as StickerType);
  }
  return map;
}
