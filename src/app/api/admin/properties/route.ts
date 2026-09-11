import { NextRequest, NextResponse } from "next/server";
import { getAdminProperties, createProperty } from "@/lib/properties";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { PropertyStatus } from "@/lib/types";

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

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PropertyStatus | "all" | null;

    const properties = await getAdminProperties(status || "all");

    return NextResponse.json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    console.error("Error in /api/admin/properties GET:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body) {
      return NextResponse.json({ success: false, error: "Missing body" }, { status: 400 });
    }

    const created = await createProperty(body);

    return NextResponse.json(
      {
        success: true,
        property: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in /api/admin/properties POST:", error);
    return NextResponse.json({ success: false, error: "Failed to create property" }, { status: 500 });
  }
}
