import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramWelcomeMessage,
  editTelegramWelcomeMessage,
  answerTelegramCallback,
  sendTelegramAppMessage,
  upsertTelegramUser,
  setTelegramUserNotifications,
  getTelegramUser,
  isTelegramUserRegistered,
  sendContactRequestMessage,
  sendRegistrationSuccessMessage,
  sendTelegramDirectMessage,
  deleteTelegramMessage,
  normalizePhoneNumber,
} from "@/lib/telegramServer";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendApplicationToAdminTelegram } from "@/lib/telegramNotifications";
import type { TelegramSubscriber } from "@/lib/types";

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
            last_welcome_message_id: messageId,
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
              ? "⚠️ Для регистрации отправьте собственный номер телефона с помощью кнопки «📱 Отправить номер телефона» ниже."
              : "⚠️ Ro‘yxatdan o‘tish uchun faqat o‘zingizning telefon raqamingizni pastdagi «📱 Telefon raqamimni yuborish» tugmasi orqali yuboring.";

          await sendTelegramDirectMessage(chatId, warningText, {
            keyboard: [
              [
                {
                  text: lang === "ru" ? "📱 Отправить номер телефона" : "📱 Telefon raqamimni yuborish",
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
        const phone = normalizePhoneNumber(contact.phone_number || "");

        const existingUser = senderId ? await getTelegramUser(senderId) : null;
        const userLang: "uz" | "ru" =
          existingUser?.language ||
          (langCode.toLowerCase().startsWith("ru") ? "ru" : "uz");
        const now = new Date().toISOString();

        // Clean up temporary messages:
        // Delete old registration prompt if one existed
        if (existingUser?.last_reg_message_id) {
          await deleteTelegramMessage(chatId, existingUser.last_reg_message_id, token);
        }
        // Also delete old welcome message if one existed
        if (existingUser?.last_welcome_message_id) {
          await deleteTelegramMessage(chatId, existingUser.last_welcome_message_id, token);
        }

        // Send registration completion (with remove_keyboard) AND immediately send Welcome message with 2 buttons
        // User does NOT need to press /start again!
        const regResult = await sendRegistrationSuccessMessage(chatId, userLang, token, siteUrl);

        // Persist user with phone, registered_at, and tracked welcome message id
        await upsertTelegramUser({
          id: senderId,
          username: fromUser?.username || null,
          first_name: contact.first_name || fromUser?.first_name || null,
          last_name: contact.last_name || fromUser?.last_name || null,
          phone: phone,
          language: userLang,
          notifications_enabled: true,
          registered_at: existingUser?.registered_at || now,
          last_welcome_message_id: regResult.welcomeMessageId || null,
          last_reg_message_id: null,
        });

        // Record lead in public.leads and notify admin bot
        try {
          const contactName =
            [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
            fromUser?.first_name ||
            fromUser?.username ||
            "Telegram foydalanuvchisi";

          const windowStart = new Date(Date.now() - 60000).toISOString();

          // Deduplicate within 60s
          const { data: existingLeads } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("type", "telegram")
            .eq("client_phone", phone)
            .gte("created_at", windowStart)
            .limit(1);

          if (!existingLeads || existingLeads.length === 0) {
            await supabaseAdmin.from("leads").insert([
              {
                property_id: null,
                realtor_id: null,
                type: "telegram",
                status: "new",
                property_title: "Telegram bot orqali murojaat (Kontakt)",
                property_slug: "telegram-kontakt",
                client_name: contactName,
                client_phone: phone,
                message: "Foydalanuvchi Telegram bot orqali kontaktini yubordi va ro‘yxatdan o‘tdi.",
                notes: null,
                device: "Telegram App",
                traffic_source: "Telegram",
                ip_hash: `tg_${senderId}`,
                metadata: {
                  source: "Telegram Bot",
                  telegram_username: fromUser?.username || null,
                  telegram_user_id: senderId || null,
                  registration_step: "contact_shared",
                },
                created_at: now,
                updated_at: now,
              },
            ]);

            await sendApplicationToAdminTelegram({
              client_name: contactName,
              client_phone: phone,
              source: "Telegram Bot",
              description: "Foydalanuvchi Telegram bot orqali kontaktini yubordi va ro‘yxatdan o‘tdi.",
              telegram_username: fromUser?.username || null,
              telegram_user_id: senderId || null,
              created_at: now,
            });
          }
        } catch (leadErr: any) {
          console.warn("[Telegram Webhook] Lead creation error on contact share:", leadErr?.message || leadErr);
        }

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
        const isReg = Boolean(existing?.phone);
        const lang =
          existing?.language ||
          (langCode.toLowerCase().startsWith("ru") ? "ru" : "uz");

        if (isReg) {
          // Already registered: show welcome message, do NOT ask for contact again
          if (existing?.last_welcome_message_id) {
            await deleteTelegramMessage(chatId, existing.last_welcome_message_id, token);
          }
          if (existing?.last_reg_message_id) {
            await deleteTelegramMessage(chatId, existing.last_reg_message_id, token);
          }
          const welcomeRes = await sendTelegramWelcomeMessage(chatId, lang, token, siteUrl);
          if (senderId) {
            await upsertTelegramUser({
              id: senderId,
              language: lang,
              last_welcome_message_id: welcomeRes.result?.message_id || null,
              last_reg_message_id: null,
            });
          }
        } else {
          // Unregistered: delete old prompt if exists and send fresh contact request
          if (existing?.last_reg_message_id) {
            await deleteTelegramMessage(chatId, existing.last_reg_message_id, token);
          }
          const promptRes = await sendContactRequestMessage(chatId, lang, token);
          if (senderId) {
            await upsertTelegramUser({
              id: senderId,
              language: lang,
              last_reg_message_id: promptRes.result?.message_id || null,
            });
          }
        }
        return NextResponse.json({ ok: true });
      }

      // Determine registration state and effective language
      let isRegistered = false;
      let effectiveLang: "uz" | "ru" = langCode.toLowerCase().startsWith("ru") ? "ru" : "uz";
      let existingUser: TelegramSubscriber | null = null;

      if (senderId) {
        existingUser = await getTelegramUser(senderId);
        if (existingUser) {
          isRegistered = Boolean(existingUser.phone);
          effectiveLang = existingUser.language || effectiveLang;
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
          if (existingUser?.last_reg_message_id) {
            await deleteTelegramMessage(chatId, existingUser.last_reg_message_id, token);
          }
          const promptRes = await sendContactRequestMessage(chatId, effectiveLang, token);
          if (senderId) {
            await upsertTelegramUser({
              id: senderId,
              last_reg_message_id: promptRes.result?.message_id || null,
            });
          }
        } else {
          if (existingUser?.last_welcome_message_id) {
            await deleteTelegramMessage(chatId, existingUser.last_welcome_message_id, token);
          }
          if (existingUser?.last_reg_message_id) {
            await deleteTelegramMessage(chatId, existingUser.last_reg_message_id, token);
          }
          const appRes = await sendTelegramAppMessage(chatId, effectiveLang, token, siteUrl);
          if (senderId) {
            await upsertTelegramUser({
              id: senderId,
              last_welcome_message_id: appRes.result?.message_id || null,
              last_reg_message_id: null,
            });
          }
        }
      } else if (text.startsWith("/start")) {
        if (!isRegistered) {
          // FIRST /start: ONLY REGISTRATION!
          if (existingUser?.last_reg_message_id) {
            await deleteTelegramMessage(chatId, existingUser.last_reg_message_id, token);
          }
          if (existingUser?.last_welcome_message_id) {
            await deleteTelegramMessage(chatId, existingUser.last_welcome_message_id, token);
          }
          const promptRes = await sendContactRequestMessage(chatId, effectiveLang, token);
          if (senderId) {
            await upsertTelegramUser({
              id: senderId,
              last_reg_message_id: promptRes.result?.message_id || null,
            });
          }
        } else {
          // SUBSEQUENT /start: Welcome + Mini App + Language!
          if (existingUser?.last_welcome_message_id) {
            await deleteTelegramMessage(chatId, existingUser.last_welcome_message_id, token);
          }
          if (existingUser?.last_reg_message_id) {
            await deleteTelegramMessage(chatId, existingUser.last_reg_message_id, token);
          }
          const welcomeRes = await sendTelegramWelcomeMessage(chatId, effectiveLang, token, siteUrl);
          if (senderId) {
            await upsertTelegramUser({
              id: senderId,
              last_welcome_message_id: welcomeRes.result?.message_id || null,
              last_reg_message_id: null,
            });
          }
        }
      } else if (text.length > 0 && message.chat.type === "private") {
        // User sent an inquiry, application or custom message via Telegram Bot
        const now = new Date().toISOString();
        const contactName =
          [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(" ") ||
          fromUser?.username ||
          "Telegram foydalanuvchisi";
        const contactPhone = existingUser?.phone || null;

        // Deduplication check: same user text message within 60s
        const windowStart = new Date(Date.now() - 60000).toISOString();
        try {
          const { data: existingMsgLeads } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("type", "telegram")
            .eq("ip_hash", `tg_${senderId}`)
            .gte("created_at", windowStart)
            .limit(1);

          if (!existingMsgLeads || existingMsgLeads.length === 0) {
            await supabaseAdmin.from("leads").insert([
              {
                property_id: null,
                realtor_id: null,
                type: "telegram",
                status: "new",
                property_title: "Telegram bot orqali ariza / xabar",
                property_slug: "telegram-ariza",
                client_name: contactName,
                client_phone: contactPhone,
                message: text,
                notes: null,
                device: "Telegram App",
                traffic_source: "Telegram",
                ip_hash: `tg_${senderId}`,
                metadata: {
                  source: "Telegram Bot",
                  telegram_username: fromUser?.username || null,
                  telegram_user_id: senderId || null,
                  raw_message: text,
                },
                created_at: now,
                updated_at: now,
              },
            ]);

            await sendApplicationToAdminTelegram({
              client_name: contactName,
              client_phone: contactPhone || "Ko‘rsatilmagan (Telegram orqali)",
              source: "Telegram Bot",
              description: text,
              telegram_username: fromUser?.username || null,
              telegram_user_id: senderId || null,
              created_at: now,
            });
          }
        } catch (leadSaveErr: any) {
          console.warn("[Telegram Webhook] Error recording text lead:", leadSaveErr?.message || leadSaveErr);
        }

        // Send polite confirmation message to the user
        const replyText =
          effectiveLang === "ru"
            ? "✅ Ваша заявка принята! Наш специалист свяжется с вами в ближайшее время."
            : "✅ Sizning arizangiz qabul qilindi! Mutaxassisimiz tez orada siz bilan bog‘lanadi.";

        await sendTelegramDirectMessage(chatId, replyText, undefined, token);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Telegram Webhook] Error processing update:", err);
    return NextResponse.json({ ok: true });
  }
}
