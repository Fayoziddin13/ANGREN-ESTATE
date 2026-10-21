/**
 * ANGREN ESTATE — News Telegram Publisher
 * Manages publishing curated bilingual news posts to Telegram Channel (@angren_estate)
 * and broadcasting to subscribed Bot users.
 */

import {
  getNewsById,
  updateNewsStatus,
  recordNewsPublication,
} from "./newsStore";
import {
  generateAndSaveNewsAsset,
  getNewsCardSvgBuffer,
  getNewsCardImageBuffer,
  isRasterAssetValid,
  isValidImageBuffer,
} from "./newsVisualGenerator";
import {
  sendTelegramPhoto,
  sendTelegramDirectMessage,
  getEligibleNotificationSubscribers,
} from "./telegramServer";
import { getTelegramPublicSiteUrl } from "./telegramNotifications";
import type { RealEstateNews } from "./types/news";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Concurrency lock to prevent duplicate parallel publishing requests for the same news
const inFlightNewsPublishes = new Set<string>();
const inFlightBotPublishes = new Set<string>();

/**
 * Build rich channel/bot post caption within Telegram's 1024 character photo caption limit.
 */
export function buildNewsPostCaption(news: RealEstateNews, lang: "uz" | "ru" = "uz"): string {
  const isUz = lang === "uz";
  const trans = isUz ? news.translations?.uz : news.translations?.ru;
  const title = (trans?.title || news.original_title).trim();
  const summary = (trans?.summary || "").trim();
  const takeaway = (trans?.practical_takeaway || "").trim();
  const sourceName = (news.source?.name || news.original_url.split("/")[2] || "Rasmiy manba").trim();

  const lines: string[] = [];

  // 1. Brand Header
  lines.push(isUz ? "🏛 ANGREN ESTATE | Yangiliklar" : "🏛 ANGREN ESTATE | Новости");
  lines.push("");

  // 2. Title
  lines.push(`📌 ${title}`);
  lines.push("");

  // 3. Summary (capped to safe limit)
  if (summary) {
    const cleanSummary = summary.replace(/\s+/g, " ");
    const maxSummaryLen = 350;
    const truncated =
      cleanSummary.length > maxSummaryLen ? `${cleanSummary.slice(0, maxSummaryLen)}...` : cleanSummary;
    lines.push(truncated);
  }

  // 4. Practical Takeaway
  if (takeaway) {
    lines.push("");
    lines.push(`${isUz ? "💡 O‘quvchi uchun ahamiyati:" : "💡 Практическая польза:"} ${takeaway}`);
  }

  // 5. Source Credit
  lines.push("");
  lines.push(`${isUz ? "📰 Manba:" : "📰 Источник:"} ${sourceName}`);
  lines.push("🌐 @angren_estate");

  let caption = lines.join("\n").trim();
  if (caption.length > 1024) {
    caption = caption.slice(0, 1020) + "...";
  }

  return caption;
}

/**
 * Build compliant inline keyboard markup for news post.
 * Uses verified HTTPS URLs only (no web_app buttons).
 */
export function buildNewsPostMarkup(news: RealEstateNews, lang: "uz" | "ru" = "uz") {
  const isUz = lang === "uz";
  const siteUrl = getTelegramPublicSiteUrl();

  let originalUrl = news.original_url.trim();
  if (originalUrl.startsWith("/")) {
    originalUrl = `${siteUrl}${originalUrl}`;
  }

  // Guarantee valid HTTPS for external URL
  if (!originalUrl.startsWith("https://") && !originalUrl.startsWith("http://")) {
    originalUrl = `https://${originalUrl}`;
  }

  return {
    inline_keyboard: [
      [
        {
          text: isUz ? "📖 Asl manbani o‘qish →" : "📖 Читать источник →",
          url: originalUrl,
        },
        {
          text: "🏠 ANGREN ESTATE",
          url: siteUrl,
        },
      ],
    ],
  };
}

export interface NewsPublishResult {
  success: boolean;
  status: "published" | "already_published" | "error";
  targetType: "channel" | "bot_broadcast";
  language: "uz" | "ru";
  messageId?: number;
  recipientsCount?: number;
  error?: string;
}

/**
 * Publish news item to Telegram Channel (@angren_estate)
 */
