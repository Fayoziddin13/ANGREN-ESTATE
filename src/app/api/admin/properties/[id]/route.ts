import { NextRequest, NextResponse } from "next/server";
import { getPropertyById, updateProperty, deleteProperty } from "@/lib/properties";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";

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

    const id = params.id;
    const property = await getPropertyById(id, { useAdmin: true });

    if (!property) {
      return NextResponse.json({ success: false, error: "Property not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, property });
  } catch (error) {
    console.error("Error in /api/admin/properties/[id] GET:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    const updates = await request.json();

    const updated = await updateProperty(id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Property not found or failed to update" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      property: updated,
    });
  } catch (error) {
    console.error("Error in /api/admin/properties/[id] PATCH:", error);
    return NextResponse.json({ success: false, error: "Failed to update property" }, { status: 500 });
  }
}

/**
 * STRICT ARCHITECTURAL CONSTRAINT: ZERO HARD DELETE POLICY
 * No property records may be hard-deleted from the database.
 * Historical data, analytics attribution, and canonical properties are permanent records.
 * De-listing from active inventory is performed strictly via PATCH with status='archived'.
 */
export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: "Method Not Allowed. Hard delete is strictly prohibited for all properties. Properties must be archived via PATCH status='archived'.",
    },
    {
      status: 405,
      headers: {
        Allow: "GET, PATCH",
      },
    }
  );
}
