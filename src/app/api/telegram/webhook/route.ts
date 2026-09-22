import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramWelcomeMessage,
  editTelegramWelcomeMessage,
  answerTelegramCallback,
  sendTelegramAppMessage,
  upsertTelegramUser,
  setTelegramUserNotifications,
  getTelegramUser,
  sendContactRequestMessage,
  sendRegistrationSuccessMessage,
  sendTelegramDirectMessage,
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

      // C. Start Registration
      if (data === "start_registration" || data === "register") {
        await answerTelegramCallback(cb.id, token);
        const existing = fromUser?.id ? await getTelegramUser(fromUser.id) : null;
        const lang =
          existing?.language ||
          (fromUser?.language_code?.toLowerCase().startsWith("ru") ? "ru" : "uz");
        if (chatId) {
          await sendContactRequestMessage(chatId, lang, token);
        }
        return NextResponse.json({ ok: true });
      }

      // D. Language Switcher (lang_ru / lang_uz)
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

    // 2. Handle messages
    const message = update?.message || update?.edited_message;
    if (message && message.chat) {
      const chatId = message.chat.id;
      const fromUser = message.from;
      const senderId = fromUser?.id;
      const langCode = fromUser?.language_code || "uz";

      // A. Handle Contact message (Telegram ReplyKeyboardButton request_contact)
      if (message.contact) {
        const contact = message.contact;

        // Security Check: contact.user_id must strictly match message.from.id
        if (!contact.user_id || Number(contact.user_id) !== Number(senderId)) {
          const existing = senderId ? await getTelegramUser(senderId) : null;
          const lang =
            existing?.language ||
            (langCode.toLowerCase().startsWith("ru") ? "ru" : "uz");
          const warningText =
            lang === "ru"
              ? "Пожалуйста, используйте кнопку «Поделиться контактом»."
              : "«Kontaktni ulashish» tugmasidan foydalaning.";

          await sendTelegramDirectMessage(chatId, warningText, {
            keyboard: [
              [
                {
                  text: lang === "ru" ? "📱 Поделиться контактом" : "📱 Kontaktni ulashish",
                  request_contact: true,
                },
              ],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          });
          return NextResponse.json({ ok: true });
        }

        // Valid contact from user
        let phone = (contact.phone_number || "").trim();
        if (phone && !phone.startsWith("+")) {
          phone = `+${phone}`;
        }

        const existingUser = senderId ? await getTelegramUser(senderId) : null;
        const userLang: "uz" | "ru" =
          existingUser?.language ||
          (langCode.toLowerCase().startsWith("ru") ? "ru" : "uz");
        const now = new Date().toISOString();

        await upsertTelegramUser({
          id: senderId,
          username: fromUser?.username || null,
          first_name: contact.first_name || fromUser?.first_name || null,
          last_name: contact.last_name || fromUser?.last_name || null,
          phone: phone,
          language: userLang,
          notifications_enabled: true,
          registered_at: existingUser?.registered_at || now,
        });

        await sendRegistrationSuccessMessage(chatId, userLang, token, siteUrl);
        return NextResponse.json({ ok: true });
      }

      // B. Handle Text messages
      const text = (message.text || "").trim();

      // Check for registration text triggers
      if (
        text.startsWith("/register") ||
        text.toLowerCase() === "регистрация" ||
        text.toLowerCase() === "ro‘yxatdan o‘tish" ||
        text.toLowerCase() === "ro'yxatdan o'tish" ||
        text.toLowerCase() === "royxatdan otish"
      ) {
        const existing = senderId ? await getTelegramUser(senderId) : null;
        const lang =
          existing?.language ||
          (langCode.toLowerCase().startsWith("ru") ? "ru" : "uz");
        await sendContactRequestMessage(chatId, lang, token);
        return NextResponse.json({ ok: true });
      }

      // Determine registration state and effective language
      let isRegistered = false;
      let effectiveLang: "uz" | "ru" = langCode.toLowerCase().startsWith("ru") ? "ru" : "uz";

      if (senderId) {
        const existing = await getTelegramUser(senderId);
        if (existing) {
          isRegistered = Boolean(existing.phone);
          effectiveLang = existing.language || effectiveLang;
        }

        await upsertTelegramUser({
          id: senderId,
          username: fromUser?.username,
          first_name: fromUser?.first_name,
          last_name: fromUser?.last_name,
          language: effectiveLang,
        });
      }

      if (text.startsWith("/app")) {
        if (!isRegistered) {
          await sendContactRequestMessage(chatId, effectiveLang, token);
        } else {
          await sendTelegramAppMessage(chatId, effectiveLang, token, siteUrl);
        }
      } else if (text.startsWith("/start") || message.chat.type === "private") {
        if (!isRegistered) {
          // FIRST /start: ONLY REGISTRATION!
          // No site info, no Mini App button, no language switcher.
          await sendContactRequestMessage(chatId, effectiveLang, token);
        } else {
          // SUBSEQUENT /start: Welcome + Mini App + Language!
          await sendTelegramWelcomeMessage(chatId, effectiveLang, token, siteUrl);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Telegram Webhook] Error processing update:", err);
    return NextResponse.json({ ok: true });
  }
}
