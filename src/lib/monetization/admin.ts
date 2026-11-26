import { supabaseAdmin } from "@/lib/supabaseServer";
import { createProperty } from "@/lib/properties";
import { audit, monRpc, unwrap } from "./db";
import { MonetizationError } from "./errors";
import { processRefund } from "./orders";
import { publishSubmissionPhotos, signedPhotoUrls } from "./uploads";
import { STICKER_TYPES } from "./boosts";
import { validateListingPayload, type ListingPayload } from "./submissions";

/** Admin actions of the monetization module. Every state change is audited in SQL or here. */

const TYPE_TITLES: Record<string, { uz: string; ru: string }> = {
  apartment: { uz: "Kvartira", ru: "Квартира" },
  house: { uz: "Hovli / Uy", ru: "Дом" },
  commercial: { uz: "Tijorat obyekti", ru: "Коммерческий объект" },
  land: { uz: "Yer uchastkasi", ru: "Земельный участок" },
  other: { uz: "Obyekt", ru: "Объект" },
};
const USD_RATE_FALLBACK = 12850;

// ------------------------------------------------------------- queue ---

export async function listSubmissions(status?: string | null) {
  let query = supabaseAdmin
    .from("listing_submissions")
    .select(
      "id, account_id, channel, contact_name, contact_phone, phone_verified, preferred_channel, payload, photos, billing, free_reason, moderation_status, revision_count, admin_note, flags, property_id, created_at, submitted_at, reviewed_at, customer_accounts(status, display_name), customer_identities(provider, email, telegram_username)"
    )
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (status && status !== "all") query = query.eq("moderation_status", status);
  const rows = unwrap(await query) as any[];

  const ids = rows.map((r) => r.id);
  const orders = ids.length
    ? (unwrap(
        await supabaseAdmin
          .from("payment_orders")
          .select("id, submission_id, status, final_amount_uzs, discount_uzs, paid_at, created_at")
          .in("submission_id", ids)
          .order("created_at", { ascending: false })
      ) as any[])
    : [];
  return rows.map((r) => ({ ...r, orders: orders.filter((o) => o.submission_id === r.id) }));
}

