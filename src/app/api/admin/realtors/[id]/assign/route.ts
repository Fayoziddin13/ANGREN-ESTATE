import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function verifyAuth(request: NextRequest) {
  const session = await getAdminSessionServer();
  if (session) return session;

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
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
 * Explicit Property Assignment & Unassignment Endpoint
 * Allows administrators to assign or unassign properties to/from a specific realtor.
 * Guarantees zero auto-assignment and strict target-property isolation.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required" },
        { status: 401 }
      );
    }

    const { id: realtorId } = params;
    if (!realtorId || typeof realtorId !== "string") {
      return NextResponse.json({ success: false, error: "Realtor ID is required" }, { status: 400 });
    }

    // 1. Verify realtor exists
    const { data: realtor, error: realtorError } = await supabaseAdmin
      .from("realtors")
      .select("id, name")
      .eq("id", realtorId)
      .single();

    if (realtorError || !realtor) {
      return NextResponse.json(
        { success: false, error: `Realtor with ID '${realtorId}' not found` },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { property_id, property_ids, action = "assign" } = body;

    const targetPropertyIds: string[] = [];
    if (property_id && typeof property_id === "string") {
      targetPropertyIds.push(property_id.trim());
    }
    if (Array.isArray(property_ids)) {
      for (const pid of property_ids) {
        if (typeof pid === "string" && pid.trim() && !targetPropertyIds.includes(pid.trim())) {
          targetPropertyIds.push(pid.trim());
        }
      }
    }

    if (targetPropertyIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one property_id or property_ids must be provided" },
        { status: 400 }
      );
    }

    if (action !== "assign" && action !== "unassign") {
      return NextResponse.json(
        { success: false, error: "action must be either 'assign' or 'unassign'" },
        { status: 400 }
      );
    }

    // 2. Perform explicit update
    const targetRealtorId = action === "assign" ? realtorId : null;
    const { data: updatedProps, error: updateError } = await supabaseAdmin
      .from("properties")
      .update({
        realtor_id: targetRealtorId,
        updated_at: new Date().toISOString(),
      })
      .in("id", targetPropertyIds)
      .select("id, title_uz, realtor_id");

    if (updateError) {
      console.error("[Property Assignment Error]:", updateError.message);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updatedProps || updatedProps.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matching properties found to update" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      realtor_id: targetRealtorId,
      realtor_name: realtor.name,
      updated_count: updatedProps?.length || 0,
      updated_properties: updatedProps || [],
      message:
        action === "assign"
          ? `${updatedProps?.length || 0} ta obyekt muvaffaqiyatli biriktirildi`
          : `${updatedProps?.length || 0} ta obyekt biriktiruvi bekor qilindi`,
    });
  } catch (error: any) {
    console.error("[Property Assignment Exception]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
