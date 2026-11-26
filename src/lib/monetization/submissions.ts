import { supabaseAdmin } from "@/lib/supabaseServer";
import { monRpc, unwrap } from "./db";
import { MonetizationError } from "./errors";
import { normalizeE164, type Customer } from "./customer";
import { isOwnPhotoPath, MAX_PHOTOS, signedPhotoUrls } from "./uploads";
import { processRefund } from "./orders";

export const DEAL_TYPES = ["sale", "rent"] as const;
export const PROPERTY_TYPES = ["apartment", "house", "commercial", "land", "other"] as const;

export interface ListingPayload {
  deal_type: (typeof DEAL_TYPES)[number];
  property_type: (typeof PROPERTY_TYPES)[number];
  location: string;
  description: string;
  rooms?: number;
  area?: number;
  price?: number;
  currency: "USD" | "UZS";
}

export interface SubmissionInput {
  payload: ListingPayload;
  contactName: string;
  contactPhone: string;
  preferredChannel: "phone" | "telegram";
  photos: string[];
  promoCode: string | null;
  idempotencyKey: string | null;
}

function text(value: unknown, min: number, max: number, field: string): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length < min || s.length > max) throw new MonetizationError("validation", field);
  return s;
}

function optionalNumber(value: unknown, min: number, max: number, field: string, integer = false): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new MonetizationError("validation", field);
  }
  return n;
}

/** The listing details (shared by the customer form and the admin editor). */
export function validateListingPayload(body: any): ListingPayload {
  if (!body || typeof body !== "object") throw new MonetizationError("validation");
  const deal = DEAL_TYPES.includes(body.deal_type) ? body.deal_type : null;
  const type = PROPERTY_TYPES.includes(body.property_type) ? body.property_type : null;
  if (!deal) throw new MonetizationError("validation", "deal_type");
  if (!type) throw new MonetizationError("validation", "property_type");
  return {
    deal_type: deal,
    property_type: type,
    location: text(body.location, 2, 200, "location"),
    description: text(body.description, 3, 2000, "description"),
    rooms: type === "land" ? undefined : optionalNumber(body.rooms, 0, 50, "rooms", true),
    area: optionalNumber(body.area, 1, 1_000_000, "area"),
    price: optionalNumber(body.price, 1, 1e13, "price"),
    currency: body.currency === "UZS" ? "UZS" : "USD",
  };
}

/** Validate an application from the browser. Only known fields are kept; prices are never read from here. */
export function validateSubmissionInput(body: any, accountId: string): SubmissionInput {
  if (!body || typeof body !== "object") throw new MonetizationError("validation");
  const payload = validateListingPayload(body);

  const contactPhone = normalizeE164(body.contact_phone);
  if (!contactPhone) throw new MonetizationError("validation", "contact_phone");

  const photos: string[] = Array.isArray(body.photos) ? body.photos : [];
  if (photos.length > MAX_PHOTOS || !photos.every((p) => isOwnPhotoPath(accountId, p))) {
    throw new MonetizationError("validation", "photos");
  }

  const promo = typeof body.promo_code === "string" ? body.promo_code.trim().toUpperCase() : "";
  if (promo && !/^[A-Z0-9_-]{3,32}$/.test(promo)) throw new MonetizationError("validation", "promo_code");

  const key = typeof body.idempotency_key === "string" ? body.idempotency_key : "";

  return {
    payload,
    contactName: text(body.contact_name, 2, 120, "contact_name"),
    contactPhone,
    preferredChannel: body.preferred_channel === "telegram" ? "telegram" : "phone",
    photos: Array.from(new Set(photos)),
    promoCode: promo || null,
    idempotencyKey: /^[A-Za-z0-9_-]{8,64}$/.test(key) ? key : null,
  };
}

/** What a new listing costs this customer now (free first listing, price, discount). */
export async function getListingTerms(customer: Customer, phone: string | null, promoCode: string | null) {
  return monRpc<Record<string, any>>("mon_listing_terms", {
    p_account_id: customer.accountId,
    p_contact_phone: phone ?? customer.verifiedPhone,
    p_promo_code: promoCode,
    p_lock: false,
  });
}