export async function getSubmissionDetail(id: string) {
  const sub = unwrap(
    await supabaseAdmin
      .from("listing_submissions")
      .select("*, customer_accounts(id, status, status_reason, display_name, created_at), customer_identities(provider, provider_subject, email, phone_e164, phone_verified, telegram_username)")
      .eq("id", id)
      .maybeSingle()
  ) as any;
  if (!sub) throw new MonetizationError("not_found");

  const [orders, claims, auditRows, otherSubs] = await Promise.all([
    supabaseAdmin.from("payment_orders").select("*").eq("submission_id", id).order("created_at", { ascending: false }),
    supabaseAdmin.from("free_listing_claims").select("*").eq("submission_id", id),
    supabaseAdmin
      .from("monetization_audit_logs")
      .select("id, created_at, actor_type, actor_id, action, before_state, after_state, reason")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("listing_submissions")
      .select("id, moderation_status, billing, created_at")
      .eq("account_id", sub.account_id)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const orderRows = unwrap(orders) as any[];
  const refunds = orderRows.length
    ? (unwrap(await supabaseAdmin.from("refunds").select("*").in("order_id", orderRows.map((o) => o.id))) as any[])
    : [];
  const photoUrls = await signedPhotoUrls(Array.isArray(sub.photos) ? sub.photos : []);

  return {
    submission: sub,
    photo_urls: (sub.photos || []).map((p: string) => photoUrls[p] || null),
    orders: orderRows,
    refunds,
    claims: unwrap(claims),
    audit: unwrap(auditRows),
    other_submissions: unwrap(otherSubs),
  };
}

export async function updateSubmissionPayload(id: string, body: any, actorId: string) {
  const payload: ListingPayload = validateListingPayload(body);
  await monRpc("mon_admin_update_submission", {
    p_submission_id: id,
    p_payload: payload,
    p_photos: null,
    p_actor_id: actorId,
  });
}

/**
 * Approve an application: publish its photos, create the property as a DRAFT and
 * link it. The listing becomes public only when an admin publishes the draft in
 * the usual property editor.
 */
export async function approveSubmission(id: string, actorId: string, note: string | null, ipHash: string | null) {
  const sub = unwrap(
    await supabaseAdmin.from("listing_submissions").select("*").eq("id", id).maybeSingle()
  ) as any;
  if (!sub) throw new MonetizationError("not_found");
  if (sub.moderation_status !== "PENDING_REVIEW") throw new MonetizationError("invalid_state");

  const p = sub.payload || {};
  const propertyId = `prop-${Date.now()}`;
  const photoUrls = await publishSubmissionPhotos(Array.isArray(sub.photos) ? sub.photos : [], propertyId);
  const title = TYPE_TITLES[p.property_type] || TYPE_TITLES.other;
  const price = Number(p.price) || 0;
  const priceUzs = p.currency === "UZS" ? price : Math.round(price * USD_RATE_FALLBACK);
  const priceUsd = p.currency === "USD" ? price : Math.round(price / USD_RATE_FALLBACK);

  const created = await createProperty({
    id: propertyId,
    status: "draft",
    deal_type: p.deal_type,
    transaction_type: p.deal_type,
    property_type: p.property_type,
    title_uz: `${title.uz} — ${p.location}`.slice(0, 150),
    title_ru: `${title.ru} — ${p.location}`.slice(0, 150),
    description_uz: p.description || "",
    description_ru: p.description || "",
    price: priceUzs,
    price_uzs: priceUzs,
    price_usd: priceUsd,
    currency: p.currency === "UZS" ? "UZS" : "USD",
    area: Number(p.area) || 0,
    area_sqm: Number(p.area) || 0,
    rooms: Number(p.rooms) || 1,
    address: p.location,
    address_uz: p.location,
    address_ru: p.location,
    photos: photoUrls,
    main_image: photoUrls[0],
    contact_phone: sub.contact_phone,
    owner_phone: sub.contact_phone,
    owner_phone_visible: false,
  } as any);

  return monRpc<Record<string, any>>("mon_moderate_submission", {
    p_submission_id: id,
    p_action: "approve",
    p_note: note,
    p_actor_id: actorId,
    p_property_id: created.id,
    p_ip_hash: ipHash,
  });
}

export async function decideSubmission(
  id: string,
  action: "reject" | "request_revision",
  note: string,
  actorId: string,
  ipHash: string | null
) {
  const result = await monRpc<{ status: string; refund_id: string | null }>("mon_moderate_submission", {
    p_submission_id: id,
    p_action: action,
    p_note: note,
    p_actor_id: actorId,
    p_property_id: null,
    p_ip_hash: ipHash,
  });
  if (result.refund_id) await processRefund(result.refund_id, { type: "admin", id: actorId });
  return result;
}

// ------------------------------------------------------------ stickers ---

export async function listBoosts(status?: string | null) {
  let query = supabaseAdmin
    .from("property_boosts")
    .select("*, customer_accounts(display_name, status)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status && status !== "all") query = query.eq("status", status);
  const rows = unwrap(await query) as any[];
  const ids = rows.map((r) => r.id);
  const orders = ids.length
    ? (unwrap(
        await supabaseAdmin
          .from("payment_orders")
          .select("id, boost_id, status, final_amount_uzs, paid_at")
          .in("boost_id", ids)
          .order("created_at", { ascending: false })
      ) as any[])
    : [];
  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    is_running: r.status === "ACTIVE" && Date.parse(r.starts_at) <= now && Date.parse(r.ends_at) > now,
    is_expired: r.status === "ACTIVE" && Date.parse(r.ends_at) <= now,
    orders: orders.filter((o) => o.boost_id === r.id),
  }));
}

export async function decideBoost(id: string, action: "approve" | "reject" | "revoke", note: string | null, actorId: string) {
  const result = await monRpc<{ status: string; refund_id: string | null }>("mon_moderate_boost", {
    p_boost_id: id,
    p_action: action,
    p_note: note,
    p_actor_id: actorId,
  });
  if (result.refund_id) await processRefund(result.refund_id, { type: "admin", id: actorId });
  return result;
}

// --------------------------------------------------------- money views ---

