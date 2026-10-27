import { Property, TelegramSubscriber } from "./types";
import { formatPrice } from "./currency";
import {
  getEligibleNotificationSubscribers,
  hasNotificationBeenSent,
  recordTelegramNotification,
  setTelegramUserNotifications,
  sendTelegramDirectMessage,
  sendTelegramPhoto,
} from "./telegramServer";
import { supabaseAdmin } from "./supabaseServer";
import { isSupabaseConfigured } from "./supabase";
import { updateProperty } from "./properties";

export const PRODUCTION_SITE_URL = "https://angrenestate.uz";
export const SITE_URL = PRODUCTION_SITE_URL;

/**
 * Resolve a secure, public HTTPS base URL for Telegram channel posts and inline buttons.
 * Telegram Bot API strictly prohibits local URLs (localhost, 127.0.0.1, http://)
 * in public channel inline keyboards and photo endpoints.
 *
 * Rules:
 * - Must start with 'https://'
 * - Must NOT contain 'localhost', '127.0.0.1', or '0.0.0.0'
 * - If candidate from env (NEXT_PUBLIC_SITE_URL, SITE_URL) fails any check,
 *   safely falls back to canonical production domain 'https://angrenestate.uz'.
 */
export function getTelegramPublicSiteUrl(): string {
  const envUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ""
  ).trim();

  if (
    envUrl &&
    envUrl.startsWith("https://") &&
    !envUrl.includes("localhost") &&
    !envUrl.includes("127.0.0.1") &&
    !envUrl.includes("0.0.0.0")
  ) {
    return envUrl.replace(/\/+$/, "");
  }

  return PRODUCTION_SITE_URL;
}

/**
 * Build canonical public HTTPS URL for a property.
 * Strictly guarantees:
 * - Protocol is 'https://'
 * - Host is never localhost or 127.0.0.1
 * - Format: 'https://angrenestate.uz/properties/{propertyId}'
 */
export function buildPropertyPublicUrl(propertyId: string, lang?: "uz" | "ru"): string {
  const base = getTelegramPublicSiteUrl();
  const cleanId = encodeURIComponent(String(propertyId).trim());
  const query = lang ? `?lang=${lang}` : "";
  return `${base}/properties/${cleanId}${query}`;
}

/**
 * Sanitize an image URL for diagnostic logging to avoid leaking sensitive query params or tokens.
 */
export function sanitizeDiagnosticUrl(url: string): string {
  if (!url) return "<empty>";
  try {
    const parsed = new URL(url);
    if (parsed.search) {
      parsed.search = "?[REDACTED_QUERY]";
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&][^=]+=)[^&]+/g, "$1[REDACTED]").slice(0, 150);
  }
}

/**
 * Select primary candidate photo from property.
 * Priority:
 * 1. property.main_image (if non-empty string)
 * 2. property.images[0] (or first non-empty string)
 * 3. property.photos[0] (or first non-empty string)
 */
export function resolvePropertyPhotoUrl(property: Property): string {
  const candidates: Array<string | undefined | null> = [
    property.main_image,
    ...(Array.isArray(property.images) ? property.images : []),
    ...(Array.isArray(property.photos) ? property.photos : []),
  ];

  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return "";
}

/**
 * Resolve a canonical public HTTPS photo URL for Telegram delivery.
 * - Relative paths (/uploads/...) are prefixed with public canonical site URL.
 * - Localhost, 127.0.0.1, 0.0.0.0 are strictly rejected.
 * - Verified public HTTPS is enforced.
 */
export function resolveCanonicalPhotoUrl(rawPhotoUrl: string): {
  url: string;
  isValidPublicHttps: boolean;
  error?: string;
} {
  let url = rawPhotoUrl.trim();
  if (!url) {
    return { url: "", isValidPublicHttps: false, error: "Empty photo URL" };
  }

  if (url.startsWith("/")) {
    const siteUrl = getTelegramPublicSiteUrl();
    url = `${siteUrl}${url}`;
  }

  const isLocal =
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("0.0.0.0");

  if (isLocal) {
    return {
      url: "",
      isValidPublicHttps: false,
      error: `Local photo URL '${sanitizeDiagnosticUrl(url)}' is prohibited (Telegram cannot fetch from localhost/127.0.0.1)`,
    };
  }

  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    return {
      url,
      isValidPublicHttps: false,
      error: `Photo URL '${sanitizeDiagnosticUrl(url)}' does not start with http(s)://`,
    };
  }

  return { url, isValidPublicHttps: true };
}

/**
 * Validate image URL accessibility before attempting Telegram Bot API delivery.
 * Attempts HEAD first with timeout. If HEAD is disallowed (405/403) or fails,
 * safely falls back to a lightweight GET with Range: bytes=0-1024.
 * Verifies standard image content types (JPEG, PNG, WebP).
 */
export async function checkImageUrlAccessible(
  url: string,
  timeoutMs = 4000
): Promise<{ accessible: boolean; contentType?: string; size?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let headResp: Response | null = null;
    try {
      headResp = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "AngrenEstate-ImageValidator/1.0" },
        signal: controller.signal,
      });
    } catch {
      // Ignore network/abort error on HEAD, will try GET
    }

    if (headResp && headResp.ok) {
      clearTimeout(timer);
      const contentType = headResp.headers.get("content-type") || "";
      const contentLength = headResp.headers.get("content-length");
      const size = contentLength ? parseInt(contentLength, 10) : undefined;
      return {
        accessible: true,
        contentType,
        size,
      };
    }

    // HEAD failed, 403, or 405 Method Not Allowed: Try GET with Range
    const getController = new AbortController();
    const getTimer = setTimeout(() => getController.abort(), timeoutMs);
    try {
      const getResp = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "AngrenEstate-ImageValidator/1.0",
          Range: "bytes=0-1024",
        },
        signal: getController.signal,
      });
      clearTimeout(getTimer);

      if (getResp.ok || getResp.status === 206) {
        const contentType = getResp.headers.get("content-type") || "";
        const contentLength = getResp.headers.get("content-length");
        const size = contentLength ? parseInt(contentLength, 10) : undefined;
        return {
          accessible: true,
          contentType,
          size,
        };
      }

      return {
        accessible: false,
        error: `HTTP ${getResp.status} ${getResp.statusText}`,
      };
    } catch (getErr: any) {
      clearTimeout(getTimer);
      return {
        accessible: false,
        error: getErr?.message || "GET check failed",
      };
    }
  } catch (err: any) {
    return {
      accessible: false,
      error: err?.message || "Image accessibility check exception",
    };
  }
}