export async function createSubmission(
  customer: Customer,
  input: SubmissionInput,
  channel: "web" | "telegram",
  ipHash: string | null
) {
  // A Telegram user who shared this very number with the bot has a verified phone.
  const phoneVerified = Boolean(customer.verifiedPhone && customer.verifiedPhone === input.contactPhone);
  return monRpc<Record<string, any>>("mon_submit_listing", {
    p_account_id: customer.accountId,
    p_identity_id: customer.identityId,
    p_channel: channel,
    p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone,
    p_phone_verified: phoneVerified,
    p_preferred_channel: input.preferredChannel,
    p_payload: input.payload,
    p_photos: input.photos,
    p_promo_code: input.promoCode,
    p_idempotency_key: input.idempotencyKey,
    p_ip_hash: ipHash,
  });
}

export async function resubmitSubmission(customer: Customer, submissionId: string, input: SubmissionInput) {
  return monRpc<string>("mon_resubmit_submission", {
    p_submission_id: submissionId,
    p_account_id: customer.accountId,
    p_payload: input.payload,
    p_photos: input.photos,
    p_contact_name: input.contactName,
    p_preferred_channel: input.preferredChannel,
  });
}

export async function cancelSubmission(customer: Customer, submissionId: string) {
  const result = await monRpc<{ status: string; refund_id: string | null }>("mon_cancel_submission", {
    p_submission_id: submissionId,
    p_account_id: customer.accountId,
  });
  if (result.refund_id) await processRefund(result.refund_id, { type: "system", id: null });
  return result;
}

/** Everything the "My listings" page shows: applications, orders, stickers, refunds. */
export async function getCustomerDashboard(customer: Customer) {
  const submissions = unwrap(
    await supabaseAdmin
      .from("listing_submissions")
      .select(
        "id, payload, photos, billing, free_reason, moderation_status, revision_count, admin_note, flags, property_id, contact_name, contact_phone, preferred_channel, created_at, submitted_at, reviewed_at"
      )
      .eq("account_id", customer.accountId)
      .order("created_at", { ascending: false })
      .limit(100)
  ) as any[];

  const boosts = unwrap(
    await supabaseAdmin
      .from("property_boosts")
      .select("id, property_id, property_title, sticker_type, duration_days, billing, status, starts_at, ends_at, admin_note, created_at")
      .eq("account_id", customer.accountId)
      .order("created_at", { ascending: false })
      .limit(100)
  ) as any[];

  const orders = unwrap(
    await supabaseAdmin
      .from("payment_orders")
      .select("id, service, submission_id, boost_id, base_amount_uzs, discount_uzs, final_amount_uzs, discount_source, status, status_reason, expires_at, paid_at, created_at")
      .eq("account_id", customer.accountId)
      .order("created_at", { ascending: false })
      .limit(200)
  ) as any[];

  const orderIds = orders.map((o) => o.id);
  const refunds = orderIds.length
    ? (unwrap(
        await supabaseAdmin.from("refunds").select("id, order_id, status, amount_uzs, created_at, completed_at").in("order_id", orderIds)
      ) as any[])
    : [];

  const propertyIds = submissions.map((s) => s.property_id).filter(Boolean);
  const properties = propertyIds.length
    ? (unwrap(
        await supabaseAdmin.from("properties").select("id, slug, status, title_uz, title_ru").in("id", propertyIds)
      ) as any[])
    : [];

  const photoUrls = await signedPhotoUrls(submissions.flatMap((s) => (Array.isArray(s.photos) ? s.photos.slice(0, 1) : [])));

  const now = Date.now();
  return {
    account: { id: customer.accountId, status: customer.status, provider: customer.provider },
    submissions: submissions.map((s) => ({
      ...s,
      cover_url: s.photos?.[0] ? photoUrls[s.photos[0]] || null : null,
      orders: orders.filter((o) => o.submission_id === s.id),
      property: properties.find((p) => p.id === s.property_id) || null,
    })),
    boosts: boosts.map((b) => ({
      ...b,
      is_running: b.status === "ACTIVE" && Date.parse(b.starts_at) <= now && Date.parse(b.ends_at) > now,
      is_expired: b.status === "ACTIVE" && Date.parse(b.ends_at) <= now,
      orders: orders.filter((o) => o.boost_id === b.id),
    })),
    refunds,
  };
}
