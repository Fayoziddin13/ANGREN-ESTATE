import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getPropertyById } from "@/lib/properties";
import { publishPropertyToTelegramChannel } from "@/lib/telegramNotifications";

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

/**
 * GET status: check if already published to Telegram channel (@angren_estate)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const propertyId = params.id;
    const property = await getPropertyById(propertyId, { useAdmin: true });
    if (!property) {
      return NextResponse.json({ success: false, error: "Property not found" }, { status: 404 });
    }

    const isPublished =
      property.telegram_channel_status === "published" &&
      Boolean(property.telegram_channel_post_id);

    return NextResponse.json({
      success: true,
      propertyId,
      status: property.telegram_channel_status || "pending",
      postId: property.telegram_channel_post_id || null,
      isPublished,
    });
  } catch (error: any) {
    console.error("[Admin Telegram Channel GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Publish property to Telegram channel (@angren_estate)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const propertyId = params.id;
    const property = await getPropertyById(propertyId, { useAdmin: true });
    if (!property) {
      return NextResponse.json({ success: false, error: "Property not found" }, { status: 404 });
    }

    let forceRepeat = false;
    try {
      const body = await request.json();
      forceRepeat = Boolean(body?.forceRepeat);
    } catch {
      // Empty body is acceptable (defaults to forceRepeat = false)
    }

    const result = await publishPropertyToTelegramChannel(property, { forceRepeat });

    return NextResponse.json({
      success: result.success,
      propertyId,
      status: result.status,
      messageId: result.messageId,
      channelId: result.channelId,
      error: result.error,
    });
  } catch (error: any) {
    console.error("[Admin Telegram Channel POST] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