export async function listOrders(status?: string | null) {
  let query = supabaseAdmin
    .from("payment_orders")
    .select("*, customer_accounts(display_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status && status !== "all") query = query.eq("status", status);
  return unwrap(await query);
}

export async function listRefunds() {
  return unwrap(
    await supabaseAdmin
      .from("refunds")
      .select("*, payment_orders(id, service, final_amount_uzs, provider, account_id, submission_id, boost_id)")
      .order("created_at", { ascending: false })
      .limit(300)
  );
}

/** Admin confirms a refund made by hand in the provider cabinet (needs the provider reference). */
export async function confirmManualRefund(refundId: string, providerRef: string, note: string | null, actorId: string) {
  return monRpc<string>("mon_settle_refund", {
    p_refund_id: refundId,
    p_status: "MANUAL_CONFIRMED",
    p_provider_ref: providerRef,
    p_note: note,
    p_actor_type: "admin",
    p_actor_id: actorId,
  });
}

/** Admin exception: refund a paid order outside the automatic rules (reason required). */
export async function requestAdminRefund(orderId: string, reason: string, actorId: string) {
  const refundId = await monRpc<string>("mon_request_refund", {
    p_order_id: orderId,
    p_reason: reason,
    p_initiated_by: "admin",
    p_actor_id: actorId,
    p_note: null,
  });
  await processRefund(refundId, { type: "admin", id: actorId });
  return refundId;
}

/** Try a failed refund again (a new refund record is created). */
export async function retryRefund(refundId: string, actorId: string) {
  const refund = unwrap(await supabaseAdmin.from("refunds").select("order_id, status, reason").eq("id", refundId).single()) as any;
  if (refund.status !== "FAILED") throw new MonetizationError("invalid_state");
  return requestAdminRefund(refund.order_id, `retry: ${refund.reason}`, actorId);
}

export async function getStats() {
  const orders = unwrap(
    await supabaseAdmin.from("payment_orders").select("service, status, final_amount_uzs, paid_at, refunded_at").limit(10000)
  ) as Array<{ service: string; status: string; final_amount_uzs: number; paid_at: string | null; refunded_at: string | null }>;
  const now = Date.now();
  const day = 86_400_000;
  const sumPaid = (since: number) =>
    orders
      .filter((o) => (o.status === "PAID" || o.status === "REFUNDED") && o.paid_at && Date.parse(o.paid_at) >= since)
      .reduce((s, o) => s + Number(o.final_amount_uzs), 0);
  const sumRefunded = (since: number) =>
    orders
      .filter((o) => o.status === "REFUNDED" && o.refunded_at && Date.parse(o.refunded_at) >= since)
      .reduce((s, o) => s + Number(o.final_amount_uzs), 0);
  const period = (since: number) => ({ gross: sumPaid(since), refunded: sumRefunded(since), net: sumPaid(since) - sumRefunded(since) });

  const count = async (table: string, column: string, value: string) => {
    const { count: c } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true }).eq(column, value);
    return c || 0;
  };
  const [pendingReview, awaitingPayment, revision, boostsPending, refundsOpen, refundsManual] = await Promise.all([
    count("listing_submissions", "moderation_status", "PENDING_REVIEW"),
    count("listing_submissions", "moderation_status", "AWAITING_PAYMENT"),
    count("listing_submissions", "moderation_status", "REVISION_REQUIRED"),
    count("property_boosts", "status", "PENDING_APPROVAL"),
    count("refunds", "status", "REQUESTED"),
    count("refunds", "status", "MANUAL_REQUIRED"),
  ]);
  const nowIso = new Date().toISOString();
  const { count: activeStickers } = await supabaseAdmin
    .from("property_boosts")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso);

  return {
    revenue: {
      today: period(now - (now % day)),
      last_7_days: period(now - 7 * day),
      last_30_days: period(now - 30 * day),
      all_time: period(0),
      by_service: {
        listing: orders.filter((o) => o.service === "listing" && o.status === "PAID").reduce((s, o) => s + Number(o.final_amount_uzs), 0),
        sticker: orders.filter((o) => o.service === "sticker" && o.status === "PAID").reduce((s, o) => s + Number(o.final_amount_uzs), 0),
      },
    },
    counts: {
      pending_review: pendingReview,
      awaiting_payment: awaitingPayment,
      revision_required: revision,
      stickers_pending: boostsPending,
      stickers_running: activeStickers || 0,
      refunds_open: refundsOpen,
      refunds_manual: refundsManual,
      orders_paid: orders.filter((o) => o.status === "PAID").length,
      orders_refunded: orders.filter((o) => o.status === "REFUNDED").length,
    },
  };
}

export async function listAudit(entity?: string | null, entityId?: string | null) {
  let query = supabaseAdmin
    .from("monetization_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (entity) query = query.eq("entity", entity);
  if (entityId) query = query.eq("entity_id", entityId);
  return unwrap(await query);
}

// ------------------------------------------------------------- pricing ---

export async function listPrices() {
  const plans = unwrap(
    await supabaseAdmin
      .from("pricing_plans")
      .select("*")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200)
  ) as any[];
  return { active: plans.filter((p) => p.is_active), history: plans.filter((p) => !p.is_active).slice(0, 50) };
}