export async function publishNewsToTelegramChannel(
  newsId: string,
  lang: "uz" | "ru" = "uz",
  options?: {
    forceRepeat?: boolean;
    channelId?: string;
    botToken?: string;
  }
): Promise<NewsPublishResult> {
  const token = options?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      success: false,
      status: "error",
      targetType: "channel",
      language: lang,
      error: "TELEGRAM_BOT_TOKEN is not configured on the server",
    };
  }

  const news = await getNewsById(newsId);
  if (!news) {
    return {
      success: false,
      status: "error",
      targetType: "channel",
      language: lang,
      error: "News item not found",
    };
  }

  const targetChannel =
    options?.channelId ||
    process.env.TELEGRAM_CHANNEL_ID ||
    process.env.TELEGRAM_CHANNEL ||
    "@angren_estate";

  const lockKey = `${news.id}_channel_${lang}`;
  if (inFlightNewsPublishes.has(lockKey)) {
    return {
      success: false,
      status: "error",
      targetType: "channel",
      language: lang,
      error: "Publication already in progress for this news item",
    };
  }

  // Deduplication check: Has this news already been published in this language to the channel?
  if (!options?.forceRepeat) {
    const existingPub = news.publications?.find(
      (p) => p.target_type === "channel" && p.language === lang && p.status === "published"
    );
    if (existingPub && existingPub.telegram_message_id) {
      return {
        success: true,
        status: "already_published",
        targetType: "channel",
        language: lang,
        messageId: existingPub.telegram_message_id,
      };
    }
  }

  inFlightNewsPublishes.add(lockKey);

  try {
    const caption = buildNewsPostCaption(news, lang);
    const replyMarkup = buildNewsPostMarkup(news, lang);

    // 1. Validate existing asset or generate a new raster JPEG asset
    let asset = lang === "uz" ? news.assets?.uz : news.assets?.ru;
    if (!isRasterAssetValid(asset)) {
      try {
        asset = await generateAndSaveNewsAsset(news, lang);
      } catch (assetErr: any) {
        console.warn("[NewsPublisher] Could not generate asset:", assetErr?.message || assetErr);
      }
    }

    let sendResult: any = null;
    let photoSendAttempted = false;
    let lastPhotoError: string | undefined;

    // A. Try public HTTPS URL if available (never data: URI, never .svg)
    if (isRasterAssetValid(asset)) {
      photoSendAttempted = true;
      try {
        sendResult = await sendTelegramPhoto(targetChannel, asset!.public_url, caption, replyMarkup, token);
        if (!sendResult.ok) {
          lastPhotoError = sendResult.description || `HTTP ${sendResult.http_status}`;
          console.warn(
            `[NewsPublisher] Remote URL photo delivery failed (code: ${sendResult.error_code || "unknown"}, desc: ${sendResult.description || "none"}). Trying multipart buffer upload.`
          );
        }
      } catch (err: any) {
        lastPhotoError = err?.message || "URL photo delivery exception";
        console.warn("[NewsPublisher] Exception during URL photo send:", err?.message || err);
      }
    }

    // B. If URL send was not possible or failed, attempt direct multipart binary upload of real JPEG buffer
    if (!sendResult || !sendResult.ok) {
      try {
        const imageBuffer = await getNewsCardImageBuffer(news, lang);
        if (isValidImageBuffer(imageBuffer)) {
          photoSendAttempted = true;
          sendResult = await sendTelegramPhoto(
            targetChannel,
            imageBuffer,
            caption,
            replyMarkup,
            token,
            "image/jpeg"
          );
          if (!sendResult.ok) {
            lastPhotoError = sendResult.description || `HTTP ${sendResult.http_status}`;
            console.warn(
              `[NewsPublisher] Multipart buffer photo delivery failed (code: ${sendResult.error_code || "unknown"}, desc: ${sendResult.description || "none"}).`
            );
          }
        }
      } catch (err: any) {
        lastPhotoError = err?.message || "Multipart buffer photo send exception";
        console.warn("[NewsPublisher] Exception during multipart buffer photo send:", err?.message || err);
      }
    }

    // C. Strict failure handling: If photo delivery failed, do NOT falsely claim success
    if (!sendResult || !sendResult.ok) {
      const errorMsg = lastPhotoError || (photoSendAttempted ? "Telegram sendPhoto xatolik berdi" : "Rasm tayyorlanmadi");
      await recordNewsPublication({
        news_id: news.id,
        target_type: "channel",
        language: lang,
        status: "failed",
        error_message: errorMsg,
      });

      return {
        success: false,
        status: "error",
        targetType: "channel",
        language: lang,
        error: errorMsg,
      };
    }

    // Validate result and message_id
    if (!sendResult.ok) {
      await recordNewsPublication({
        news_id: news.id,
        target_type: "channel",
        language: lang,
        status: "failed",
        error_message: sendResult.description || "Telegram API error",
      });

      return {
        success: false,
        status: "error",
        targetType: "channel",
        language: lang,
        error: sendResult.description || "Failed to post to Telegram channel",
      };
    }

    const messageId = sendResult.result?.message_id;

    // Strict validation of message_id: must exist, must be number, and must be > 0
    if (!messageId || typeof messageId !== "number" || messageId <= 0) {
      const errDesc = "Telegram API succeeded but returned invalid or missing message_id";
      console.error(`[NewsPublisher] ${errDesc}:`, sendResult.result);
      await recordNewsPublication({
        news_id: news.id,
        target_type: "channel",
        language: lang,
        status: "failed",
        error_message: errDesc,
      });

      return {
        success: false,
        status: "error",
        targetType: "channel",
        language: lang,
        error: errDesc,
      };
    }

    await recordNewsPublication({
      news_id: news.id,
      target_type: "channel",
      language: lang,
      status: "published",
      telegram_message_id: messageId,
      published_at: new Date().toISOString(),
    });

    await updateNewsStatus(news.id, "published");

    return {
      success: true,
      status: "published",
      targetType: "channel",
      language: lang,
      messageId,
    };
  } finally {
    inFlightNewsPublishes.delete(lockKey);
  }
}

