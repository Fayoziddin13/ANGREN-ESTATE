import { NextRequest, NextResponse } from "next/server";
import { sendTelegramWelcomeMessage } from "@/lib/telegramServer";

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

    // Check if message received
    const message = update?.message || update?.edited_message;
    if (message && message.chat && message.text) {
      const text = message.text.trim();
      const chatId = message.chat.id;
      const langCode = message.from?.language_code || "uz";

      // Match /start or /app commands
      if (text.startsWith("/start") || text.startsWith("/app")) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://angrenestate.uz";
        await sendTelegramWelcomeMessage(chatId, langCode, token, siteUrl);
      }
    }

    // Always respond 200 OK to Telegram to prevent retry floods
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Telegram Webhook] Error processing update:", err);
    return NextResponse.json({ ok: true });
  }
}