export async function setPrice(body: any, actorId: string) {
  const service = body?.service === "sticker" ? "sticker" : body?.service === "listing" ? "listing" : null;
  const price = Number(body?.price_uzs);
  if (!service || !Number.isInteger(price) || price < 1 || price > 1_000_000_000) throw new MonetizationError("validation");
  let sticker: string | null = null;
  let days: number | null = null;
  if (service === "sticker") {
    sticker = STICKER_TYPES.includes(body?.sticker_type) ? body.sticker_type : null;
    days = Number(body?.duration_days);
    if (!sticker || !Number.isInteger(days) || days < 1 || days > 365) throw new MonetizationError("validation");
  }
  return monRpc<string>("mon_set_price", {
    p_service: service,
    p_sticker_type: sticker,
    p_duration_days: days,
    p_price_uzs: price,
    p_actor_id: actorId,
  });
}

export async function deactivatePrice(planId: string, actorId: string) {
  await monRpc("mon_deactivate_price", { p_plan_id: planId, p_actor_id: actorId });
}

// --------------------------------------------------- promo codes / sales ---

function parseDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const t = Date.parse(String(value));
  if (!Number.isFinite(t)) throw new MonetizationError("validation", field);
  return new Date(t).toISOString();
}

function parseServices(value: unknown): string[] {
  const list = Array.isArray(value) ? value.filter((s) => s === "listing" || s === "sticker") : [];
  if (!list.length) throw new MonetizationError("validation", "services");
  return Array.from(new Set(list));
}

function parseDiscount(body: any) {
  const type = body?.discount_type === "fixed" ? "fixed" : body?.discount_type === "percent" ? "percent" : null;
  const value = Number(body?.discount_value);
  if (!type || !Number.isInteger(value) || value < 1) throw new MonetizationError("validation", "discount");
  if (type === "percent" && value > 99) throw new MonetizationError("validation", "discount");
  return { type, value };
}

export async function listPromoCodes() {
  const codes = unwrap(await supabaseAdmin.from("promo_codes").select("*").order("created_at", { ascending: false })) as any[];
  const redemptions = codes.length
    ? (unwrap(await supabaseAdmin.from("promo_redemptions").select("promo_code_id, state, discount_uzs")) as any[])
    : [];
  return codes.map((c) => {
    const mine = redemptions.filter((r) => r.promo_code_id === c.id);
    return {
      ...c,
      uses_consumed: mine.filter((r) => r.state === "consumed").length,
      uses_reserved: mine.filter((r) => r.state === "reserved").length,
      discount_given_uzs: mine.filter((r) => r.state === "consumed").reduce((s, r) => s + Number(r.discount_uzs), 0),
    };
  });
}

export async function createPromoCode(body: any, actorId: string) {
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new MonetizationError("validation", "code");
  const { type, value } = parseDiscount(body);
  const services = parseServices(body?.services);
  const maxUses = body?.max_uses ? Number(body.max_uses) : null;
  const perAccount = body?.per_account_limit ? Number(body.per_account_limit) : 1;
  const minOrder = body?.min_order_uzs ? Number(body.min_order_uzs) : 0;
  if ((maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) || !Number.isInteger(perAccount) || perAccount < 1) {
    throw new MonetizationError("validation", "limits");
  }
  if (!Number.isInteger(minOrder) || minOrder < 0) throw new MonetizationError("validation", "min_order_uzs");
  const stickerTypes = Array.isArray(body?.sticker_types) && body.sticker_types.length
    ? body.sticker_types.filter((s: string) => STICKER_TYPES.includes(s as any))
    : null;
  const row = {
    code,
    discount_type: type,
    discount_value: value,
    services,
    sticker_types: stickerTypes && stickerTypes.length ? stickerTypes : null,
    min_order_uzs: minOrder,
    max_uses: maxUses,
    per_account_limit: perAccount,
    starts_at: parseDate(body?.starts_at, "starts_at"),
    ends_at: parseDate(body?.ends_at, "ends_at"),
    is_active: body?.is_active !== false,
    note: typeof body?.note === "string" ? body.note.slice(0, 300) : null,
  };
  const created = unwrap(await supabaseAdmin.from("promo_codes").insert(row).select("*").single()) as any;
  await audit({ actorType: "admin", actorId, action: "promo.created", entity: "promo_code", entityId: created.id, after: row });
  return created;
}

