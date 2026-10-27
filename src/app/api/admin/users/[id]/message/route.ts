import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendTelegramDirectMessage } from "@/lib/telegramServer";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminSession = await getAdminSessionServer();
    if (!adminSession || adminSession.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = params?.id;
    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const text = typeof body?.text === "string" ? body.text.trim() : typeof body?.message === "string" ? body.message.trim() : "";
    if (!text || text.length < 1) {
      return NextResponse.json(
        { success: false, error: "Xabar matni bo‘sh bo‘lishi mumkin emas" },
        { status: 400 }
      );
    }

    // 1. Resolve user and their Telegram ID
    let targetTelegramUserId: number | null = null;
    let targetUserName: string = "Foydalanuvchi";

    // First check profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, telegram_user_id, telegram_username")
      .eq("id", userId)
      .maybeSingle();

    if (profile) {
      if (profile.telegram_user_id) {
        targetTelegramUserId = Number(profile.telegram_user_id);
      }
      if (profile.full_name) {
        targetUserName = profile.full_name;
      }
    }

    // If not found in profile directly, check if userId itself is a Telegram ID format (e.g. tg_12345678 or pure digits)
    if (!targetTelegramUserId) {
      if (userId.startsWith("tg_")) {
        const parsed = parseInt(userId.replace("tg_", ""), 10);
        if (!isNaN(parsed) && parsed > 0) {
          targetTelegramUserId = parsed;
        }
      } else if (/^\d+$/.test(userId)) {
        const parsed = parseInt(userId, 10);
        if (!isNaN(parsed) && parsed > 0) {
          targetTelegramUserId = parsed;
        }
      }
    }

    // Check telegram_users table as secondary fallback
    if (!targetTelegramUserId) {
      const { data: tgUser } = await supabaseAdmin
        .from("telegram_users")
        .select("telegram_user_id, first_name, last_name, username")
        .eq("telegram_user_id", userId)
        .maybeSingle();

      if (tgUser?.telegram_user_id) {
        targetTelegramUserId = Number(tgUser.telegram_user_id);
        targetUserName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || tgUser.username || targetUserName;
      }
    }

    // Check if phone matches any known telegram_users
    if (!targetTelegramUserId && profile?.phone) {
      const { data: tgUserByPhone } = await supabaseAdmin
        .from("telegram_users")
        .select("telegram_user_id, first_name, last_name, username")
        .eq("phone", profile.phone)
        .maybeSingle();

      if (tgUserByPhone?.telegram_user_id) {
        targetTelegramUserId = Number(tgUserByPhone.telegram_user_id);
      }
    }

    // Strict Rule: If user has not started the bot, Telegram does NOT allow bot to initiate conversation
    if (!targetTelegramUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "TELEGRAM_NOT_CONNECTED",
          message:
            "Foydalanuvchi Telegram botni ishga tushirmagan. Telegram qoidalariga ko‘ra, bot foydalanuvchiga birinchi bo‘lib yozolmaydi. Foydalanuvchi avval botga /start buyrug‘ini berishi kerak.",
        },
        { status: 400 }
      );
    }

    // 2. Format admin message
    const formattedMessage =
      `📬 <b>ANGREN ESTATE ma’muriyatidan xabar:</b>\n\n` +
      `${text}\n\n` +
      `<i>Hurmat bilan, ANGREN ESTATE jamoasi</i>\n` +
      `🌐 https://angrenestate.uz`;

    // 3. Dispatch to Telegram
    const tgRes = await sendTelegramDirectMessage(
      targetTelegramUserId,
      formattedMessage,
      {
        inline_keyboard: [
          [
            {
              text: "🌐 Saytga o‘tish",
              url: "https://angrenestate.uz",
            },
            {
              text: "📞 Aloqa",
              url: "https://angrenestate.uz/contact",
            },
          ],
        ],
      }
    );

    if (!tgRes.ok) {
      let friendlyError = tgRes.description || "Telegram xabari yuborilmadi";
      if (tgRes.error_code === 403) {
        friendlyError =
          "Foydalanuvchi Telegram botni bloklagan yoki chatni to‘xtatgan. Xabar yetkazilmadi.";
      } else if (tgRes.error_code === 400 && tgRes.description?.includes("chat not found")) {
        friendlyError =
          "Telegram chat topilmadi. Foydalanuvchi botni hali ishga tushirmagan bo‘lishi mumkin.";
      }

      return NextResponse.json(
        {
          success: false,
          error: "TELEGRAM_DELIVERY_FAILED",
          message: friendlyError,
          telegram_error_code: tgRes.error_code,
          details: tgRes.description,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Xabar ${targetUserName} ga muvaffaqiyatli yetkazildi`,
      message_id: tgRes.result?.message_id,
      telegram_user_id: targetTelegramUserId,
    });
  } catch (err: any) {
    console.error("[Admin Users Send Message API] Exception:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
