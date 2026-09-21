import { Property, TelegramSubscriber } from "./types";
import { formatPrice } from "./currency";
import {
  getEligibleNotificationSubscribers,
  hasNotificationBeenSent,
  recordTelegramNotification,
  setTelegramUserNotifications,
  sendTelegramPhoto,
  sendTelegramDirectMessage,
} from "./telegramServer";
import { supabaseAdmin } from "./supabaseServer";
import { isSupabaseConfigured } from "./supabase";

const SITE_URL = "https://angrenestate.uz";

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
  const priceVal = property.price_uzs || property.price || 0;
  if (priceVal > 0) {
    const formatted = formatPrice(priceVal, lang, property.currency || "USD");
    lines.push(`💰 ${formatted.primary}`);
  }

  return lines.join("\n");
}

/**
 * Build inline keyboard with Mini App deep-link and notification mute button.
 */
export function buildPropertyNotificationMarkup(propertyId: string, lang: "uz" | "ru" = "uz") {
  const isUz = lang === "uz";
  const openUrl = `${SITE_URL}/properties/${propertyId}?lang=${lang}`;

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
      [
        {
          text: isUz ? "🔕 Bildirishnomalarni o‘chirish" : "🔕 Отключить уведомления",
          callback_data: "mute_notif",
        },
      ],
    ],
  };
}

/**
 * Send notification to a single subscriber.
 * Automatically tries sendPhoto if property has an image, with fallback to sendMessage.
 * Handles blocked/deactivated users by updating notifications_enabled = false.
 */
export async function dispatchNotificationToUser(
  user: TelegramSubscriber,
  property: Property
): Promise<{ status: "sent" | "failed" | "blocked"; messageId?: number; error?: string }> {
  const lang = user.language === "ru" ? "ru" : "uz";
  const caption = buildPropertyNotificationText(property, lang);
  const replyMarkup = buildPropertyNotificationMarkup(property.id, lang);
  const photoUrl = property.main_image || property.photos?.[0] || property.images?.[0];

  let res: { ok: boolean; result?: any; description?: string; error_code?: number };

  // Try sending photo if available
  if (photoUrl && (photoUrl.startsWith("http://") || photoUrl.startsWith("https://"))) {
    res = await sendTelegramPhoto(user.telegram_user_id, photoUrl, caption, replyMarkup);
    // If photo failed due to image download/size, fallback to direct message
    if (!res.ok && res.error_code !== 403 && res.error_code !== 400) {
      res = await sendTelegramDirectMessage(user.telegram_user_id, caption, replyMarkup);
    }
  } else {
    res = await sendTelegramDirectMessage(user.telegram_user_id, caption, replyMarkup);
  }

  if (res.ok) {
    return { status: "sent", messageId: res.result?.message_id };
  }

  const desc = res.description || "Unknown error";
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
 * Queue and dispatch notifications for a newly published property.
 * Non-blocking background execution.
 * Guaranteed idempotency:
 * - Checks `first_published_at` / not already notified.
 * - Checks `(property_id, telegram_user_id)` unique constraint before sending.
 */
export async function queuePropertyNotification(property: Property): Promise<void> {
  // Execute in non-blocking background queue
  setImmediate(async () => {
    try {
      const now = new Date().toISOString();

      // 1. Mark property as notified in Supabase and local cache
      if (isSupabaseConfigured) {
        try {
          await supabaseAdmin
            .from("properties")
            .update({
              telegram_notified_at: now,
              first_published_at: property.first_published_at || now,
            })
            .eq("id", property.id);
        } catch (e: any) {
          console.warn("[TelegramNotifications] Error marking property notified:", e?.message);
        }
      }

      // 2. Fetch all active subscribers
      const subscribers = await getEligibleNotificationSubscribers();
      if (!subscribers || subscribers.length === 0) {
        console.log(`[TelegramNotifications] No active subscribers for property ${property.id}`);
        return;
      }

      console.log(
        `[TelegramNotifications] Starting broadcast for property ${property.id} to ${subscribers.length} subscriber(s)`
      );

      // 3. Process subscribers in rate-limited batches (25/sec limit)
      for (const sub of subscribers) {
        try {
          // Idempotency check: has this user already been notified for this property?
          const alreadySent = await hasNotificationBeenSent(property.id, sub.telegram_user_id);
          if (alreadySent) {
            continue;
          }

          const result = await dispatchNotificationToUser(sub, property);
          await recordTelegramNotification({
            property_id: property.id,
            telegram_user_id: sub.telegram_user_id,
            status: result.status,
            telegram_message_id: result.messageId,
            error_message: result.error,
          });

          // 40ms pause between sends = max 25 req/sec (Telegram limit is 30/sec)
          await sleep(40);
        } catch (subErr: any) {
          console.error(
            `[TelegramNotifications] Error sending to user ${sub.telegram_user_id}:`,
            subErr?.message
          );
        }
      }

      console.log(`[TelegramNotifications] Broadcast completed for property ${property.id}`);
    } catch (err: any) {
      console.error("[TelegramNotifications] Broadcast job exception:", err?.message);
    }
  });
}

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
