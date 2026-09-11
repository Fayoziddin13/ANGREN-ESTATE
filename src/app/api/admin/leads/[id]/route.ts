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

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Lead ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, notes } = body;

    const validStatuses = [
      "new",
      "contacted",
      "in_progress",
      "completed",
      "cancelled",
      "closed",
    ];

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status '${status}'. Must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400 }
        );
      }
      // If status is "closed", map to "completed" in database for canonical consistency
      updates.status = status === "closed" ? "completed" : status;
    }

    if (notes !== undefined) {
      updates.notes = typeof notes === "string" ? notes.trim() : null;
    }

    const { data: updatedLead, error } = await supabaseAdmin
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select("*, realtor:realtors(id, name, phone, telegram, avatar_url)")
      .single();

    if (error) {
      console.error("[Admin Lead PATCH] Update error:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: "Lead updated successfully",
    });
  } catch (error: any) {
    console.error("[Admin Lead PATCH] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Emergency developer cleanup route ONLY.
 * Strictly NOT exposed in the Admin UI.
 * Mandates elevated authorization to prevent accidental deletion of business audit history.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Emergency maintenance check: requires explicit header confirmation
    const emergencyHeader = request.headers.get("x-emergency-purge-confirm");
    if (emergencyHeader !== "true") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Forbidden: Lead deletion is disabled in the Admin UI to preserve commercial audit history. Use status 'cancelled' instead.",
        },
        { status: 403 }
      );
    }

    const { id } = params;
    const { error } = await supabaseAdmin.from("leads").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Lead purged in emergency maintenance mode",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
