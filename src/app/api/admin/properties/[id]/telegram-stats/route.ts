import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getPropertyById } from "@/lib/properties";
import { getTelegramNotificationStats } from "@/lib/telegramServer";

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

    const channelStatus = property.telegram_channel_status || "not_published";
    const channelPostId = property.telegram_channel_post_id;

    const stats = await getTelegramNotificationStats(propertyId, channelStatus, channelPostId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("[Admin Telegram Stats GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
