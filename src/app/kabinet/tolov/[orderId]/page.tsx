"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Copy, CreditCard, Loader2, Upload, AlertTriangle, Ban, FileText } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/context/AuthContext";
import { useTelegram } from "@/context/TelegramContext";
import { useLanguage } from "@/context/LanguageContext";
import { ORDER_LABELS, REFUND_LABELS, StatusPill, formatDate, formatSum, monApi, type Locale } from "@/lib/monetization/client";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Manual card payment page of one order. The amount and the card come from the
 * server; the customer transfers the money in a bank app and uploads the receipt.
 * Only an admin can confirm the payment (after checking the bank).
 */
export default function PaymentPageRoute() {
  return (
    <>
      <Header />
      <PaymentPage />
    </>
  );
}

function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { locale: raw } = useLanguage();
  const locale: Locale = raw === "ru" ? "ru" : "uz";
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { user, loading: authLoading, handleGoogleLogin } = useAuth();
  const { isTelegram } = useTelegram();
  const canUse = Boolean(user) || isTelegram;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await monApi(`/api/payments/orders/${orderId}`, {}, locale);
    if (r.ok) {
      setData(r.data.data);
      setError(null);
    } else setError(r.message || null);
    setLoading(false);
  }, [orderId, locale]);

  useEffect(() => {
    if (canUse) load();
    else setLoading(false);
  }, [canUse, load]);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* the value is visible anyway */
    }
  }

  async function send() {
    setError(null);
    setNotice(null);
    if (!file) return setError(t("Chek faylini tanlang (JPG, PNG yoki PDF)", "Выберите файл чека (JPG, PNG или PDF)"));
    if (file.size > MAX_BYTES) return setError(t("Fayl 10 MB dan oshmasin", "Файл не больше 10 МБ"));
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    if (note.trim()) fd.append("note", note.trim());
    const r = await monApi(`/api/payments/orders/${orderId}/receipt`, { method: "POST", body: fd }, locale);
    setBusy(false);
    if (!r.ok) return setError(r.message || null);
    setFile(null);
    setNote("");
    setNotice(t("Chek yuborildi. Admin bank tushumini tekshirgach, to‘lov tasdiqlanadi.", "Чек отправлен. После проверки поступления администратор подтвердит оплату."));
    await load();
  }

  async function cancel() {
    if (!window.confirm(t("Buyurtmani bekor qilasizmi?", "Отменить заказ?"))) return;
    setBusy(true);
    const r = await monApi(`/api/payments/orders/${orderId}`, { method: "DELETE" }, locale);
    setBusy(false);
    if (!r.ok) return setError(r.message || null);
    setNotice(t("Buyurtma bekor qilindi.", "Заказ отменён."));
    await load();
  }

  if (!canUse) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-black text-slate-900">{t("To‘lov", "Оплата")}</h1>
        {authLoading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#167d4f]" />
        ) : (
          <button onClick={() => handleGoogleLogin(`/kabinet/tolov/${orderId}`)} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">
            {t("Google orqali kirish", "Войти через Google")}
          </button>
        )}
      </main>
    );
  }

  const order = data?.order;
  const status: string = order?.status || "";
  const reviewing = status === "RECEIPT_SUBMITTED" || status === "UNDER_REVIEW";

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <Link href="/kabinet" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {t("Mening e'lonlarim", "Мои объявления")}
      </Link>

      {loading && !data && (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#167d4f]" /></div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
        </div>
      )}

      {order && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#167d4f] text-white"><CreditCard className="h-5 w-5" /></div>
              <div>
                <h1 className="text-base font-black text-slate-900">{t("Kartaga to‘lov", "Оплата на карту")}</h1>
                <p className="text-[11px] text-slate-500">{order.id} · {formatDate(order.created_at, locale)}</p>
              </div>
            </div>
            <StatusPill label={ORDER_LABELS[status]} locale={locale} />
          </div>
          <div className="space-y-1 rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>{order.service === "listing" ? (order.plan_snapshot?.listing_tier === "premium" ? "Premium" : t("Standart e'lon", "Стандарт")) : t("Stiker", "Стикер")}</span>
              <span className="font-bold">{formatSum(order.base_amount_uzs, locale)}</span>
            </div>
            {order.discount_uzs > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>{order.discount_source === "promotion" ? t("Aksiya", "Акция") : t("Promokod", "Промокод")}</span>
                <span className="font-bold">−{formatSum(order.discount_uzs, locale)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-black text-slate-900">
              <span>{t("To‘lov summasi", "К оплате")}</span>
              <span>{formatSum(order.final_amount_uzs, locale)}</span>
            </div>
          </div>
        </section>
      )}

      {order && order.status_reason && (status === "REJECTED" || status === "INFO_REQUESTED") && (
        <div className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><b>{status === "REJECTED" ? t("To‘lov rad etildi:", "Оплата отклонена:") : t("Admin so‘radi:", "Администратор просит:")}</b> {order.status_reason}</p>
        </div>
      )}

      {data?.expired && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("Buyurtma muddati tugagan. “Mening e'lonlarim”dan to‘lovni qaytadan boshlang.", "Срок заказа истёк. Начните оплату заново в «Мои объявления».")}
        </div>
      )}

      {data?.payable && !data?.card && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {t("Kartaga to‘lov qabul qilish hozircha o‘chirilgan. Buyurtmangiz saqlanib turadi.", "Приём оплаты на карту сейчас отключён. Ваш заказ сохранён.")}
        </div>
      )}

      {data?.payable && data?.card && (
        <>
          <section className="space-y-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-[#eaf5f0] to-white p-4">
            <h2 className="text-sm font-black text-slate-900">{t("1. Bank ilovasi orqali shu kartaga o‘tkazing", "1. Переведите на эту карту через банковское приложение")}</h2>
            {[
              { k: "card", label: t("Karta raqami", "Номер карты"), value: data.card.card_number.replace(/\s/g, ""), show: data.card.card_number, big: true },
              { k: "holder", label: t("Karta egasi", "Владелец карты"), value: data.card.holder_name, show: data.card.holder_name },
              ...(data.card.bank_name ? [{ k: "bank", label: t("Bank", "Банк"), value: data.card.bank_name, show: data.card.bank_name }] : []),
              { k: "sum", label: t("Summa", "Сумма"), value: String(order.final_amount_uzs), show: formatSum(order.final_amount_uzs, locale), big: true },
              { k: "id", label: t("Izohga: buyurtma ID", "В комментарий: ID заказа"), value: order.id, show: order.id },
            ].map((row: any) => (
              <div key={row.k} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{row.label}</p>
                  <p className={`font-black text-slate-900 ${row.big ? "whitespace-nowrap text-base tracking-wide sm:text-lg" : "break-all text-sm"}`}>{row.show}</p>
                </div>
                <button type="button" onClick={() => copy(row.k, row.value)} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700">
                  <Copy className="h-3.5 w-3.5" /> {copied === row.k ? t("Nusxalandi", "Скопировано") : t("Nusxa", "Копия")}
                </button>
              </div>
            ))}
            {data.card.instructions && <p className="rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-700">{data.card.instructions}</p>}
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-black text-slate-900">{t("2. To‘lov chekini yuklang", "2. Загрузите чек оплаты")}</h2>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:bg-slate-50">
              <Upload className="h-6 w-6 text-[#167d4f]" />
              <span className="text-sm font-bold text-slate-800">{file ? file.name : t("Chek faylini tanlang", "Выберите файл чека")}</span>
              <span className="text-[11px] text-slate-500">{file ? `${Math.ceil(file.size / 1024)} KB` : t("JPG, PNG yoki PDF, 10 MB gacha", "JPG, PNG или PDF, до 10 МБ")}</span>
              <input type="file" data-testid="receipt-input" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
              placeholder={t("Izoh (ixtiyoriy): qaysi ilovadan, soat nechada", "Комментарий (необязательно): из какого приложения, во сколько")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#167d4f]" />
            <button type="button" onClick={send} disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#167d4f] py-3 text-sm font-black text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {t("Chekni yuborish", "Отправить чек")}
            </button>
          </section>

          <button type="button" onClick={cancel} disabled={busy}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-600">
            <Ban className="h-4 w-4" /> {t("Buyurtmani bekor qilish", "Отменить заказ")}
          </button>
        </>
      )}

      {reviewing && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <Clock className="mx-auto h-10 w-10 text-sky-600" />
          <p className="mt-2 text-base font-black text-slate-900">{t("Chek yuborildi — admin tekshirmoqda", "Чек отправлен — администратор проверяет")}</p>
          <p className="mt-1 text-sm text-slate-500">
            {order?.service === "listing"
              ? t("Tasdiqlangach e'lon moderatsiyaga o‘tadi.", "После подтверждения объявление уйдёт на модерацию.")
              : t("Tasdiqlangach stiker admin tasdig‘iga o‘tadi.", "После подтверждения стикер уйдёт на одобрение.")}
          </p>
        </section>
      )}

      {status === "PAID" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="mt-2 text-base font-black text-slate-900">{t("To‘lov tasdiqlangan", "Оплата подтверждена")} — {formatSum(order.final_amount_uzs, locale)}</p>
          {data?.refund && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-600">
              {t("Pul qaytarish", "Возврат")}: <StatusPill label={REFUND_LABELS[data.refund.status]} locale={locale} />
            </div>
          )}
          <Link href="/kabinet" className="mt-4 inline-block rounded-2xl bg-[#167d4f] px-4 py-2.5 text-sm font-bold text-white">{t("Mening e'lonlarim", "Мои объявления")}</Link>
        </section>
      )}

      {data?.receipts?.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-black text-slate-900">{t("Yuborilgan cheklar", "Отправленные чеки")}</h2>
          <ul className="space-y-1 text-xs text-slate-500">
            {data.receipts.map((r: any) => (
              <li key={r.id} className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> {r.mime === "application/pdf" ? "PDF" : r.mime === "image/png" ? "PNG" : "JPG"} · {Math.ceil(r.size_bytes / 1024)} KB · {formatDate(r.created_at, locale)} ·{" "}
                {r.state === "accepted" ? t("qabul qilindi", "принят") : r.state === "rejected" ? t("rad etildi", "отклонён") : r.state === "superseded" ? t("almashtirildi", "заменён") : t("tekshiruvda", "на проверке")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">{t("Chek fayllarini faqat admin ko‘radi.", "Файлы чеков видит только администратор.")}</p>
        </section>
      )}
    </main>
  );
}
