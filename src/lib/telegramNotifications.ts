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
          text: isUz ? "Obyektni ko‘rish →" : "Открыть объект →",
          web_app: {
            url: openUrl,
          },
        },
      ],
    ],
  };
}

/**
 * Send notification to a single subscriber.
 * Strictly text-only message (NO photo, NO storage downloads).
 * Handles blocked/deactivated users by updating notifications_enabled = false.
 */
export async function dispatchNotificationToUser(
  user: TelegramSubscriber,
  property: Property
): Promise<{ status: "sent" | "failed" | "blocked"; messageId?: number; error?: string }> {
  const lang = user.language === "ru" ? "ru" : "uz";
  const text = buildPropertyNotificationText(property, lang);
  const replyMarkup = buildPropertyNotificationMarkup(property.id, lang);

  // Pure text message delivery
  const res = await sendTelegramDirectMessage(user.telegram_user_id, text, replyMarkup);

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

export interface AuthorizedContact {
  phone: string;
  name?: string;
  telegram?: string;
  type: "owner" | "realtor" | "agency";
}

/**
 * Resolve authorized contact phone & info for public channel post.
 * Strict rules:
 * 1. If owner_phone is present AND owner_phone_visible === true -> use owner phone.
 * 2. If owner phone is absent or not permitted to be public -> fallback to realtor.
 * 3. Realtor info taken only from verified data (property.realtor?.phone or contact_phone).
 * 4. Hidden or non-public numbers are NEVER returned.
 */
export function resolveAuthorizedContact(property: Property): AuthorizedContact | null {
  // Rule 1: Check owner phone (STRICT: only if explicitly visible to public)
  const ownerPhone = (property.owner_phone || (property.amenities as any)?.owner_phone || "").trim();
  const isOwnerVisible = Boolean(
    property.owner_phone_visible ?? (property.amenities as any)?.owner_phone_visible ?? false
  );

  if (ownerPhone && isOwnerVisible) {
    return {
      phone: ownerPhone,
      type: "owner",
    };
  }

  // Rule 2 & 3: Fallback to realtor if assigned
  const realtorPhone = (property.realtor?.phone || "").trim();
  if (realtorPhone) {
    return {
      phone: realtorPhone,
      name: property.realtor?.name?.trim() || undefined,
      telegram: property.realtor?.telegram?.trim() || undefined,
      type: "realtor",
    };
  }

  // Fallback: Assigned contact_phone
  const contactPhone = (property.contact_phone || "").trim();
  if (contactPhone) {
    return {
      phone: contactPhone,
      telegram: (property.contact_telegram || property.telegram || "").trim() || undefined,
      type: "agency",
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
  const contact = resolveAuthorizedContact(property);
  if (contact?.phone) {
    lines.push("");
    lines.push(`📞 ${isUz ? "Aloqa:" : "Контакты:"} ${contact.phone}${contact.name ? ` (${contact.name})` : ""}`);
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

  // Button A: «Obyektni ko‘rish» (HTTPS URL directly opens object page)
  const openUrl = buildPropertyPublicUrl(property.id);
  rows.push([
    {
      text: isUz ? "Obyektni ko‘rish →" : "Посмотреть объект →",
      url: openUrl,
    },
  ]);

  // Secondary buttons row: Video review & Contact
  const secondaryRow: Array<{ text: string; url: string }> = [];

  // Button B: «Video sharh» (only if valid public HTTPS video_url exists)
  const rawVideo = (property.video_url || property.video || "").trim();
  if (rawVideo) {
    const isLocal =
      rawVideo.includes("localhost") ||
      rawVideo.includes("127.0.0.1") ||
      rawVideo.includes("0.0.0.0");
    if (!isLocal && rawVideo.startsWith("https://")) {
      secondaryRow.push({
        text: isUz ? "🎬 Video sharh" : "🎬 Видео обзор",
        url: rawVideo,
      });
    } else if (rawVideo.startsWith("http://")) {
      console.warn(`[TelegramChannel] Non-HTTPS video URL '${rawVideo}' omitted from inline buttons (Telegram requires verified HTTPS)`);
    }
  }

  // Button C: «Bog‘lanish» (only if authorized contact exists)
  const contact = resolveAuthorizedContact(property);
  if (contact) {
    let contactUrl: string | null = null;
    if (contact.telegram) {
      const cleanTg = contact.telegram.replace(/^@+/, "").trim();
      if (cleanTg) contactUrl = `https://t.me/${cleanTg}`;
    }
    if (!contactUrl && contact.phone) {
      const cleanDigits = contact.phone.replace(/[^0-9]/g, "");
      if (cleanDigits) contactUrl = `https://t.me/+${cleanDigits}`;
    }

    if (contactUrl && contactUrl.startsWith("https://t.me/")) {
      secondaryRow.push({
        text: isUz ? "💬 Bog‘lanish" : "💬 Связаться",
        url: contactUrl,
      });
    }
  }

  if (secondaryRow.length > 0) {
    rows.push(secondaryRow);
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

  // Select primary photo
  let photoUrl = property.main_image || property.images?.[0] || property.photos?.[0] || "";
  if (photoUrl && photoUrl.startsWith("/")) {
    const siteUrl = getTelegramPublicSiteUrl();
    photoUrl = `${siteUrl}${photoUrl}`;
  }
  // Telegram cannot fetch photos from localhost / 127.0.0.1
  if (photoUrl && (photoUrl.includes("localhost") || photoUrl.includes("127.0.0.1") || photoUrl.includes("0.0.0.0"))) {
    console.warn(`[TelegramChannel] Local photo URL '${photoUrl}' rejected for Telegram delivery, sending text post instead`);
    photoUrl = "";
  }

  try {
    let sendResult: { ok: boolean; result?: any; description?: string; error_code?: number };

    // Send photo if valid HTTP URL exists
    if (photoUrl && (photoUrl.startsWith("http://") || photoUrl.startsWith("https://"))) {
      sendResult = await sendTelegramPhoto(targetChannel, photoUrl, caption, replyMarkup, token);

      // Graceful fallback to direct text message if photo fetching fails on Telegram's side
      const descLower = sendResult.description ? sendResult.description.toLowerCase() : "";
      const isPhotoError =
        Boolean(descLower) &&
        (descLower.includes("photo") ||
          descLower.includes("url content") ||
          descLower.includes("image") ||
          descLower.includes("failed to get http"));

      if (!sendResult.ok && isPhotoError) {
        console.warn("[TelegramChannel] Photo delivery failed, falling back to text post:", sendResult.description);
        sendResult = await sendTelegramDirectMessage(targetChannel, caption, replyMarkup, token);
      }
    } else {
      // No photo: send direct text message
      sendResult = await sendTelegramDirectMessage(targetChannel, caption, replyMarkup, token);
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