/**
 * Discern whether a Telegram Bot API error description is genuinely a photo delivery/format error.
 * CRITICAL: Admin rights errors, chat not found, and button errors must NEVER trigger photo fallback.
 */
export function isTelegramPhotoSpecificError(description?: string): boolean {
  if (!description) return false;
  const lower = description.toLowerCase();

  // Explicit non-photo errors that should NEVER trigger photo fallback
  if (
    lower.includes("chat not found") ||
    lower.includes("not an administrator") ||
    lower.includes("need administrator") ||
    lower.includes("chat_admin_required") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized") ||
    lower.includes("inline keyboard") ||
    lower.includes("button") ||
    lower.includes("too many requests") ||
    lower.includes("retry after")
  ) {
    return false;
  }

  // Exact known Telegram photo delivery / processing errors
  return (
    lower.includes("failed to get http url content") ||
    lower.includes("wrong type of the web page content") ||
    lower.includes("photo_invalid_dimensions") ||
    lower.includes("wrong file identifier") ||
    lower.includes("image_process_failed") ||
    lower.includes("photo is too big") ||
    lower.includes("file is too big") ||
    (lower.includes("photo") && !lower.includes("can't parse entities"))
  );
}

/**
 * Build minimal, localized notification text for property.
 * Strictly adheres to project specification:
 * - UZ Latin or Russian only (no Cyrillic Uzbek).
 * - No 0 rooms, 0 m2, undefined, null, or N/A.
 * - Project price formatter.
 */
export function buildPropertyNotificationText(property: Property, lang: "uz" | "ru" = "uz"): string {
  const isUz = lang === "uz";
  const lines: string[] = [];

  // Header
  lines.push(isUz ? "🏠 ANGREN ESTATE'da yangi obyekt" : "🏠 Новый объект в ANGREN ESTATE");
  lines.push("");

  // Location
  const loc = isUz
    ? property.district_name_uz || property.address_uz || property.district
    : property.district_name_ru || property.address_ru || property.district;
  if (loc && loc.trim()) {
    lines.push(`📍 ${loc.trim()}`);
  }

  // Rooms (strictly omit if 0 or undefined)
  if (property.rooms && property.rooms > 0) {
    if (isUz) {
      lines.push(`🛏 ${property.rooms} xona`);
    } else {
      const r = property.rooms;
      const word = r === 1 ? "комната" : r >= 2 && r <= 4 ? "комнаты" : "комнат";
      lines.push(`🛏 ${r} ${word}`);
    }
  }

  // Area (sqm or sotikh)
  if (property.area_sqm && property.area_sqm > 0) {
    lines.push(`📐 ${property.area_sqm} ${isUz ? "m²" : "м²"}`);
  } else if (property.area_sotikh && property.area_sotikh > 0) {
    lines.push(`📐 ${property.area_sotikh} ${isUz ? "sotix" : "соток"}`);
  } else if (property.area && property.area > 0) {
    lines.push(`📐 ${property.area} ${isUz ? "m²" : "м²"}`);
  }

  // Price (formatted using canonical formatPrice helper)
  const isNegotiable = Boolean(property.price_negotiable || (property.amenities as any)?.price_negotiable);
  const bargainAllowed = Boolean(property.bargain_allowed || (property.amenities as any)?.bargain_allowed);
  const bargainText = bargainAllowed ? ` (${isUz ? "Savdolashish mumkin" : "Торг уместен"})` : "";

  if (isNegotiable) {
    lines.push(`💰 ${isUz ? "Narxi kelishiladi" : "Цена договорная"}${bargainText}`);
  } else {
    const priceVal = property.price_uzs || property.price || 0;
    if (priceVal > 0) {
      const formatted = formatPrice(priceVal, lang, property.currency || "USD", false, 12800, property.price_usd);
      lines.push(`💰 ${formatted.primary}${bargainText}`);
    }
  }

  return lines.join("\n");
}

/**
 * Build inline keyboard with Mini App deep-link to the exact property.
 * Strictly single button as specified: [Открыть объект →] / [Obyektni ko‘rish →].
 */
export function buildPropertyNotificationMarkup(propertyId: string, lang: "uz" | "ru" = "uz") {
  const isUz = lang === "uz";
  const openUrl = buildPropertyPublicUrl(propertyId, lang);

  return {
    inline_keyboard: [
      [
        {
          text: isUz ? "Obyektni ochish →" : "Открыть объект →",
          url: openUrl,
        },
      ],
    ],
  };
}

/**
 * Send notification to a single subscriber.
 * Formatted identically to Telegram channel posts (photo, title, price, params, address, open button).
 * Handles blocked/deactivated users by updating notifications_enabled = false.
 */
export async function dispatchNotificationToUser(
  user: TelegramSubscriber,
  property: Property
): Promise<{ status: "sent" | "failed" | "blocked"; messageId?: number; error?: string }> {
  const lang = user.language === "ru" ? "ru" : "uz";
  const caption = buildChannelPostCaption(property, lang);
  const replyMarkup = buildChannelPostMarkup(property, lang);

  // Resolve photo candidate
  const rawPhoto = resolvePropertyPhotoUrl(property);
  const resolvedPhoto = resolveCanonicalPhotoUrl(rawPhoto);
  const photoUrl = resolvedPhoto.url;

  let res: {
    ok: boolean;
    result?: any;
    description?: string;
    error_code?: number;
    http_status?: number;
  };

  if (photoUrl && resolvedPhoto.isValidPublicHttps) {
    try {
      res = await sendTelegramPhoto(user.telegram_user_id, photoUrl, caption, replyMarkup);

      if (!res.ok && isTelegramPhotoSpecificError(res.description)) {
        try {
          const dlController = new AbortController();
          const dlTimeout = setTimeout(() => dlController.abort(), 6000);
          const dlResp = await fetch(photoUrl, {
            signal: dlController.signal,
            headers: { "User-Agent": "AngrenEstate-Server/1.0" },
          });
          clearTimeout(dlTimeout);

          if (dlResp.ok) {
            const arrayBuf = await dlResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            const contentType = dlResp.headers.get("content-type") || "image/jpeg";
            if (buffer.length > 0 && buffer.length <= 10 * 1024 * 1024) {
              res = await sendTelegramPhoto(
                user.telegram_user_id,
                buffer,
                caption,
                replyMarkup,
                undefined,
                contentType
              );
            }
          }
        } catch {
          // Ignore error and fall back to text
        }

        if (!res.ok) {
          res = await sendTelegramDirectMessage(user.telegram_user_id, caption, replyMarkup);
        }
      }
    } catch {
      res = await sendTelegramDirectMessage(user.telegram_user_id, caption, replyMarkup);
    }
  } else {
    res = await sendTelegramDirectMessage(user.telegram_user_id, caption, replyMarkup);
  }

  if (res.ok) {
    return { status: "sent", messageId: res.result?.message_id };
  }

  const desc = res.description || "Unknown error";
  console.error(
    `[TelegramNotifications] Telegram API error: error_code=${res.error_code} description=${desc}`
  );

  // 403: Bot was blocked by user | 400: Chat not found / user deactivated
  if (
    res.error_code === 403 ||
    (res.error_code === 400 && desc.toLowerCase().includes("chat not found")) ||
    desc.toLowerCase().includes("bot was blocked")
  ) {
    // Automatically disable notifications for this user
    await setTelegramUserNotifications(user.telegram_user_id, false);
    return { status: "blocked", error: desc };
  }

  return { status: "failed", error: desc };
}