export async function updatePromoCode(id: string, body: any, actorId: string) {
  const before = unwrap(await supabaseAdmin.from("promo_codes").select("*").eq("id", id).maybeSingle()) as any;
  if (!before) throw new MonetizationError("not_found");
  const patch: Record<string, unknown> = {};
  if (typeof body?.is_active === "boolean") patch.is_active = body.is_active;
  if ("ends_at" in (body || {})) patch.ends_at = parseDate(body.ends_at, "ends_at");
  if ("max_uses" in (body || {})) {
    const n = body.max_uses === null || body.max_uses === "" ? null : Number(body.max_uses);
    if (n !== null && (!Number.isInteger(n) || n < 1)) throw new MonetizationError("validation", "max_uses");
    patch.max_uses = n;
  }
  if (typeof body?.note === "string") patch.note = body.note.slice(0, 300);
  if (!Object.keys(patch).length) throw new MonetizationError("validation");
  const updated = unwrap(await supabaseAdmin.from("promo_codes").update(patch).eq("id", id).select("*").single()) as any;
  await audit({ actorType: "admin", actorId, action: "promo.updated", entity: "promo_code", entityId: id, before, after: patch });
  return updated;
}

export async function deletePromoCode(id: string, actorId: string) {
  const { count } = await supabaseAdmin.from("promo_redemptions").select("id", { count: "exact", head: true }).eq("promo_code_id", id);
  if ((count || 0) > 0) throw new MonetizationError("invalid_state", "promo code was used; deactivate it instead");
  unwrap(await supabaseAdmin.from("promo_codes").delete().eq("id", id));
  await audit({ actorType: "admin", actorId, action: "promo.deleted", entity: "promo_code", entityId: id });
}

export async function listPromotions() {
  return unwrap(await supabaseAdmin.from("promotions").select("*").order("starts_at", { ascending: false }));
}

export async function createPromotion(body: any, actorId: string) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 120) throw new MonetizationError("validation", "name");
  const { type, value } = parseDiscount(body);
  const startsAt = parseDate(body?.starts_at, "starts_at");
  const endsAt = parseDate(body?.ends_at, "ends_at");
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) throw new MonetizationError("validation", "dates");
  const row = {
    name,
    discount_type: type,
    discount_value: value,
    services: parseServices(body?.services),
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: body?.is_active !== false,
  };
  const created = unwrap(await supabaseAdmin.from("promotions").insert(row).select("*").single()) as any;
  await audit({ actorType: "admin", actorId, action: "promotion.created", entity: "promotion", entityId: created.id, after: row });
  return created;
}

export async function updatePromotion(id: string, body: any, actorId: string) {
  const patch: Record<string, unknown> = {};
  if (typeof body?.is_active === "boolean") patch.is_active = body.is_active;
  if ("ends_at" in (body || {})) patch.ends_at = parseDate(body.ends_at, "ends_at");
  if (!Object.keys(patch).length) throw new MonetizationError("validation");
  const updated = unwrap(await supabaseAdmin.from("promotions").update(patch).eq("id", id).select("*").single()) as any;
  await audit({ actorType: "admin", actorId, action: "promotion.updated", entity: "promotion", entityId: id, after: patch });
  return updated;
}

export async function deletePromotion(id: string, actorId: string) {
  const { count } = await supabaseAdmin.from("payment_orders").select("id", { count: "exact", head: true }).eq("promotion_id", id);
  if ((count || 0) > 0) throw new MonetizationError("invalid_state", "promotion was used; deactivate it instead");
  unwrap(await supabaseAdmin.from("promotions").delete().eq("id", id));
  await audit({ actorType: "admin", actorId, action: "promotion.deleted", entity: "promotion", entityId: id });
}

// ------------------------------------------------------------ accounts ---

export async function listAccounts() {
  const accounts = unwrap(
    await supabaseAdmin
      .from("customer_accounts")
      .select("*, customer_identities(provider, provider_subject, email, phone_e164, phone_verified, telegram_username, last_seen_at)")
      .order("created_at", { ascending: false })
      .limit(500)
  ) as any[];
  const subs = accounts.length
    ? (unwrap(await supabaseAdmin.from("listing_submissions").select("account_id, moderation_status, billing")) as any[])
    : [];
  return accounts.map((a) => {
    const mine = subs.filter((s) => s.account_id === a.id);
    return {
      ...a,
      submissions_total: mine.length,
      submissions_free: mine.filter((s) => s.billing === "free").length,
      submissions_approved: mine.filter((s) => s.moderation_status === "APPROVED").length,
    };
  });
}

export async function setAccountStatus(id: string, status: "active" | "blocked", reason: string | null, actorId: string, ipHash: string | null) {
  return monRpc("mon_set_customer_account_status", {
    p_account_id: id,
    p_status: status,
    p_reason: reason,
    p_actor_id: actorId,
    p_ip_hash: ipHash,
    p_request_id: null,
  });
}
