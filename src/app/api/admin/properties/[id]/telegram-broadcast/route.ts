import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getPropertyById } from "@/lib/properties";
import { broadcastPropertyToTelegramSubscribers } from "@/lib/telegramNotifications";
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

/**
 * GET status: check if already sent to Telegram and get stats
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

    const stats = await getTelegramNotificationStats(propertyId);
    const hasAnyLogs = Boolean(
      stats && (stats.sent_count > 0 || stats.failed_count > 0 || stats.blocked_count > 0)
    );
    const alreadyBroadcasted = hasAnyLogs
      ? Boolean(stats && stats.sent_count > 0)
      : Boolean(property.telegram_notified_at);

    return NextResponse.json({
      success: true,
      alreadyBroadcasted,
      telegram_notified_at: (stats && stats.last_sent_at) || property.telegram_notified_at || null,
      stats,
    });
  } catch (error: any) {
    console.error("[Admin Telegram Broadcast GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Broadcast property notification to eligible bot subscribers
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

    const result = await broadcastPropertyToTelegramSubscribers(property, { forceRepeat });

    return NextResponse.json({
      success: true,
      propertyId,
      sent: result.sent,
      failed: result.failed,
      blocked: result.blocked,
      total: result.total,
      alreadySentCount: result.alreadySentCount,
      forceRepeat,
    });
  } catch (error: any) {
    console.error("[Admin Telegram Broadcast POST] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