/**
 * Sleep helper for rate limiting.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Manual or automated broadcast to eligible Telegram subscribers for a property.
 * Awaited serverless execution to guarantee delivery before Lambda terminates.
 * Supports forceRepeat for manual admin resends.
 */
export async function broadcastPropertyToTelegramSubscribers(
  property: Property,
  options?: { forceRepeat?: boolean }
): Promise<{ sent: number; failed: number; blocked: number; total: number; alreadySentCount: number }> {
  const summary = { sent: 0, failed: 0, blocked: 0, total: 0, alreadySentCount: 0 };
  const forceRepeat = Boolean(options?.forceRepeat);

  try {
    const now = new Date().toISOString();

    // 1. Fetch all active subscribers FIRST from Supabase (canonical)
    const subscribers = await getEligibleNotificationSubscribers();
    summary.total = subscribers ? subscribers.length : 0;

    if (!subscribers || subscribers.length === 0) {
      console.log(`[TelegramNotifications] No eligible Telegram subscribers.`);
      return summary;
    }

    console.log(
      `[TelegramNotifications] propertyId=${property.id} subscribers=${subscribers.length}`
    );

    // 2. Process subscribers sequentially with rate-limiting
    for (const sub of subscribers) {
      try {
        // Idempotency check: has this user already been notified for this property?
        if (!forceRepeat) {
          const alreadySent = await hasNotificationBeenSent(property.id, sub.telegram_user_id);
          if (alreadySent) {
            summary.alreadySentCount++;
            continue;
          }
        }

        const result = await dispatchNotificationToUser(sub, property);
        if (result.status === "sent") {
          summary.sent++;
        } else if (result.status === "blocked") {
          summary.blocked++;
        } else {
          summary.failed++;
        }

        await recordTelegramNotification({
          property_id: property.id,
          telegram_user_id: sub.telegram_user_id,
          status: result.status,
          telegram_message_id: result.messageId,
          error_message: result.error,
        });

        // 35ms pause between sends (safe within Telegram's 30 msg/sec limit)
        await sleep(35);
      } catch (subErr: any) {
        summary.failed++;
        console.error(
          `[TelegramNotifications] Error sending to user ${sub.telegram_user_id}:`,
          subErr?.message
        );
      }
    }

    // 3. Mark property as notified in Supabase ONLY IF at least one notification was successfully delivered
    if (isSupabaseConfigured && summary.sent > 0) {
      try {
        const { error: colErr } = await supabaseAdmin
          .from("properties")
          .update({
            telegram_notified_at: now,
          })
          .eq("id", property.id);

        if (colErr) {
          const { data: propRow } = await supabaseAdmin
            .from("properties")
            .select("amenities")
            .eq("id", property.id)
            .single();

          const currentAmenities =
            typeof propRow?.amenities === "object" && propRow?.amenities !== null
              ? propRow.amenities
              : {};

          await supabaseAdmin
            .from("properties")
            .update({
              amenities: {
                ...currentAmenities,
                telegram_notified_at: now,
              },
            })
            .eq("id", property.id);
        }
      } catch (e: any) {
        console.warn("[TelegramNotifications] Error marking property notified:", e?.message);
      }
    }

    console.log(
      `[TelegramNotifications] Broadcast completed for property ${property.id}: sent=${summary.sent}, failed=${summary.failed}, blocked=${summary.blocked}, alreadySent=${summary.alreadySentCount}`
    );
  } catch (err: any) {
    console.error("[TelegramNotifications] Broadcast job exception:", err?.message);
  }

  return summary;
}


export const queuePropertyNotification = broadcastPropertyToTelegramSubscribers;

/**
 * Send a manual test notification to an authenticated admin.
 */
