import { Property, TelegramSubscriber } from "./types";
import { formatPrice } from "./currency";
import {
  getEligibleNotificationSubscribers,
  hasNotificationBeenSent,
  recordTelegramNotification,
  setTelegramUserNotifications,
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
    const formatted = formatPrice(priceVal, lang, property.currency || "USD", false, 12800, property.price_usd);
    lines.push(`💰 ${formatted.primary}`);
  }

  return lines.join("\n");
}

/**
 * Build inline keyboard with Mini App deep-link to the exact property.
 * Strictly single button as specified: [Открыть объект →] / [Obyektni ko‘rish →].
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
