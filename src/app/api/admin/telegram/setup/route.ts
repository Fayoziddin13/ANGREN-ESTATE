import { NextResponse } from "next/server";
import { getAdminSessionServer } from "@/lib/admin-auth";
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

const SITE_URL = "https://angrenestate.uz";
const WEBHOOK_URL = `${SITE_URL}/api/telegram/webhook`;

/**
 * Admin-only Telegram bot diagnostics and configuration.
 * Lives under /api/admin so the middleware admin-session check applies;
 * the route re-checks the session as defense in depth.
 */
export async function GET() {
  const session = await getAdminSessionServer();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ configured: false, site_url: SITE_URL });
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
      site_url: SITE_URL,
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
    return NextResponse.json({ configured: true, error: err.message }, { status: 500 });
  }
}

/**
 * Re-registers the webhook (with the secret token), the Mini App menu button
 * and the bot commands. Run once after every deploy that changes the webhook secret.
 */
export async function POST() {
  const session = await getAdminSessionServer();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN is not configured on server" },
        { status: 400 }
      );
    }

    const webhookResult = await setTelegramWebhook(token, WEBHOOK_URL);
    const menuResult = await setTelegramMenuButton(token, SITE_URL);
    const commandsResult = await setTelegramBotCommands(token);

    return NextResponse.json({
      success: true,
      webAppUrl: SITE_URL,
      webhookUrl: WEBHOOK_URL,
      webhook: webhookResult,
      menuButton: menuResult,
      commands: commandsResult,
    });
  } catch (err: any) {
    console.error("[Telegram Setup API] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