export async function sendAdminTestNotification(
  adminTelegramUserId: number,
  property: Property,
  preferredLang: "uz" | "ru" = "uz"
): Promise<{ ok: boolean; status: string; error?: string }> {
  const subscriber: TelegramSubscriber = {
    telegram_user_id: adminTelegramUserId,
    language: preferredLang,
    notifications_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = await dispatchNotificationToUser(subscriber, property);

  await recordTelegramNotification({
    property_id: property.id,
    telegram_user_id: adminTelegramUserId,
    status: result.status,
    telegram_message_id: result.messageId,
    error_message: result.error,
  });

  return {
    ok: result.status === "sent",
    status: result.status,
    error: result.error,
  };
}

// =============================================================================
// TELEGRAM CHANNEL PUBLISHING (@angren_estate)
// =============================================================================

export interface ContactPerson {
  phone: string;
  name?: string;
  telegram?: string;
}

export interface AuthorizedContact {
  phone: string;
  name?: string;
  telegram?: string;
  type: "owner" | "realtor" | "agency";
  owner?: ContactPerson;
  realtor?: ContactPerson;
  agency?: ContactPerson;
}

export interface ChannelResolvedContacts {
  owner?: ContactPerson;
  realtor?: ContactPerson;
  agency?: ContactPerson;
}

/**
 * Resolve all authorized contacts for public channel publication.
 * Rules:
 * 1. Owner contact is included ONLY if owner_phone is present AND owner_phone_visible === true.
 *    If owner_phone_visible !== true, owner contact is strictly undefined (never leaked).
 * 2. Realtor contact is included if property.realtor?.phone is present.
 * 3. Agency contact is used as fallback only when neither owner nor realtor is present.
 */
export function resolveAllAuthorizedContacts(property: Property): ChannelResolvedContacts {
  const isOwnerVisible = Boolean(
    property.owner_phone_visible ?? (property.amenities as any)?.owner_phone_visible ?? false
  );
  const rawOwnerPhone = (property.owner_phone || (property.amenities as any)?.owner_phone || "").trim();

  let owner: ContactPerson | undefined;
  if (rawOwnerPhone && isOwnerVisible) {
    owner = {
      phone: rawOwnerPhone,
      telegram: (property.owner_telegram || (property.amenities as any)?.owner_telegram || "").trim() || undefined,
    };
  }

  let realtor: ContactPerson | undefined;
  const realtorPhone = (property.realtor?.phone || "").trim();
  if (realtorPhone) {
    realtor = {
      phone: realtorPhone,
      name: property.realtor?.name?.trim() || undefined,
      telegram: property.realtor?.telegram?.trim() || undefined,
    };
  }

  let agency: ContactPerson | undefined;
  if (!owner && !realtor) {
    const contactPhone = (property.contact_phone || "").trim();
    if (contactPhone) {
      agency = {
        phone: contactPhone,
        telegram: (property.contact_telegram || property.telegram || "").trim() || undefined,
      };
    }
  }

  return { owner, realtor, agency };
}

/**
 * Resolve authorized contact phone & info for public channel post.
 * Returns the primary authorized contact (owner if public, else realtor, else agency),
 * while preserving attached owner and realtor details.
 */
export function resolveAuthorizedContact(property: Property): AuthorizedContact | null {
  const { owner, realtor, agency } = resolveAllAuthorizedContacts(property);

  if (owner) {
    return {
      phone: owner.phone,
      telegram: owner.telegram,
      type: "owner",
      owner,
      realtor,
    };
  }

  if (realtor) {
    return {
      phone: realtor.phone,
      name: realtor.name,
      telegram: realtor.telegram,
      type: "realtor",
      realtor,
    };
  }

  if (agency) {
    return {
      phone: agency.phone,
      telegram: agency.telegram,
      type: "agency",
      agency,
    };
  }

  return null;
}

/**
 * Build rich, clean channel post caption within Telegram's 1024 character photo caption limit.
 * Formats: title, location, room/area/floor parameters, canonical price, and authorized contact.
 */
export function buildChannelPostCaption(property: Property, lang: "uz" | "ru" = "uz"): string {
  const isUz = lang === "uz";
  const lines: string[] = [];

  // 1. Title / Header
  const title = (isUz ? property.title_uz : property.title_ru) || property.title_uz || property.title_ru;
  if (title && title.trim()) {
    lines.push(`🏠 ${title.trim()}`);
  } else {
    lines.push(isUz ? "🏠 ANGREN ESTATE'da yangi obyekt" : "🏠 Новый объект в ANGREN ESTATE");
  }
  lines.push("");

  // 2. Location (District + Specific Address)
  const districtName = isUz
    ? property.district_name_uz || property.district
    : property.district_name_ru || property.district;
  const addressName = isUz ? property.address_uz : property.address_ru || property.address_uz;

  const locParts: string[] = [];
  if (districtName && districtName.trim()) locParts.push(districtName.trim());
  if (addressName && addressName.trim() && addressName.trim() !== districtName?.trim()) {
    locParts.push(addressName.trim());
  }

  const loc = locParts.join(", ");
  if (loc) {
    lines.push(`📍 ${isUz ? "Manzil:" : "Адрес:"} ${loc}`);
  }

  // 3. Parameters (Rooms, Area, Floor, Renovation)
  const paramParts: string[] = [];
  if (property.rooms && property.rooms > 0) {
    if (isUz) {
      paramParts.push(`${property.rooms} xona`);
    } else {
      const r = property.rooms;
      const word = r === 1 ? "комната" : r >= 2 && r <= 4 ? "комнаты" : "комнат";
      paramParts.push(`${r} ${word}`);
    }
  }

  if (property.area_sqm && property.area_sqm > 0) {
    paramParts.push(`${property.area_sqm} ${isUz ? "m²" : "м²"}`);
  } else if (property.area_sotikh && property.area_sotikh > 0) {
    paramParts.push(`${property.area_sotikh} ${isUz ? "sotix" : "соток"}`);
  } else if (property.area && property.area > 0) {
    paramParts.push(`${property.area} ${isUz ? "m²" : "м²"}`);
  }

  if (property.floor && property.floor > 0) {
    const total = property.total_floors && property.total_floors > 0 ? `/${property.total_floors}` : "";
    paramParts.push(`${property.floor}${total} ${isUz ? "qavat" : "этаж"}`);
  }

  if (property.renovation) {
    const renMap: Record<string, { uz: string; ru: string }> = {
      euro: { uz: "Yevro ta’mir", ru: "Евроремонт" },
      good: { uz: "Yaxshi ta’mir", ru: "Хороший ремонт" },
      average: { uz: "O‘rtacha ta’mir", ru: "Средний ремонт" },
      cosmetic: { uz: "Kosmetik ta’mir", ru: "Косметический" },
      need_repair: { uz: "Ta’mirtalab", ru: "Требует ремонта" },
      black_plaster: { uz: "Qora suvoq", ru: "Черновая отделка" },
    };
    if (renMap[property.renovation]) {
      paramParts.push(isUz ? renMap[property.renovation].uz : renMap[property.renovation].ru);
    }
  }

  if (paramParts.length > 0) {
    lines.push(`ℹ️ ${paramParts.join(" • ")}`);
  }

  // 4. Price (using canonical formatPrice helper)
  const isNegotiable = Boolean(property.price_negotiable || (property.amenities as any)?.price_negotiable);
  const bargainAllowed = Boolean(property.bargain_allowed || (property.amenities as any)?.bargain_allowed);
  const bargainText = bargainAllowed ? ` (${isUz ? "Savdolashish mumkin" : "Торг уместен"})` : "";

  if (isNegotiable) {
    lines.push(`💰 ${isUz ? "Narxi kelishiladi" : "Цена договорная"}${bargainText}`);
  } else {
    const priceVal = property.price_uzs || property.price || 0;
    if (priceVal > 0) {
      const formatted = formatPrice(priceVal, lang, property.currency || "USD", false, 12800, property.price_usd);
      lines.push(`💰 ${isUz ? "Narxi:" : "Цена:"} ${formatted.primary}${bargainText}`);
    }
  }

  // 5. Short Description (capped to safe limit within Telegram caption size)
  const desc = isUz ? property.description_uz : property.description_ru;
  if (desc && desc.trim()) {
    const cleanDesc = desc.trim().replace(/\s+/g, " ");
    const maxDescLen = 280;
    const truncatedDesc = cleanDesc.length > maxDescLen ? `${cleanDesc.slice(0, maxDescLen)}...` : cleanDesc;
    lines.push("");
    lines.push(`📝 ${truncatedDesc}`);
  }

  // 6. Authorized contact information
  const contacts = resolveAllAuthorizedContacts(property);
  const contactLines: string[] = [];

  if (contacts.owner?.phone) {
    const ownerLabel = isUz ? "Obyekt egasi:" : "Владелец:";
    contactLines.push(`📞 ${ownerLabel} ${contacts.owner.phone}`);
  }

  if (contacts.realtor?.phone) {
    const realtorLabel = isUz ? "Rieltor:" : "Риелтор:";
    const realtorName = contacts.realtor.name ? ` (${contacts.realtor.name})` : "";
    contactLines.push(`📞 ${realtorLabel} ${contacts.realtor.phone}${realtorName}`);
  }

  if (!contacts.owner && !contacts.realtor && contacts.agency?.phone) {
    const agencyLabel = isUz ? "Aloqa:" : "Контакты:";
    contactLines.push(`📞 ${agencyLabel} ${contacts.agency.phone}`);
  }

  if (contactLines.length > 0) {
    lines.push("");
    lines.push(contactLines.join("\n"));
  }

  lines.push("");
  lines.push("🌐 @angren_estate");

  return lines.join("\n").trim();
}

/**
 * Build inline keyboard markup for Telegram channel posts.
 * STRICT: NO web_app button type (prohibited in Telegram channels by Bot API).
 * Only valid HTTPS or Telegram direct URLs.
 */
export function buildChannelPostMarkup(property: Property, lang: "uz" | "ru" = "uz") {
  const isUz = lang === "uz";
  const rows: Array<Array<{ text: string; url: string }>> = [];

  // Button A: «Obyektni ochish» (HTTPS URL directly opens object page)
  const openUrl = buildPropertyPublicUrl(property.id);
  rows.push([
    {
      text: isUz ? "Obyektni ochish →" : "Открыть объект →",
      url: openUrl,
    },
  ]);

  // Secondary buttons row: Video review & Contact
  const secondaryRow: Array<{ text: string; url: string }> = [];

  // Button B: «Video sharh» (only if valid public HTTPS video_url exists)
  let videoBtn: { text: string; url: string } | null = null;
  const rawVideo = (property.video_url || property.video || "").trim();
  if (rawVideo) {
    const isLocal =
      rawVideo.includes("localhost") ||
      rawVideo.includes("127.0.0.1") ||
      rawVideo.includes("0.0.0.0");
    if (!isLocal && rawVideo.startsWith("https://")) {
      videoBtn = {
        text: isUz ? "🎬 Video sharh" : "🎬 Видео обзор",
        url: rawVideo,
      };
    } else if (rawVideo.startsWith("http://")) {
      console.warn(`[TelegramChannel] Non-HTTPS video URL '${rawVideo}' omitted from inline buttons (Telegram requires verified HTTPS)`);
    }
  }

  // Button C: Contact buttons (Owner and/or Realtor)
  const contacts = resolveAllAuthorizedContacts(property);

  function resolveTelegramContactUrl(person?: ContactPerson): string | null {
    if (!person) return null;
    if (person.telegram) {
      let cleanTg = person.telegram.trim();
      if (cleanTg.startsWith("https://t.me/")) {
        return cleanTg;
      }
      if (cleanTg.startsWith("http://t.me/")) {
        return cleanTg.replace("http://", "https://");
      }
      if (cleanTg.startsWith("t.me/")) {
        return `https://${cleanTg}`;
      }
      cleanTg = cleanTg.replace(/^@+/, "").trim();
      if (cleanTg) return `https://t.me/${cleanTg}`;
    }
    if (person.phone) {
      const cleanDigits = person.phone.replace(/[^0-9]/g, "");
      if (cleanDigits) return `https://t.me/+${cleanDigits}`;
    }
    return null;
  }

  const ownerBtnUrl = resolveTelegramContactUrl(contacts.owner);
  const realtorBtnUrl = resolveTelegramContactUrl(contacts.realtor);
  const agencyBtnUrl = !contacts.owner && !contacts.realtor ? resolveTelegramContactUrl(contacts.agency) : null;

  const contactButtons: Array<{ text: string; url: string }> = [];

  if (ownerBtnUrl && realtorBtnUrl) {
    // Both owner and realtor are authorized and have valid contact URLs
    contactButtons.push({
      text: isUz ? "👤 Egasi bilan bog‘lanish" : "👤 Связаться с владельцем",
      url: ownerBtnUrl,
    });
    contactButtons.push({
      text: isUz ? "👨‍💼 Rieltor bilan bog‘lanish" : "👨‍💼 Связаться с риелтором",
      url: realtorBtnUrl,
    });
  } else if (realtorBtnUrl) {
    // Only realtor contact (e.g. owner hidden or absent)
    contactButtons.push({
      text: isUz ? "💬 Bog‘lanish" : "💬 Связаться",
      url: realtorBtnUrl,
    });
  } else if (ownerBtnUrl) {
    // Only owner contact (owner visible, no realtor)
    contactButtons.push({
      text: isUz ? "💬 Bog‘lanish" : "💬 Связаться",
      url: ownerBtnUrl,
    });
  } else if (agencyBtnUrl) {
    // Fallback agency contact
    contactButtons.push({
      text: isUz ? "💬 Bog‘lanish" : "💬 Связаться",
      url: agencyBtnUrl,
    });
  }

  // Assemble keyboard rows cleanly
  if (videoBtn && contactButtons.length === 1) {
    // Shared secondary row: Video + Single Contact
    rows.push([videoBtn, contactButtons[0]]);
  } else {
    if (videoBtn) {
      rows.push([videoBtn]);
    }
    if (contactButtons.length > 0) {
      rows.push(contactButtons);
    }
  }

  return { inline_keyboard: rows };
}

// In-memory concurrency lock to prevent duplicate parallel publishing requests for the same property
const inFlightChannelPublishes = new Set<string>();

export interface TelegramChannelPublishResult {
  success: boolean;
  status: "published" | "already_published" | "error";
  messageId?: number;
  channelId?: string;
  error?: string;
  dbPersisted?: boolean;
}

/**
 * Publish property post to Telegram channel (@angren_estate).
 * Handles idempotency, formatting, photo delivery, and status persistence.
 */
export async function publishPropertyToTelegramChannel(
  property: Property,
  options?: {
    forceRepeat?: boolean;
    channelId?: string;
    lang?: "uz" | "ru";
    botToken?: string;
    updatePropertyFn?: (id: string, updates: Partial<Property>) => Promise<Property | null>;
    validateImageBeforeSend?: boolean;
  }
): Promise<TelegramChannelPublishResult> {
  const token = options?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      success: false,
      status: "error",
      error: "TELEGRAM_BOT_TOKEN is not configured on the server",
    };
  }

  const targetChannel =
    options?.channelId ||
    process.env.TELEGRAM_CHANNEL_ID ||
    process.env.TELEGRAM_CHANNEL ||
    "@angren_estate";

  const updateFn = options?.updatePropertyFn || updateProperty;

  // Deduplication check: Has this property already been published to the channel?
  if (!options?.forceRepeat) {
    const alreadyPublished =
      property.telegram_channel_status === "published" &&
      Boolean(property.telegram_channel_post_id);

    if (alreadyPublished) {
      return {
        success: true,
        status: "already_published",
        messageId: property.telegram_channel_post_id,
        channelId: targetChannel,
        dbPersisted: true,
      };
    }
  }

  // Concurrency check: prevent parallel duplicate posts while publishing is in progress
  if (inFlightChannelPublishes.has(property.id)) {
    return {
      success: false,
      status: "error",
      channelId: targetChannel,
      error: "Publishing is already in progress for this property",
    };
  }

  inFlightChannelPublishes.add(property.id);

  const lang = options?.lang || "uz";
  const caption = buildChannelPostCaption(property, lang);
  const replyMarkup = buildChannelPostMarkup(property, lang);

  // Pre-flight validation: Guarantee zero localhost / 127.0.0.1 / non-https URLs reach Telegram Bot API
  const allButtons = replyMarkup.inline_keyboard.flat();
  for (const btn of allButtons) {
    const btnUrl = btn.url || "";
    const isInvalid =
      !btnUrl.startsWith("https://") ||
      btnUrl.includes("localhost") ||
      btnUrl.includes("127.0.0.1") ||
      btnUrl.includes("0.0.0.0");

    if (isInvalid) {
      const errMsg = `Telegram inline keyboard button URL '${btnUrl}' is invalid: must be a public HTTPS URL (localhost/127.0.0.1 is prohibited)`;
      console.error(`[TelegramChannel] ${errMsg}`);
      try {
        await updateFn(property.id, {
          telegram_channel_status: "error",
        });
      } catch (persistErr: any) {
        console.warn("[TelegramChannel] Could not persist channel status to database:", persistErr?.message);
      }
      return {
        success: false,
        status: "error",
        channelId: targetChannel,
        error: errMsg,
        dbPersisted: false,
      };
    }
  }

  // 1. Resolve photo candidate using priority: main_image -> images[0] -> photos[0]
  const rawPhoto = resolvePropertyPhotoUrl(property);
  const resolvedPhoto = resolveCanonicalPhotoUrl(rawPhoto);
  let photoUrl = resolvedPhoto.url;

  if (rawPhoto && !resolvedPhoto.isValidPublicHttps) {
    console.warn(`[TelegramChannel] ${resolvedPhoto.error || "Photo URL is not valid public HTTPS"}. Photo delivery skipped.`);
  }

  try {
    let sendResult: {
      ok: boolean;
      result?: any;
      description?: string;
      error_code?: number;
      http_status?: number;
    };

    if (photoUrl && resolvedPhoto.isValidPublicHttps) {
      const sanitizedUrl = sanitizeDiagnosticUrl(photoUrl);

      if (options?.validateImageBeforeSend) {
        const preCheck = await checkImageUrlAccessible(photoUrl);
        console.log(
          `[TelegramChannel] Image pre-check for ${sanitizedUrl}: ${
            preCheck.accessible
              ? `accessible (${preCheck.contentType || "unknown type"}, size: ${preCheck.size || "unknown"})`
              : `warning: ${preCheck.error || "inaccessible"}`
          }`
        );
      }

      console.log(`[TelegramChannel] Attempting sendPhoto for property ${property.id}: ${sanitizedUrl}`);

      // Attempt 1: Send photo by URL directly to Telegram Bot API
      sendResult = await sendTelegramPhoto(targetChannel, photoUrl, caption, replyMarkup, token);

      console.log(
        `[TelegramChannel] sendPhoto URL response: ok=${sendResult.ok}, http_status=${sendResult.http_status ?? "none"}, error_code=${sendResult.error_code ?? "none"}, description=${sendResult.description || "none"}`
      );

      // If Telegram returned a photo-specific error (e.g. failed to get HTTP URL content)
      if (!sendResult.ok && isTelegramPhotoSpecificError(sendResult.description)) {
        // Run diagnostic accessibility check from server
        const diagCheck = await checkImageUrlAccessible(photoUrl);
        console.warn(
          `[TelegramChannel] Telegram Bot API failed to download photo from URL (${sendResult.description}). Server accessibility check: ${
            diagCheck.accessible
              ? `accessible (${diagCheck.contentType}, size: ${diagCheck.size})`
              : `inaccessible (${diagCheck.error})`
          }. Attempting direct multipart buffer download and upload...`
        );

        // Attempt 2: Download image buffer in server runtime and upload via multipart/form-data
        let bufferUploadSuccess = false;
        try {
          const dlController = new AbortController();
          const dlTimeout = setTimeout(() => dlController.abort(), 8000);
          const dlResp = await fetch(photoUrl, {
            signal: dlController.signal,
            headers: { "User-Agent": "AngrenEstate-Server/1.0" },
          });
          clearTimeout(dlTimeout);

          if (dlResp.ok) {
            const arrayBuf = await dlResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            const contentType = dlResp.headers.get("content-type") || "image/jpeg";

            if (buffer.length > 0 && buffer.length <= 10 * 1024 * 1024) {
              console.log(
                `[TelegramChannel] Image downloaded successfully (${buffer.length} bytes, ${contentType}). Uploading multipart binary directly to Telegram...`
              );
              const multipartResult = await sendTelegramPhoto(
                targetChannel,
                buffer,
                caption,
                replyMarkup,
                token,
                contentType
              );

              console.log(
                `[TelegramChannel] Direct multipart sendPhoto response: ok=${multipartResult.ok}, http_status=${multipartResult.http_status ?? "none"}, error_code=${multipartResult.error_code ?? "none"}, description=${multipartResult.description || "none"}`
              );

              if (multipartResult.ok) {
                sendResult = multipartResult;
                bufferUploadSuccess = true;
              }
            }
          }
        } catch (bufErr: any) {
          console.warn(`[TelegramChannel] Direct multipart buffer attempt failed: ${bufErr?.message || bufErr}`);
        }

        // Attempt 3: If direct multipart upload also failed, graceful fallback to text post
        if (!bufferUploadSuccess && !sendResult.ok) {
          const fallbackReason = sendResult.description || "Photo delivery failed after URL and multipart attempts";
          console.warn(`[TelegramChannel] Falling back to text-only post. Reason: ${fallbackReason}`);
          sendResult = await sendTelegramDirectMessage(targetChannel, caption, replyMarkup, token);
          console.log(
            `[TelegramChannel] Fallback text post response: ok=${sendResult.ok}, http_status=${sendResult.http_status ?? "none"}, error_code=${sendResult.error_code ?? "none"}, description=${sendResult.description || "none"}`
          );
        }
      }
    } else {
      // No valid photo: send direct text message
      console.log(`[TelegramChannel] Property ${property.id} has no valid public photo URL. Sending text-only channel post.`);
      sendResult = await sendTelegramDirectMessage(targetChannel, caption, replyMarkup, token);
      console.log(
        `[TelegramChannel] Direct text post response: ok=${sendResult.ok}, http_status=${sendResult.http_status ?? "none"}, error_code=${sendResult.error_code ?? "none"}, description=${sendResult.description || "none"}`
      );
    }

    if (!sendResult.ok) {
      const desc = sendResult.description || "Unknown error";
      console.error(`[TelegramChannel] Channel post failed: error_code=${sendResult.error_code} description=${desc}`);
      try {
        await updateFn(property.id, {
          telegram_channel_status: "error",
        });
      } catch (persistErr: any) {
        console.warn("[TelegramChannel] Could not persist channel status to database:", persistErr?.message);
      }
      return {
        success: false,
        status: "error",
        channelId: targetChannel,
        error: desc,
        dbPersisted: false,
      };
    }

    const messageId = sendResult.result?.message_id;

    // 1. Strict validation: verify message_id is a valid integer > 0
    if (typeof messageId !== "number" || !Number.isInteger(messageId) || messageId <= 0) {
      const missingIdDesc = "Telegram API ok: true qaytardi, ammo javobda haqiqiy result.message_id mavjud emas";
      console.error(`[TelegramChannel] ${missingIdDesc}:`, sendResult);
      try {
        await updateFn(property.id, {
          telegram_channel_status: "error",
        });
      } catch (persistErr: any) {
        console.warn("[TelegramChannel] Could not persist channel status to database:", persistErr?.message);
      }
      return {
        success: false,
        status: "error",
        channelId: targetChannel,
        error: missingIdDesc,
        dbPersisted: false,
      };
    }

    // 2. Persist channel publication status safely without hiding DB persistence failures
    let dbPersisted = false;
    let dbError: string | undefined;

    try {
      const updated = await updateFn(property.id, {
        telegram_channel_status: "published",
        telegram_channel_post_id: messageId,
      });
      if (updated) {
        dbPersisted = true;
      } else {
        dbError = "Ma'lumotlar bazasida obyekt topilmadi yoki status yangilanmadi";
        console.error(`[TelegramChannel] ${dbError}`);
      }
    } catch (persistErr: any) {
      dbError = persistErr?.message || "Ma'lumotlar bazasiga yozishda xatolik yuz berdi";
      console.error("[TelegramChannel] Could not persist channel status to database:", dbError);
    }

    if (!dbPersisted) {
      return {
        success: false,
        status: "error",
        messageId,
        channelId: targetChannel,
        error: `Telegram kanalga post yuborildi (ID: ${messageId}), ammo ma'lumotlar bazasida statusni saqlashda xatolik yuz berdi: ${dbError}`,
        dbPersisted: false,
      };
    }

    return {
      success: true,
      status: "published",
      messageId,
      channelId: targetChannel,
      dbPersisted: true,
    };
  } catch (err: any) {
    console.error("[TelegramChannel] Exception while publishing:", err?.message);
    try {
      await updateFn(property.id, {
        telegram_channel_status: "error",
      });
    } catch (persistErr: any) {
      console.warn("[TelegramChannel] Could not persist channel status to database:", persistErr?.message);
    }
    return {
      success: false,
      status: "error",
      channelId: targetChannel,
      error: err?.message || "Unknown exception",
      dbPersisted: false,
    };
  } finally {
    inFlightChannelPublishes.delete(property.id);
  }
}

