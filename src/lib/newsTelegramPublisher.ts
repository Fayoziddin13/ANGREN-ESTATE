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
import { generateAndSaveNewsAsset } from "./newsVisualGenerator";
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

    // Get or generate brand visual
    let asset = lang === "uz" ? news.assets?.uz : news.assets?.ru;
    if (!asset || !asset.public_url) {
      try {
        asset = await generateAndSaveNewsAsset(news, lang);
      } catch (assetErr) {
        console.warn("[NewsPublisher] Could not generate asset, will send as text:", assetErr);
      }
    }

    let sendResult: any;

    if (asset && asset.public_url && asset.public_url.startsWith("https://")) {
      sendResult = await sendTelegramPhoto(targetChannel, asset.public_url, caption, replyMarkup, token);
      if (!sendResult.ok) {
        // Fallback to direct text
        console.warn(`[NewsPublisher] Photo send failed (${sendResult.description}), falling back to text post`);
        sendResult = await sendTelegramDirectMessage(targetChannel, caption, replyMarkup, token);
      }
    } else {
      // Direct text post
      sendResult = await sendTelegramDirectMessage(targetChannel, caption, replyMarkup, token);
    }

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

  const subscribers = await getEligibleNotificationSubscribers();
  if (!subscribers || subscribers.length === 0) {
    return {
      success: true,
      status: "published",
      targetType: "bot_broadcast",
      language: lang,
      recipientsCount: 0,
    };
  }

  const caption = buildNewsPostCaption(news, lang);
  const replyMarkup = buildNewsPostMarkup(news, lang);

  let sentCount = 0;
  for (const sub of subscribers) {
    try {
      // Direct text delivery for bot subscribers
      const res = await sendTelegramDirectMessage(sub.telegram_user_id, caption, replyMarkup, token);
      if (res.ok) {
        sentCount++;
      }
      await sleep(35);
    } catch {}
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
}