/**
 * Broadcast news item to subscribed Telegram Bot users
 */
export async function broadcastNewsToTelegramSubscribers(
  newsId: string,
  lang: "uz" | "ru" = "uz",
  options?: {
    forceRepeat?: boolean;
    botToken?: string;
  }
): Promise<NewsPublishResult> {
  const token = options?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      success: false,
      status: "error",
      targetType: "bot_broadcast",
      language: lang,
      error: "TELEGRAM_BOT_TOKEN is not configured",
    };
  }

  const news = await getNewsById(newsId);
  if (!news) {
    return {
      success: false,
      status: "error",
      targetType: "bot_broadcast",
      language: lang,
      error: "News item not found",
    };
  }

  const lockKey = `${news.id}_bot_${lang}`;
  if (inFlightBotPublishes.has(lockKey)) {
    return {
      success: false,
      status: "error",
      targetType: "bot_broadcast",
      language: lang,
      error: "Bot broadcast already in progress for this news item",
    };
  }

  // Deduplication check: Has this news already been broadcast in this language?
  if (!options?.forceRepeat) {
    const existingPub = news.publications?.find(
      (p) => p.target_type === "bot_broadcast" && p.language === lang && p.status === "published"
    );
    if (existingPub && (existingPub.recipients_count ?? 0) > 0) {
      return {
        success: true,
        status: "already_published",
        targetType: "bot_broadcast",
        language: lang,
        recipientsCount: existingPub.recipients_count,
      };
    }
  }

  inFlightBotPublishes.add(lockKey);

  try {
    const subscribers = await getEligibleNotificationSubscribers();
    if (!subscribers || subscribers.length === 0) {
      const errorMsg = "Faol obunachilar ro‘yxati mavjud emas yoki bo‘sh";
      await recordNewsPublication({
        news_id: news.id,
        target_type: "bot_broadcast",
        language: lang,
        status: "failed",
        recipients_count: 0,
        error_message: errorMsg,
      });

      return {
        success: false,
        status: "error",
        targetType: "bot_broadcast",
        language: lang,
        recipientsCount: 0,
        error: errorMsg,
      };
    }

    const caption = buildNewsPostCaption(news, lang);
    const replyMarkup = buildNewsPostMarkup(news, lang);

    // 1. Validate existing asset or generate a new raster JPEG asset
    let asset = lang === "uz" ? news.assets?.uz : news.assets?.ru;
    if (!isRasterAssetValid(asset)) {
      try {
        asset = await generateAndSaveNewsAsset(news, lang);
      } catch (assetErr: any) {
        console.warn("[NewsPublisher] Could not generate asset for bot broadcast:", assetErr?.message || assetErr);
      }
    }

    // Determine photo source: public URL or JPEG buffer
    let photoPayload: string | Buffer | null = null;
    if (isRasterAssetValid(asset)) {
      photoPayload = asset!.public_url;
    } else {
      try {
        const imageBuffer = await getNewsCardImageBuffer(news, lang);
        if (isValidImageBuffer(imageBuffer)) {
          photoPayload = imageBuffer;
        }
      } catch {}
    }

    let sentCount = 0;
    let lastError: string | undefined;

    for (const sub of subscribers) {
      try {
        let res: any = null;
        if (photoPayload) {
          res = await sendTelegramPhoto(
            sub.telegram_user_id,
            photoPayload,
            caption,
            replyMarkup,
            token,
            "image/jpeg"
          );
        }
        // Fallback to direct message for individual subscriber if photo delivery failed
        if (!res || !res.ok) {
          res = await sendTelegramDirectMessage(sub.telegram_user_id, caption, replyMarkup, token);
        }

        if (res.ok && res.result?.message_id && res.result.message_id > 0) {
          sentCount++;
        } else if (!res.ok) {
          lastError = res.description || "Telegram API delivery error";
        }
        await sleep(35);
      } catch (err: any) {
        lastError = err?.message || "Delivery exception";
      }
    }

    if (sentCount === 0) {
      const errorMsg = lastError || "Barcha bot obunachilariga xabar yetkazishda xatolik yuz berdi";
      await recordNewsPublication({
        news_id: news.id,
        target_type: "bot_broadcast",
        language: lang,
        status: "failed",
        recipients_count: 0,
        error_message: errorMsg,
      });

      return {
        success: false,
        status: "error",
        targetType: "bot_broadcast",
        language: lang,
        recipientsCount: 0,
        error: errorMsg,
      };
    }

    await recordNewsPublication({
      news_id: news.id,
      target_type: "bot_broadcast",
      language: lang,
      status: "published",
      recipients_count: sentCount,
      published_at: new Date().toISOString(),
    });

    return {
      success: true,
      status: "published",
      targetType: "bot_broadcast",
      language: lang,
      recipientsCount: sentCount,
    };
  } finally {
    inFlightBotPublishes.delete(lockKey);
  }
}