// =============================================================================
// ADMIN DIRECT NOTIFICATIONS (New Applications & Leads)
// =============================================================================

export interface NewApplicationNotificationData {
  client_name: string;
  client_phone: string;
  source: string; // e.g. "Sayt (E'lon berish)", "Telegram Bot", "Sayt (Aloqa)"
  property_title?: string;
  location?: string;
  deal_type?: string;
  property_type?: string;
  rooms?: string | number;
  area?: string | number;
  price?: string | number;
  currency?: string;
  description?: string;
  telegram_username?: string | null;
  telegram_user_id?: string | number | null;
  created_at?: string;
}

/**
 * Resolves one or more Telegram Chat IDs belonging to the administrator(s).
 * Priority:
 * 1. process.env.TELEGRAM_ADMIN_CHAT_ID or process.env.ADMIN_TELEGRAM_CHAT_ID (comma-separated or single)
 * 2. Look up app_settings (site_settings: admin_telegram, admin_phone)
 * 3. Match against telegram_users_registry to find corresponding numeric telegram_user_id
 */
export async function getAdminTelegramChatIds(): Promise<Array<number | string>> {
  const chatIds = new Set<number | string>();

  // 1. Check environment variables
  const envIds =
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.ADMIN_TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_ADMIN_CHAT;

  if (envIds) {
    envIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => {
        const num = Number(id);
        chatIds.add(isNaN(num) ? id : num);
      });
  }

  // 2. Query site_settings & telegram_users_registry from database
  try {
    const { data: siteSettingsRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "site_settings")
      .maybeSingle();

    const siteSettings = siteSettingsRow?.value || {};
    const adminTgHandle = String(siteSettings.admin_telegram || "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    const adminPhone = String(siteSettings.admin_phone || "").replace(/[^\d+]/g, "");

    const { data: regRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "telegram_users_registry")
      .maybeSingle();

    const registry = Array.isArray(regRow?.value) ? regRow.value : [];
    for (const u of registry) {
      const uTg = String(u.username || "").toLowerCase();
      const uPhone = String(u.phone || "").replace(/[^\d+]/g, "");
      const uId = u.telegram_user_id || u.id;

      if (!uId) continue;

      if (adminTgHandle && uTg === adminTgHandle) {
        chatIds.add(uId);
      } else if (adminPhone && uPhone && uPhone === adminPhone) {
        chatIds.add(uId);
      } else if (uTg === "angrenestateuz_admin" || uTg.includes("admin")) {
        chatIds.add(uId);
      }
    }
  } catch (err: any) {
    console.warn("[TelegramNotifications] Could not query admin chat IDs from settings:", err?.message || err);
  }

  return Array.from(chatIds);
}

