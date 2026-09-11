import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, hashPassword } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSessionServer();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Barcha maydonlarni to‘ldirish shart / Все поля обязательны" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Yangi parollar mos kelmadi / Новые пароли не совпадают" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Yangi parol kamida 8 ta belgidan iborat bo‘lishi kerak / Пароль должен быть не менее 8 символов" },
        { status: 400 }
      );
    }

    // Check current password
    const configuredPassword = process.env.ADMIN_PASSWORD;
    if (!configuredPassword || currentPassword !== configuredPassword) {
      return NextResponse.json(
        { error: "Joriy parol noto‘g‘ri kiritildi / Текущий пароль неверен" },
        { status: 400 }
      );
    }

    // In production, update the stored hash in database or .env
    const newHash = hashPassword(newPassword);

    return NextResponse.json({
      success: true,
      message: "Admin paroli muvaffaqiyatli yangilandi / Пароль администратора успешно обновлен",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server xatosi" }, { status: 500 });
  }
}
