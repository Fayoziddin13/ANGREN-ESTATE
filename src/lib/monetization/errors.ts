import { NextResponse } from "next/server";

/**
 * Business errors of the monetization module. SQL functions raise them as
 * "MON:<code>"; the server maps them to an HTTP status and a message in both
 * site languages, so the UI can show them as they are.
 */
const MESSAGES: Record<string, { uz: string; ru: string; status: number }> = {
  monetization_disabled: { status: 409, uz: "Pullik xizmatlar hozircha o‘chirilgan", ru: "Платные услуги сейчас отключены" },
  account_blocked: { status: 403, uz: "Hisobingiz bloklangan", ru: "Ваш аккаунт заблокирован" },
  account_not_found: { status: 404, uz: "Hisob topilmadi", ru: "Аккаунт не найден" },
  registration_required: {
    status: 401,
    uz: "Davom etish uchun Google yoki Telegram orqali kiring",
    ru: "Войдите через Google или Telegram, чтобы продолжить",
  },
  no_price: { status: 409, uz: "Bu xizmat uchun narx hali belgilanmagan", ru: "Цена для этой услуги ещё не установлена" },
  not_found: { status: 404, uz: "Topilmadi", ru: "Не найдено" },
  not_awaiting_payment: { status: 409, uz: "Bu ariza to‘lov kutmayapti", ru: "Эта заявка не ожидает оплаты" },
  invalid_state: { status: 409, uz: "Bu amal hozirgi holatda mumkin emas", ru: "Это действие недоступно в текущем статусе" },
  reason_required: { status: 400, uz: "Sababini yozing", ru: "Укажите причину" },
  revision_limit: {
    status: 409,
    uz: "Tuzatish urinishlari tugadi: arizani tasdiqlang yoki rad eting",
    ru: "Лимит исправлений исчерпан: одобрите или отклоните заявку",
  },
  property_required: { status: 400, uz: "Obyekt yaratilmadi", ru: "Объект не создан" },
  order_not_paid: { status: 409, uz: "Buyurtma to‘lanmagan", ru: "Заказ не оплачен" },
  invalid_transition: { status: 409, uz: "Qaytarish holatini bunday o‘zgartirib bo‘lmaydi", ru: "Недопустимое изменение статуса возврата" },
  reference_required: { status: 400, uz: "To‘lov tizimidagi qaytarish raqamini kiriting", ru: "Укажите номер возврата в платёжной системе" },
  invalid_status: { status: 400, uz: "Noto‘g‘ri holat", ru: "Неверный статус" },
  invalid_action: { status: 400, uz: "Noto‘g‘ri amal", ru: "Неверное действие" },
  not_owner: { status: 403, uz: "Bu e'lon sizga tegishli emas", ru: "Это объявление вам не принадлежит" },
  not_published: { status: 409, uz: "Stiker faqat chop etilgan e'longa olinadi", ru: "Стикер можно купить только для опубликованного объявления" },
  already_pending: {
    status: 409,
    uz: "Bu stiker uchun ko‘rib chiqilayotgan so‘rov bor",
    ru: "Для этого стикера уже есть запрос на рассмотрении",
  },
  property_missing: { status: 409, uz: "Obyekt o‘chirilgan", ru: "Объект удалён" },
  validation: { status: 400, uz: "Ma’lumotlar noto‘g‘ri to‘ldirilgan", ru: "Данные заполнены неверно" },
  upload_failed: { status: 400, uz: "Rasmni yuklab bo‘lmadi", ru: "Не удалось загрузить фото" },
  payment_unavailable: {
    status: 503,
    uz: "To‘lov tizimi hali ulanmagan",
    ru: "Платёжная система ещё не подключена",
  },
  payments_closed: { status: 409, uz: "Kartaga to‘lov qabul qilish hozircha o‘chirilgan", ru: "Приём оплаты на карту сейчас отключён" },
  receipt_reused: { status: 409, uz: "Bu chek avval ishlatilgan — boshqa chek yuboring", ru: "Этот чек уже использован — отправьте другой" },
  receipt_under_review: { status: 409, uz: "Chek yuborilgan, admin tekshirmoqda", ru: "Чек отправлен, администратор проверяет" },
  payment_under_review: {
    status: 409,
    uz: "Chekingiz tekshirilmoqda — admin qaror qilgach bekor qilish mumkin",
    ru: "Ваш чек проверяется — отменить можно после решения администратора",
  },
  order_expired: { status: 409, uz: "Buyurtma muddati tugagan — qaytadan to‘lovni boshlang", ru: "Срок заказа истёк — начните оплату заново" },
  order_closed: { status: 409, uz: "Buyurtma yopilgan", ru: "Заказ закрыт" },
  already_paid: { status: 409, uz: "Bu buyurtma allaqachon to‘langan", ru: "Этот заказ уже оплачен" },
  nothing_to_review: { status: 409, uz: "Tekshirish uchun chek yo‘q", ru: "Нет чека для проверки" },
  invalid_receipt: { status: 400, uz: "Chek fayli noto‘g‘ri", ru: "Неверный файл чека" },
  invalid_card: { status: 400, uz: "Karta raqami 16 ta raqam bo‘lsin", ru: "Номер карты должен содержать 16 цифр" },
  invalid_holder: { status: 400, uz: "Karta egasining ismini yozing", ru: "Укажите имя владельца карты" },
  invalid_tier: { status: 400, uz: "Tarif noto‘g‘ri", ru: "Неверный тариф" },
  actor_required: { status: 401, uz: "Admin sifatida kiring", ru: "Войдите как администратор" },
  rate_limited: { status: 429, uz: "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring", ru: "Слишком много попыток. Попробуйте позже" },
  internal: { status: 500, uz: "Server xatosi. Qayta urinib ko‘ring", ru: "Ошибка сервера. Попробуйте ещё раз" },
};

export class MonetizationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: string;

  constructor(code: string, detail?: string) {
    const known = MESSAGES[code] || MESSAGES.internal;
    super(detail ? `${code}: ${detail}` : code);
    this.name = "MonetizationError";
    this.code = MESSAGES[code] ? code : "internal";
    this.status = known.status;
    this.detail = detail;
  }
}

/** Convert a Supabase/PostgREST error into a MonetizationError. */
export function fromDbError(error: { message?: string; code?: string } | null | undefined): MonetizationError {
  const message = error?.message || "";
  const match = message.match(/MON:([a-z_]+)/);
  if (match) return new MonetizationError(match[1]);
  console.error("[monetization] database error:", error?.code, message);
  return new MonetizationError("internal");
}

/** JSON error response for API routes. Unknown errors are logged and hidden. */
export function errorResponse(err: unknown): NextResponse {
  const e = err instanceof MonetizationError ? err : null;
  if (!e) console.error("[monetization] unexpected error:", err);
  const code = e?.code || "internal";
  const m = MESSAGES[code] || MESSAGES.internal;
  return NextResponse.json(
    { success: false, error: code, message: { uz: m.uz, ru: m.ru }, detail: e?.detail },
    { status: m.status }
  );
}