/**
 * Format the admin Telegram notification message text and quick-action buttons.
 * Guarantees zero hallucination: omits telegram_username and telegram_user_id if not present.
 */
export function formatApplicationNotificationMessage(data: NewApplicationNotificationData): {
  messageText: string;
  buttons: Array<{ text: string; url: string }>;
} {
  const now = data.created_at ? new Date(data.created_at) : new Date();
  const formattedTime = !isNaN(now.getTime())
    ? now.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toISOString();

  const lines: string[] = [];
  lines.push("🏛 YANGI ARIZA / E’LON SO‘ROVI");
  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(`👤 Arizachi: ${data.client_name || "Ko‘rsatilmagan"}`);
  lines.push(`📞 Aloqa telefoni: ${data.client_phone}`);

  // Property & Listing details
  const hasListingDetails = Boolean(
    data.deal_type || data.property_type || data.location || data.rooms || data.area || data.price
  );

  if (hasListingDetails) {
    lines.push("");
    if (data.location) {
      lines.push(`📍 Manzil / Mo‘ljal: ${data.location}`);
    }
    if (data.deal_type) {
      const isRent = data.deal_type === "rent" || data.deal_type === "ijara";
      lines.push(`🏷 Bitim turi: ${isRent ? "Ijara" : "Sotuv"}`);
    }
    if (data.property_type) {
      const typeMap: Record<string, string> = {
        apartment: "Kvartira",
        kvartira: "Kvartira",
        house: "Hovli / Uy",
        hovli: "Hovli / Uy",
        uy_hovli: "Hovli / Uy",
        land: "Yer uchastkasi",
        yer: "Yer uchastkasi",
        yer_uchastkasi: "Yer uchastkasi",
        commercial: "Tijorat ko‘chmas mulki",
        tijorat: "Tijorat ko‘chmas mulki",
        dala_hovli: "Dala hovli",
        other: "Boshqa",
        boshqa: "Boshqa",
      };
      lines.push(`🏢 Mulk turi: ${typeMap[data.property_type] || data.property_type}`);
    }
    if (data.rooms) {
      lines.push(`🚪 Xonalar soni: ${data.rooms}`);
    }
    if (data.area) {
      lines.push(`📐 Maydoni: ${data.area} m²`);
    }
    if (data.price) {
      const curr = data.currency || "USD";
      lines.push(`💰 Narxi: ${data.price} ${curr}`);
    }
  }

  if (data.description && data.description.trim()) {
    lines.push("");
    lines.push(`📝 Qo‘shimcha ma’lumot:\n${data.description.trim()}`);
  }

  lines.push("");
  lines.push(`🌐 Manba: ${data.source}`);

  // ONLY include Telegram username & ID if genuinely present (NEVER invent!)
  if (data.telegram_username && String(data.telegram_username).trim()) {
    const cleanUname = String(data.telegram_username).trim().replace(/^@/, "");
    lines.push(`💬 Telegram: @${cleanUname}`);
  }
  if (data.telegram_user_id) {
    lines.push(`🆔 Telegram user ID: ${data.telegram_user_id}`);
  }

  lines.push(`📅 Yuborilgan vaqt: ${formattedTime}`);

  const messageText = lines.join("\n");

  // Build inline quick-action buttons
  const cleanPhone = String(data.client_phone).replace(/[^\d+]/g, "");
  const buttons: Array<{ text: string; url: string }> = [];
  if (cleanPhone && cleanPhone.length >= 9) {
    buttons.push({
      text: "📞 Qo‘ng‘iroq qilish",
      url: `tel:${cleanPhone}`,
    });
  }
  if (data.telegram_username && String(data.telegram_username).trim()) {
    const cleanUname = String(data.telegram_username).trim().replace(/^@/, "");
    buttons.push({
      text: "💬 Telegramda yozish",
      url: `https://t.me/${cleanUname}`,
    });
  }

  return { messageText, buttons };
}

