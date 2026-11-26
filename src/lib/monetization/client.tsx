"use client";

import { getApiAuthHeaders } from "@/lib/authHeaders";

/** Browser helpers for the monetization screens (no secrets, no prices computed here). */

export type Locale = "uz" | "ru";

export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
  message?: string;
}

/** Call our API with the visitor's verified credentials (Supabase JWT and/or Telegram initData). */
export async function monApi<T = any>(url: string, init: RequestInit = {}, locale: Locale = "uz"): Promise<ApiResult<T>> {
  const auth = await getApiAuthHeaders();
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...auth, ...(init.headers || {}) },
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  const ok = res.ok && json?.success !== false;
  return {
    ok,
    status: res.status,
    data: json,
    error: ok ? undefined : json?.error || "internal",
    message: ok ? undefined : json?.message?.[locale] || json?.message || (locale === "uz" ? "Xatolik yuz berdi" : "Произошла ошибка"),
  };
}

export function formatSum(value: number | null | undefined, locale: Locale = "uz"): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toLocaleString("ru-RU").replace(/,/g, " ")} ${locale === "uz" ? "so‘m" : "сум"}`;
}

export function formatDate(value: string | null | undefined, locale: Locale = "uz"): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString(locale === "uz" ? "uz-UZ" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

type Label = { uz: string; ru: string; tone: string };

export const MODERATION_LABELS: Record<string, Label> = {
  AWAITING_PAYMENT: { uz: "To‘lov kutilmoqda", ru: "Ожидает оплаты", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_REVIEW: { uz: "Moderatsiyada", ru: "На модерации", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  REVISION_REQUIRED: { uz: "Tuzatish kerak", ru: "Нужно исправить", tone: "bg-orange-50 text-orange-700 border-orange-200" },
  APPROVED: { uz: "Tasdiqlandi", ru: "Одобрено", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { uz: "Rad etildi", ru: "Отклонено", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  CANCELLED_BY_USER: { uz: "Bekor qilindi", ru: "Отменено", tone: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const ORDER_LABELS: Record<string, Label> = {
  PENDING: { uz: "To‘lanmagan", ru: "Не оплачен", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  PAID: { uz: "To‘langan", ru: "Оплачен", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  FAILED: { uz: "To‘lov o‘tmadi", ru: "Оплата не прошла", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  CANCELLED: { uz: "Bekor qilingan", ru: "Отменён", tone: "bg-slate-100 text-slate-600 border-slate-200" },
  REFUNDED: { uz: "Pul qaytarildi", ru: "Возвращён", tone: "bg-violet-50 text-violet-700 border-violet-200" },
};

export const REFUND_LABELS: Record<string, Label> = {
  REQUESTED: { uz: "Qaytarish so‘raldi", ru: "Возврат запрошен", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  PROCESSING: { uz: "Qaytarilmoqda", ru: "Возврат в процессе", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  SUCCEEDED: { uz: "Pul qaytarildi", ru: "Деньги возвращены", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  FAILED: { uz: "Qaytarish o‘tmadi", ru: "Возврат не удался", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  MANUAL_REQUIRED: { uz: "Qo‘lda qaytariladi", ru: "Возврат вручную", tone: "bg-orange-50 text-orange-700 border-orange-200" },
  MANUAL_CONFIRMED: { uz: "Pul qaytarildi (qo‘lda)", ru: "Возвращено вручную", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const BOOST_LABELS: Record<string, Label> = {
  AWAITING_PAYMENT: { uz: "To‘lov kutilmoqda", ru: "Ожидает оплаты", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_APPROVAL: { uz: "Admin tasdig‘ida", ru: "На одобрении", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  ACTIVE: { uz: "Faol", ru: "Активен", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  EXPIRED: { uz: "Muddati tugagan", ru: "Срок истёк", tone: "bg-slate-100 text-slate-600 border-slate-200" },
  SCHEDULED: { uz: "Navbatda", ru: "В очереди", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  REJECTED: { uz: "Rad etildi", ru: "Отклонён", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  CANCELLED: { uz: "Bekor qilingan", ru: "Отменён", tone: "bg-slate-100 text-slate-600 border-slate-200" },
  REVOKED: { uz: "To‘xtatilgan", ru: "Отозван", tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const STICKER_LABELS: Record<string, { uz: string; ru: string }> = {
  top: { uz: "TOP", ru: "ТОП" },
  tez_sotiladi: { uz: "Tez sotiladi", ru: "Срочно" },
  yaxshi_taklif: { uz: "Yaxshi taklif", ru: "Выгодно" },
};

export const PROPERTY_TYPE_LABELS: Record<string, { uz: string; ru: string }> = {
  apartment: { uz: "Kvartira", ru: "Квартира" },
  house: { uz: "Hovli / Uy", ru: "Дом" },
  commercial: { uz: "Tijorat", ru: "Коммерция" },
  land: { uz: "Yer", ru: "Земля" },
  other: { uz: "Boshqa", ru: "Другое" },
};

export function boostDisplayStatus(b: { status: string; starts_at?: string | null; ends_at?: string | null }): string {
  if (b.status !== "ACTIVE") return b.status;
  const now = Date.now();
  if (b.ends_at && Date.parse(b.ends_at) <= now) return "EXPIRED";
  if (b.starts_at && Date.parse(b.starts_at) > now) return "SCHEDULED";
  return "ACTIVE";
}

export function StatusPill({ label, locale }: { label?: Label; locale: Locale }) {
  if (!label) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${label.tone}`}>
      {label[locale]}
    </span>
  );
}
