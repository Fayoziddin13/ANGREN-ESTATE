import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramWelcomeMessage,
  editTelegramWelcomeMessage,
  answerTelegramCallback,
  sendTelegramAppMessage,
  upsertTelegramUser,
  setTelegramUserNotifications,
  getTelegramUser,
} from "@/lib/telegramServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  return NextResponse.json({
    status: "ok",
    service: "ANGREN ESTATE Telegram Webhook",
    bot_configured: isConfigured,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn("[Telegram Webhook] TELEGRAM_BOT_TOKEN is not configured");
      return NextResponse.json({ ok: false, error: "Bot not configured" }, { status: 503 });
    }

    const update = await req.json();
    const siteUrl = "https://angrenestate.uz";

    // 1. Handle callback_query
    if (update?.callback_query) {
      const cb = update.callback_query;
      const data = cb.data;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const fromUser = cb.from;

      // A. Mute Notifications
      if (data === "mute_notif") {
        const userId = fromUser?.id || chatId;
        if (userId) {
          await setTelegramUserNotifications(userId, false);
          const lang = fromUser?.language_code?.toLowerCase().startsWith("ru") ? "ru" : "uz";
          const alertMsg =
            lang === "ru"
              ? "🔕 Уведомления отключены.\nЧтобы включить снова, отправьте /start."
              : "🔕 Bildirishnomalar o‘chirildi.\nQayta yoqish uchun /start yuboring.";
          await answerTelegramCallback(cb.id, token, alertMsg, true);
        } else {
          await answerTelegramCallback(cb.id, token);
        }
        return NextResponse.json({ ok: true });
      }

      // B. Unmute Notifications
      if (data === "unmute_notif") {
        const userId = fromUser?.id || chatId;
        if (userId) {
          await setTelegramUserNotifications(userId, true);
          const lang = fromUser?.language_code?.toLowerCase().startsWith("ru") ? "ru" : "uz";
          const alertMsg =
            lang === "ru"
              ? "🔔 Уведомления включены."
              : "🔔 Bildirishnomalar yoqildi.";
          await answerTelegramCallback(cb.id, token, alertMsg, true);
        } else {
          await answerTelegramCallback(cb.id, token);
        }
        return NextResponse.json({ ok: true });
      }

      // C. Language Switcher (lang_ru / lang_uz)
      await answerTelegramCallback(cb.id, token);
      if (chatId && messageId && (data === "lang_ru" || data === "lang_uz")) {
        const targetLang = data === "lang_ru" ? "ru" : "uz";
        if (fromUser?.id) {
          await upsertTelegramUser({
            id: fromUser.id,
            username: fromUser.username,
            first_name: fromUser.first_name,
            language: targetLang,
          });
        }
        await editTelegramWelcomeMessage(chatId, messageId, targetLang, token, siteUrl);
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Handle messages (/start, /app, etc.)
    const message = update?.message || update?.edited_message;
    if (message && message.chat) {
      const text = (message.text || "").trim();
      const chatId = message.chat.id;
      const langCode = message.from?.language_code || "uz";

      // Register or update user upon any bot interaction / /start
      if (message.from && message.from.id) {
        await upsertTelegramUser({
          id: message.from.id,
          username: message.from.username,
          first_name: message.from.first_name,
          language_code: langCode,
        });
      }

      if (text.startsWith("/app")) {
        await sendTelegramAppMessage(chatId, langCode, token, siteUrl);
      } else if (text.startsWith("/start") || message.chat.type === "private") {
        await sendTelegramWelcomeMessage(chatId, langCode, token, siteUrl);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Telegram Webhook] Error processing update:", err);
    return NextResponse.json({ ok: true });
  }
}
