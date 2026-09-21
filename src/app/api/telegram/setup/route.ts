import { NextRequest, NextResponse } from "next/server";
import {
  setTelegramMenuButton,
  setTelegramBotCommands,
  setTelegramWebhook,
  getTelegramBotInfo,
  getTelegramWebhookInfo,
  getTelegramBotCommands,
  getTelegramMenuButton,
} from "@/lib/telegramServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({
      configured: false,
      site_url: "https://angrenestate.uz",
    });
  }

  try {
    const [botInfo, webhookInfo, commands, menuButton] = await Promise.all([
      getTelegramBotInfo(token).catch((e) => ({ ok: false, error: e.message })),
      getTelegramWebhookInfo(token).catch((e) => ({ ok: false, error: e.message })),
      getTelegramBotCommands(token).catch((e) => ({ ok: false, error: e.message })),
      getTelegramMenuButton(token).catch((e) => ({ ok: false, error: e.message })),
    ]);

    return NextResponse.json({
      configured: true,
      site_url: "https://angrenestate.uz",
      bot: botInfo?.result
        ? {
            id: botInfo.result.id,
            first_name: botInfo.result.first_name,
            username: botInfo.result.username,
            can_join_groups: botInfo.result.can_join_groups,
          }
        : null,
      webhook: webhookInfo?.result || webhookInfo,
      commands: commands?.result || commands,
      menuButton: menuButton?.result || menuButton,
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      error: err.message,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN is not configured on server" },
        { status: 400 }
      );
    }

    const webAppUrl = "https://angrenestate.uz";
    const webhookUrl = "https://angrenestate.uz/api/telegram/webhook";

    // 1. Configure Webhook
    const webhookResult = await setTelegramWebhook(token, webhookUrl);

    // 2. Configure Menu Button
    const menuResult = await setTelegramMenuButton(token, webAppUrl);

    // 3. Configure Commands
    const commandsResult = await setTelegramBotCommands(token);

    return NextResponse.json({
      success: true,
      webAppUrl,
      webhookUrl,
      webhook: webhookResult,
      menuButton: menuResult,
      commands: commandsResult,
    });
  } catch (err: any) {
    console.error("[Telegram Setup API] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
