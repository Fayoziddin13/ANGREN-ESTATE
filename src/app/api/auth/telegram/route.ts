import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData, isTelegramUserRegistered } from "@/lib/telegramServer";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { UserProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const initData = body?.initData;

    if (!initData || typeof initData !== "string") {
      return NextResponse.json(
        { error: "initData is required" },
        { status: 400 }
      );
    }

    // 1. Server-side cryptographic HMAC-SHA256 validation
    const validation = validateTelegramInitData(initData);
    if (!validation.valid || !validation.user) {
      return NextResponse.json(
        { error: validation.error || "Invalid Telegram signature" },
        { status: 401 }
      );
    }

    const tgUser = validation.user;

    // 2. Server-side Registration Gate
    // User must be registered in the Telegram bot with a shared phone number
    const { is_registered, user: subscriber } = await isTelegramUserRegistered(tgUser.id);
    if (!is_registered) {
      return NextResponse.json(
        {
          success: false,
          access_granted: false,
          is_registered: false,
          error: "NOT_REGISTERED",
          message: "Mini App'dan foydalanish uchun avval ro‘yxatdan o‘ting.",
        },
        { status: 403 }
      );
    }

    const fullName =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") ||
      tgUser.username ||
      "Telegram User";
    const syntheticEmail = tgUser.username
      ? `@${tgUser.username}`
      : `tg_${tgUser.id}@angrenestate.uz`;

    let profileUserId = `tg_${tgUser.id}`;
    let userRole: "user" | "admin" = "user";
    let userStatus: "active" | "disabled" = "active";

    // 3. Sync to Supabase profiles table if available
    try {
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, role, status, full_name, avatar_url, phone")
        .or(`id.eq.${profileUserId},email.eq.${syntheticEmail}`)
        .maybeSingle();

      if (existingProfile) {
        profileUserId = existingProfile.id;
        userRole = existingProfile.role === "admin" ? "admin" : "user";
        userStatus = existingProfile.status === "disabled" ? "disabled" : "active";

        if (userStatus === "disabled") {
          return NextResponse.json(
            { error: "Hisob ma’muriyat tomonidan bloklangan" },
            { status: 403 }
          );
        }

        // Update profile details non-destructively
        await supabaseAdmin
          .from("profiles")
          .update({
            full_name: fullName,
            avatar_url: tgUser.photo_url || existingProfile.avatar_url,
            phone: subscriber?.phone || existingProfile.phone || null,
            last_activity: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", profileUserId);
      } else {
        // Safe insert new Telegram user profile
        await supabaseAdmin.from("profiles").insert({
          id: profileUserId,
          email: syntheticEmail,
          full_name: fullName,
          avatar_url: tgUser.photo_url || null,
          phone: subscriber?.phone || null,
          role: "user",
          status: "active",
          last_activity: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (dbErr) {
      console.warn("[Telegram Auth] Database sync fallback:", dbErr);
    }

    const userProfile: UserProfile = {
      id: profileUserId,
      email: syntheticEmail,
      full_name: fullName,
      avatar_url: tgUser.photo_url,
      phone: subscriber?.phone,
      role: userRole,
      status: userStatus,
    };

    return NextResponse.json({
      success: true,
      access_granted: true,
      is_registered: true,
      user: userProfile,
      subscriber,
    });
  } catch (err: any) {
    console.error("[Telegram Auth API] Exception:", err);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