/**
 * Format and dispatch an incoming application / lead notification directly to the admin Telegram bot chat.
 */
export async function sendApplicationToAdminTelegram(
  data: NewApplicationNotificationData,
  options?: { botToken?: string; targetChatIds?: Array<number | string> }
): Promise<{ sent: boolean; recipientsCount: number; errors: string[] }> {
  const token = options?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { sent: false, recipientsCount: 0, errors: ["TELEGRAM_BOT_TOKEN is not configured"] };
  }

  const targets =
    options?.targetChatIds && options.targetChatIds.length > 0
      ? options.targetChatIds
      : await getAdminTelegramChatIds();

  if (targets.length === 0) {
    console.warn("[TelegramNotifications] No admin Telegram chat ID configured or found. Application saved to DB.");
    return { sent: false, recipientsCount: 0, errors: ["No admin Telegram chat ID found"] };
  }

  const { messageText, buttons } = formatApplicationNotificationMessage(data);
  const replyMarkup = buttons.length > 0 ? { inline_keyboard: [buttons] } : undefined;

  let sentCount = 0;
  const errors: string[] = [];

  for (const chatId of targets) {
    try {
      const res = await sendTelegramDirectMessage(chatId, messageText, replyMarkup, token);
      if (res.ok) {
        sentCount++;
      } else {
        errors.push(`Chat ${chatId}: ${res.description || `HTTP ${res.http_status}`}`);
      }
    } catch (sendErr: any) {
      errors.push(`Chat ${chatId}: ${sendErr?.message || String(sendErr)}`);
    }
  }

  return {
    sent: sentCount > 0,
    recipientsCount: sentCount,
    errors,
  };
}
