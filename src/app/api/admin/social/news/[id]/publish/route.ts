import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getNewsById } from "@/lib/newsStore";
import {
  publishNewsToTelegramChannel,
  broadcastNewsToTelegramSubscribers,
} from "@/lib/newsTelegramPublisher";

export const dynamic = "force-dynamic";

async function verifyAuth(request: NextRequest) {
  const session = await getAdminSessionServer();
  if (session) return session;

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAdminSessionToken(token);
    if (verified.valid && verified.session) {
      return verified.session;
    }
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const news = await getNewsById(params.id);
    if (!news) {
      return NextResponse.json({ success: false, error: "News not found" }, { status: 404 });
    }

    const body = await request.json();
    const target = body.target || "channel"; // "channel", "bot", "both"
    const language = body.language || "uz"; // "uz", "ru", "both"
    const forceRepeat = Boolean(body.forceRepeat);

    const languagesToPublish: Array<"uz" | "ru"> =
      language === "both" ? ["uz", "ru"] : [language as "uz" | "ru"];

    const publishResults: any[] = [];

    for (const lang of languagesToPublish) {
      if (target === "channel" || target === "both") {
        const channelRes = await publishNewsToTelegramChannel(news.id, lang, { forceRepeat });
        publishResults.push(channelRes);
      }

      if (target === "bot" || target === "both") {
        const botRes = await broadcastNewsToTelegramSubscribers(news.id, lang, { forceRepeat });
        publishResults.push(botRes);
      }
    }

    const allSuccessful = publishResults.every((r) => r.success);
    const updatedNews = await getNewsById(params.id);

    return NextResponse.json({
      success: allSuccessful,
      results: publishResults,
      news: updatedNews,
    });
  } catch (err: any) {
    console.error("[News Publish API] Error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Publishing error" }, { status: 500 });
  }
}
