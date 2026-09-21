import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramWelcomeMessage,
  editTelegramWelcomeMessage,
  answerTelegramCallback,
  sendTelegramAppMessage,
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

    // 1. Handle callback_query (Language Switcher)
    if (update?.callback_query) {
      const cb = update.callback_query;
      await answerTelegramCallback(cb.id, token);

      const data = cb.data;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;

      if (chatId && messageId && (data === "lang_ru" || data === "lang_uz")) {
        const targetLang = data === "lang_ru" ? "ru" : "uz";
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
