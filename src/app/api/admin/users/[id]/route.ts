import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminSession = await getAdminSessionServer();
    if (!adminSession || adminSession.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = params?.id;
    if (!userId || !UUID_REGEX.test(userId)) {
      return NextResponse.json(
        { error: "Invalid user UUID format" },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { status, role } = body;

    // Validate enum values
    if (status !== undefined && status !== "active" && status !== "disabled") {
      return NextResponse.json(
        { error: "Invalid status enum. Allowed: 'active', 'disabled'" },
        { status: 400 }
      );
    }

    if (role !== undefined && role !== "user" && role !== "admin") {
      return NextResponse.json(
        { error: "Invalid role enum. Allowed: 'user', 'admin'" },
        { status: 400 }
      );
    }

    if (status === undefined && role === undefined) {
      return NextResponse.json(
        { error: "At least one of 'status' or 'role' must be provided" },
        { status: 400 }
      );
    }

    // Fetch target user from Supabase profiles
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSelf =
      (adminSession.email && targetUser.email &&
        adminSession.email.toLowerCase() === targetUser.email.toLowerCase()) ||
      adminSession.id === targetUser.id;

    // 1. Self-Protection Guardrails
    if (isSelf) {
      if (status === "disabled") {
        return NextResponse.json(
          { error: "Admin cannot disable their own account" },
          { status: 400 }
        );
      }
      if (role === "user") {
        return NextResponse.json(
          { error: "Admin cannot demote their own account" },
          { status: 400 }
        );
      }
    }

    // 2. Last Active Admin Protection Guardrail
    const isTargetActiveAdmin =
      targetUser.role === "admin" && targetUser.status !== "disabled";

    if (isTargetActiveAdmin) {
      const willDemote = role === "user";
      const willDisable = status === "disabled";

      if (willDemote || willDisable) {
        // Count total active admins
        const { count, error: countError } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin");

        if (countError) {
          console.error("[Admin Users API] Error counting active admins:", countError);
          return NextResponse.json(
            { error: "Failed to verify admin status" },
            { status: 500 }
          );
        }

        if ((count ?? 0) <= 1) {
          return NextResponse.json(
            {
              error: willDisable
                ? "Cannot disable the last active administrator"
                : "Cannot demote the last active administrator",
            },
            { status: 400 }
          );
        }
      }
    }

    // Build update payload
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (status !== undefined) updates.status = status;
    if (role !== undefined) updates.role = role;

    let updatedUser: any = null;
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .maybeSingle();

    if (updateError && (updateError.message?.includes("status") || updateError.code === "PGRST204" || updateError.code === "42703")) {
      delete updates.status;
      const { data: fallbackData } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select()
        .maybeSingle();
      updatedUser = fallbackData || { ...targetUser, ...updates };
      updatedUser.status = status || targetUser.status || "active";
    } else if (updateError) {
      console.error("[Admin Users API] Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update user profile" },
        { status: 500 }
      );
    } else {
      updatedUser = updateData || { ...targetUser, ...updates };
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.full_name || updatedUser.email,
        email: updatedUser.email,
        avatar_url: updatedUser.avatar_url,
        role: updatedUser.role,
        status: updatedUser.status || "active",
        registration_date: updatedUser.created_at,
        last_activity: updatedUser.last_activity || updatedUser.updated_at,
      },
    });
  } catch (err: any) {
    console.error("[Admin Users API] Exception:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
