import { NextRequest, NextResponse } from "next/server";
import { getPropertyById, sanitizePublicProperty } from "@/lib/properties";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
    }

    const property = await getPropertyById(id, { useAdmin: true });

    if (!property) {
      return NextResponse.json({ success: false, error: "Property not found" }, { status: 404 });
    }

    // Public safety: Draft and archived properties are NOT publicly accessible
    if (property.status === "draft" || property.status === "archived") {
      return NextResponse.json(
        { success: false, error: "Property not available publicly", status: property.status },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      property: sanitizePublicProperty(property),
    });
  } catch (error) {
    console.error(`Error in /api/properties/${params?.id} GET:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch property" },
      { status: 500 }
    );
  }
}
