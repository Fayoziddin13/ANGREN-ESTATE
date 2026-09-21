import { NextRequest, NextResponse } from "next/server";
import { setTelegramMenuButton, setTelegramBotCommands } from "@/lib/telegramServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return NextResponse.json({
    configured: Boolean(token),
    site_url: process.env.NEXT_PUBLIC_SITE_URL || "https://angrenestate.uz",
  });
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

    let webAppUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://angrenestate.uz";
    try {
      const body = await req.json();
      if (body?.webAppUrl && typeof body.webAppUrl === "string") {
        webAppUrl = body.webAppUrl;
      }
    } catch (e) {
      // Body is optional
    }

    // 1. Configure Menu Button
    const menuResult = await setTelegramMenuButton(token, webAppUrl);

    // 2. Configure Commands
    const commandsResult = await setTelegramBotCommands(token);

    return NextResponse.json({
      success: true,
      webAppUrl,
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
