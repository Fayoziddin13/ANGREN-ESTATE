import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getPropertyById } from "@/lib/properties";
import { sendAdminTestNotification } from "@/lib/telegramNotifications";

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

    const propertyId = params.id;
    const property = await getPropertyById(propertyId, { useAdmin: true });
    if (!property) {
      return NextResponse.json({ success: false, error: "Property not found" }, { status: 404 });
    }

    const body = await request.json();
    const telegramUserId = Number(body?.telegramUserId);
    if (!telegramUserId || isNaN(telegramUserId)) {
      return NextResponse.json(
        { success: false, error: "Valid numeric telegramUserId is required" },
        { status: 400 }
      );
    }

    const lang = body.lang === "ru" ? "ru" : "uz";
    const result = await sendAdminTestNotification(telegramUserId, property, lang);

    if (!result.ok) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to send Telegram test notification",
        status: result.status,
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: `Test notification sent successfully to Telegram ID ${telegramUserId}`,
      status: result.status,
    });
  } catch (error: any) {
    console.error("[Admin Telegram Test POST] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
