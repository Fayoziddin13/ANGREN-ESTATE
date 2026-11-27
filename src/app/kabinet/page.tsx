"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2, Plus, RefreshCw, Sparkles, X, ExternalLink, FileText } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/context/AuthContext";
import { useTelegram } from "@/context/TelegramContext";
import { useLanguage } from "@/context/LanguageContext";
import { MonetizedListingForm } from "@/components/monetization/MonetizedListingForm";
import {
  BOOST_LABELS, MODERATION_LABELS, ORDER_LABELS, PROPERTY_TYPE_LABELS, REFUND_LABELS, STICKER_LABELS,
  StatusPill, boostDisplayStatus, formatDate, formatSum, monApi, newIdempotencyKey, type Locale,
} from "@/lib/monetization/client";

/** "My listings": applications, payments, refunds and stickers of the signed-in customer. */
function KabinetInner() {
  const { locale: rawLocale } = useLanguage();
  const locale: Locale = rawLocale === "ru" ? "ru" : "uz";
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { user, loading: authLoading, handleGoogleLogin } = useAuth();
  const { isTelegram } = useTelegram();
  const search = useSearchParams();

  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [stickerFor, setStickerFor] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canUse = Boolean(user) || isTelegram;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [d, c] = await Promise.all([
      monApi("/api/listings/submissions", {}, locale),
      fetch("/api/monetization/config", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    setConfig(c);
    if (d.ok) setData(d.data);
    else setError(d.message || null);
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    if (canUse) load();
  }, [canUse, load]);

  useEffect(() => {
    fetch("/api/monetization/config", { cache: "no-store" }).then((r) => r.json()).then(setConfig).catch(() => null);
  }, []);

  async function act(key: string, fn: () => Promise<any>) {
    setBusy(key);
    setNotice(null);
    setError(null);
    try {
      const r = await fn();
      if (r && r.ok === false) setError(r.message);
      else await load();
      return r;
    } finally {
      setBusy(null);
    }
  }

  async function pay(type: "submission" | "boost", id: string) {
    const r = await act(`pay-${id}`, () =>
      monApi("/api/payments/checkout", { method: "POST", body: JSON.stringify({ target_type: type, target_id: id }) }, locale)
    );
    if (r?.ok && r.data.checkout?.redirect_url) window.location.href = r.data.checkout.redirect_url;
  }

  async function cancelSubmission(s: any) {
    const paid = s.orders?.some((o: any) => o.status === "PAID");
    const msg = paid
      ? t("Arizani bekor qilasizmi? To‘langan pul qaytariladi.", "Отменить заявку? Оплата будет возвращена.")
      : t("Arizani bekor qilasizmi?", "Отменить заявку?");
    if (!window.confirm(msg)) return;
    const r = await act(`cancel-${s.id}`, () => monApi(`/api/listings/submissions/${s.id}`, { method: "DELETE" }, locale));
    if (r?.ok) setNotice(r.data.refund_id ? t("Ariza bekor qilindi, pul qaytarish boshlandi.", "Заявка отменена, возврат запущен.") : t("Ariza bekor qilindi.", "Заявка отменена."));
  }

  async function cancelBoost(b: any) {
    if (!window.confirm(t("Stiker so‘rovini bekor qilasizmi?", "Отменить запрос стикера?"))) return;
    await act(`cancelb-${b.id}`, () => monApi(`/api/boosts/${b.id}`, { method: "DELETE" }, locale));
  }

  if (!canUse) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black text-slate-900">{t("Mening e'lonlarim", "Мои объявления")}</h1>
        {authLoading ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#167d4f]" />
        ) : (
          <>
            <p className="text-sm text-slate-500">{t("Ko‘rish uchun tizimga kiring.", "Войдите, чтобы увидеть свои объявления.")}</p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <button onClick={() => handleGoogleLogin("/kabinet")} className="px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-bold">
                {t("Google orqali kirish", "Войти через Google")}
              </button>
              {config?.dev_tools && (
                <Link href="/dev/test-login" className="px-4 py-2.5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-bold">
                  {t("Test kirishi (faqat lokal)", "Тестовый вход (только локально)")}
                </Link>
              )}
            </div>
          </>
        )}
      </main>
    );
  }

  const submissions: any[] = data?.submissions || [];
  const boosts: any[] = data?.boosts || [];
  const refunds: any[] = data?.refunds || [];
  const stickerPlans: any[] = config?.prices?.stickers || [];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t("Mening e'lonlarim", "Мои объявления")}</h1>
          <p className="text-xs text-slate-500">
            {t("Arizalar, to‘lovlar va stikerlar", "Заявки, оплаты и стикеры")}
            {data?.account?.status === "blocked" && <span className="ml-2 text-rose-600 font-bold">{t("Hisob bloklangan", "Аккаунт заблокирован")}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-100 text-xs font-bold text-slate-700">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("Yangilash", "Обновить")}
          </button>
          {config?.enabled && (
            <button data-testid="new-listing" onClick={() => { setShowNew(true); setEditing(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#167d4f] text-white text-xs font-bold">
              <Plus className="h-4 w-4" /> {t("Yangi e'lon", "Новое объявление")}
            </button>
          )}
        </div>
      </div>

      {search.get("paid") && <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">{t("To‘lov natijasi saqlandi.", "Результат оплаты сохранён.")}</p>}
      {notice && <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">{notice}</p>}
      {error && <p className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{error}</p>}
      {config && !config.enabled && (
        <p className="rounded-2xl bg-slate-100 p-3 text-xs text-slate-600">{t("Pullik xizmatlar hozircha o‘chirilgan.", "Платные услуги сейчас отключены.")}</p>
      )}

      {(showNew || editing) && (
        <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-slate-900">{editing ? t("Arizani tuzatish", "Исправить заявку") : t("Yangi e'lon arizasi", "Новая заявка")}</h2>
            <button onClick={() => { setShowNew(false); setEditing(null); load(); }}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
          <MonetizedListingForm key={editing?.id || "new"} locale={locale} devTools={config?.dev_tools} initial={editing || undefined} onDone={() => { setShowNew(false); setEditing(null); load(); }} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-700">{t("Arizalar", "Заявки")} ({submissions.length})</h2>
        {!loading && submissions.length === 0 && <p className="text-xs text-slate-500">{t("Hali ariza yo‘q.", "Заявок пока нет.")}</p>}
        {submissions.map((s) => {
          const lastOrder = s.orders?.[0];
          const orderRefunds = refunds.filter((r) => s.orders?.some((o: any) => o.id === r.order_id));
          const published = s.property?.status === "published";
          return (
            <div key={s.id} data-testid="submission-card" className="rounded-3xl bg-white border border-slate-200 p-4 flex gap-4">
              <div className="h-20 w-20 rounded-2xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                {s.cover_url ? <img src={s.cover_url} alt="" className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-slate-300" />}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={MODERATION_LABELS[s.moderation_status]} locale={locale} />
                  <span className="text-[11px] font-bold text-slate-500">
                    {s.billing === "free" ? t("Bepul", "Бесплатно") : t("Pullik", "Платно")}
                  </span>
                  {lastOrder && <StatusPill label={ORDER_LABELS[lastOrder.status]} locale={locale} />}
                  {orderRefunds.map((r) => <StatusPill key={r.id} label={REFUND_LABELS[r.status]} locale={locale} />)}
                </div>
                <p className="font-bold text-slate-900 truncate">
                  {PROPERTY_TYPE_LABELS[s.payload?.property_type]?.[locale]} · {s.payload?.location}
                </p>
                <p className="text-[11px] text-slate-500">
                  {formatDate(s.created_at, locale)}
                  {lastOrder && ` · ${formatSum(lastOrder.final_amount_uzs, locale)}`}
                </p>
                {s.admin_note && (s.moderation_status === "REVISION_REQUIRED" || s.moderation_status === "REJECTED") && (
                  <p className="text-xs rounded-xl bg-orange-50 border border-orange-200 p-2 text-orange-800">{t("Admin:", "Администратор:")} {s.admin_note}</p>
                )}
                {s.moderation_status === "APPROVED" && (
                  <p className="text-xs text-slate-600">
                    {published ? (
                      <Link href={`/properties/${s.property.id}`} className="inline-flex items-center gap-1 font-bold text-[#167d4f]">
                        {t("Saytda ko‘rish", "Смотреть на сайте")} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : t("Tasdiqlandi — admin e'lonni chop etishi kutilmoqda.", "Одобрено — ждём публикации администратором.")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {s.moderation_status === "AWAITING_PAYMENT" && (
                    <button data-testid="pay-submission" disabled={busy !== null} onClick={() => pay("submission", s.id)} className="px-3 py-1.5 rounded-xl bg-[#167d4f] text-white text-xs font-bold disabled:opacity-50">
                      {t("To‘lash", "Оплатить")}
                    </button>
                  )}
                  {s.moderation_status === "REVISION_REQUIRED" && (
                    <button onClick={() => { setEditing(s); setShowNew(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold">
                      {t("Tuzatish", "Исправить")}
                    </button>
                  )}
                  {["AWAITING_PAYMENT", "PENDING_REVIEW", "REVISION_REQUIRED"].includes(s.moderation_status) && (
                    <button disabled={busy !== null} onClick={() => cancelSubmission(s)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-50">
                      {t("Bekor qilish", "Отменить")}
                    </button>
                  )}
                  {published && config?.enabled && (
                    <button data-testid="buy-sticker" onClick={() => setStickerFor(s)} className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold inline-flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> {t("Stiker olish", "Купить стикер")}
                    </button>
                  )}
                </div>
                {stickerFor?.id === s.id && (
                  <StickerPurchase locale={locale} submission={s} plans={stickerPlans} paymentsOn={config?.sticker_payment_enabled !== false}
                    onClose={() => setStickerFor(null)} onDone={(msg) => { setStickerFor(null); setNotice(msg); load(); }} />
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-700">{t("Stikerlar", "Стикеры")} ({boosts.length})</h2>
        {boosts.length === 0 && <p className="text-xs text-slate-500">{t("Hali stiker yo‘q.", "Стикеров пока нет.")}</p>}
        {boosts.map((b) => {
          const status = boostDisplayStatus(b);
          const lastOrder = b.orders?.[0];
          return (
            <div key={b.id} data-testid="boost-card" className="rounded-2xl bg-white border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-slate-900">{STICKER_LABELS[b.sticker_type]?.[locale]}</span>
                  <span className="text-xs text-slate-500">{b.duration_days} {t("kun", "дн.")}</span>
                  <StatusPill label={BOOST_LABELS[status]} locale={locale} />
                  {lastOrder && <StatusPill label={ORDER_LABELS[lastOrder.status]} locale={locale} />}
                </div>
                <p className="text-[11px] text-slate-500 truncate max-w-md">{b.property_title}</p>
                {b.starts_at && (
                  <p className="text-[11px] text-slate-500">{formatDate(b.starts_at, locale)} → {formatDate(b.ends_at, locale)}</p>
                )}
                {b.admin_note && b.status !== "ACTIVE" && <p className="text-[11px] text-orange-700">{b.admin_note}</p>}
              </div>
              <div className="flex gap-2">
                {b.status === "AWAITING_PAYMENT" && (
                  <button data-testid="pay-boost" disabled={busy !== null} onClick={() => pay("boost", b.id)} className="px-3 py-1.5 rounded-xl bg-[#167d4f] text-white text-xs font-bold">
                    {t("To‘lash", "Оплатить")}
                  </button>
                )}
                {(b.status === "AWAITING_PAYMENT" || b.status === "PENDING_APPROVAL") && (
                  <button disabled={busy !== null} onClick={() => cancelBoost(b)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                    {t("Bekor qilish", "Отменить")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function StickerPurchase({ locale, submission, plans, paymentsOn, onClose, onDone }: {
  locale: Locale; submission: any; plans: any[]; paymentsOn: boolean; onClose: () => void; onDone: (msg: string) => void;
}) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const types = Array.from(new Set(plans.map((p) => p.sticker_type)));
  const [sticker, setSticker] = useState<string>(types[0] || "top");
  const durations = plans.filter((p) => p.sticker_type === sticker);
  const [days, setDays] = useState<number>(durations[0]?.duration_days || 7);
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newIdempotencyKey());
  const plan = durations.find((p) => p.duration_days === days);

  useEffect(() => {
    const first = plans.find((p) => p.sticker_type === sticker);
    if (first && !plans.some((p) => p.sticker_type === sticker && p.duration_days === days)) setDays(first.duration_days);
  }, [sticker, plans, days]);

  async function buy() {
    setBusy(true);
    setError(null);
    const r = await monApi("/api/boosts", {
      method: "POST",
      body: JSON.stringify({ property_id: submission.property_id, sticker_type: sticker, duration_days: days, promo_code: promo || undefined, idempotency_key: key }),
    }, locale);
    setBusy(false);
    if (!r.ok) return setError(r.message || null);
    if (r.data.checkout?.redirect_url) {
      window.location.href = r.data.checkout.redirect_url;
      return;
    }
    onDone(t("Stiker so‘rovi admin tasdig‘iga yuborildi.", "Запрос стикера отправлен на одобрение."));
  }

  if (paymentsOn && plans.length === 0) {
    return <p className="text-xs text-rose-600">{t("Stiker narxlari hali belgilanmagan.", "Цены на стикеры ещё не установлены.")}</p>;
  }
  const typeList = paymentsOn ? types : ["top", "tez_sotiladi", "yaxshi_taklif"];
  const dayList = paymentsOn ? durations.map((p) => p.duration_days) : [3, 7, 30];

  return (
    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-3 space-y-2.5" data-testid="sticker-purchase">
      <div className="flex justify-between items-center">
        <p className="text-xs font-black text-slate-800">{t("Stiker tanlang", "Выберите стикер")}</p>
        <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {typeList.map((s) => (
          <button key={s} onClick={() => setSticker(s)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${sticker === s ? "bg-amber-500 text-white border-amber-500" : "bg-white border-slate-200 text-slate-700"}`}>
            {STICKER_LABELS[s]?.[locale] || s}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {dayList.map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${days === d ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-700"}`}>
            {d} {t("kun", "дн.")}
            {paymentsOn && ` · ${formatSum(plans.find((p) => p.sticker_type === sticker && p.duration_days === d)?.price_uzs, locale)}`}
          </button>
        ))}
      </div>
      {paymentsOn && (
        <input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder={t("Promokod (ixtiyoriy)", "Промокод (необязательно)")}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
      )}
      <p className="text-[11px] text-slate-500">
        {t("Muddat admin tasdiqlagan paytdan boshlanadi. Chegirma serverda hisoblanadi.", "Срок начинается с момента одобрения администратором. Скидка считается на сервере.")}
      </p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button data-testid="sticker-buy" onClick={buy} disabled={busy || (paymentsOn && !plan)} className="w-full rounded-xl bg-amber-500 text-white py-2 text-xs font-black disabled:opacity-50">
        {busy ? "…" : paymentsOn ? `${t("Davom etish va to‘lash", "Продолжить и оплатить")} ${formatSum(plan?.price_uzs, locale)}` : t("So‘rov yuborish (bepul)", "Отправить запрос (бесплатно)")}
      </button>
    </div>
  );
}

export default function KabinetPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Suspense fallback={null}>
        <KabinetInner />
      </Suspense>
    </div>
  );
}
