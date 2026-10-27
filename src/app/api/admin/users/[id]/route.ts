import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const VALID_USER_ID_REGEX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|tg_\d+|\d+|[a-zA-Z0-9_\-\.]+)$/i;

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
    if (!userId || !VALID_USER_ID_REGEX.test(userId)) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
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

    // Fetch target user from Supabase profiles or auth.users / telegram registry
    let targetUser: any = null;
    let existingProfileRow: boolean = false;

    const { data: profileUser, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileUser) {
      targetUser = profileUser;
      existingProfileRow = true;
    } else {
      // 1. Check auth.users for Google/Email users without profiles row
      try {
        const { data: auData } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (auData?.user) {
          const au = auData.user;
          targetUser = {
            id: au.id,
            email: au.email || "",
            full_name:
              au.user_metadata?.full_name ||
              au.user_metadata?.name ||
              (au.email ? au.email.split("@")[0] : "Foydalanuvchi"),
            avatar_url: au.user_metadata?.avatar_url || au.user_metadata?.picture || null,
            role: "user",
            status: "active",
            created_at: au.created_at,
            updated_at: new Date().toISOString(),
          };
        }
      } catch {}

      // 2. Check app_settings telegram_users_registry if userId starts with tg_
      if (!targetUser && userId.startsWith("tg_")) {
        const tgNum = parseInt(userId.replace("tg_", ""), 10);
        try {
          const { data: regRow } = await supabaseAdmin
            .from("app_settings")
            .select("value")
            .eq("key", "telegram_users_registry")
            .maybeSingle();

          if (Array.isArray(regRow?.value)) {
            const sub = regRow.value.find((s: any) => Number(s.telegram_user_id || s.id) === tgNum);
            if (sub) {
              targetUser = {
                id: userId,
                email: sub.username ? `@${sub.username}` : `${userId}@angrenestate.uz`,
                full_name:
                  [sub.first_name, sub.last_name].filter(Boolean).join(" ") ||
                  sub.username ||
                  "Telegram foydalanuvchisi",
                phone: sub.phone || null,
                role: "user",
                status: sub.status || "active",
                telegram_user_id: tgNum,
                created_at: sub.registered_at || sub.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            }
          }
        } catch {}

        if (!targetUser) {
          targetUser = {
            id: userId,
            email: `${userId}@angrenestate.uz`,
            full_name: `Telegram Foydalanuvchisi (${tgNum})`,
            role: "user",
            status: "active",
            telegram_user_id: tgNum,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }
    }

    if (!targetUser) {
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

    if (userId.startsWith("tg_")) {
      // Update in telegram_users_registry in app_settings
      try {
        const tgNum = parseInt(userId.replace("tg_", ""), 10);
        const { data: regRow } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "telegram_users_registry")
          .maybeSingle();

        if (Array.isArray(regRow?.value)) {
          const updatedRegistry = regRow.value.map((s: any) => {
            if (Number(s.telegram_user_id || s.id) === tgNum) {
              return { ...s, ...updates, updated_at: new Date().toISOString() };
            }
            return s;
          });

          await supabaseAdmin
            .from("app_settings")
            .update({ value: updatedRegistry, updated_at: new Date().toISOString() })
            .eq("key", "telegram_users_registry");
        }
      } catch (tgUpdateErr) {
        console.warn("[Admin Users API] Error updating telegram registry:", tgUpdateErr);
      }

      updatedUser = { ...targetUser, ...updates };
    } else if (!existingProfileRow) {
      // User is from auth.users without a profile row yet; upsert into profiles
      const profilePayload: Record<string, any> = {
        id: userId,
        email: targetUser.email,
        full_name: targetUser.full_name,
        avatar_url: targetUser.avatar_url,
        role: role !== undefined ? role : targetUser.role || "user",
        updated_at: new Date().toISOString(),
      };
      if (status !== undefined) profilePayload.status = status;

      const { data: insertData, error: insertError } = await supabaseAdmin
        .from("profiles")
        .upsert(profilePayload)
        .select()
        .maybeSingle();

      if (insertError && (insertError.message?.includes("status") || insertError.code === "PGRST204" || insertError.code === "42703")) {
        delete profilePayload.status;
        const { data: fallbackData } = await supabaseAdmin
          .from("profiles")
          .upsert(profilePayload)
          .select()
          .maybeSingle();
        updatedUser = fallbackData || { ...targetUser, ...updates };
        updatedUser.status = status || "active";
      } else if (insertError) {
        console.error("[Admin Users API] Error creating profile row:", insertError);
        updatedUser = { ...targetUser, ...updates };
      } else {
        updatedUser = insertData || { ...targetUser, ...updates };
      }
    } else {
      // Existing profile row: perform update
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
