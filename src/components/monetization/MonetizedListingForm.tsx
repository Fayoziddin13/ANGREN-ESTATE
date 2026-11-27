"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImagePlus, Loader2, ShieldCheck, Tag, X, Gift, CreditCard, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTelegram } from "@/context/TelegramContext";
import { formatSum, monApi, newIdempotencyKey, PROPERTY_TYPE_LABELS, type Locale } from "@/lib/monetization/client";

/**
 * Listing application with the monetization step (used when monetization is ON).
 * The server decides free / paid and the price; this form only shows what the
 * server says. A paid application continues to the payment page.
 */

export interface MonetizedFormInitial {
  id?: string;
  payload?: any;
  photos?: string[];
  contact_name?: string;
  contact_phone?: string;
  preferred_channel?: "phone" | "telegram";
  admin_note?: string | null;
}

interface Props {
  locale: Locale;
  devTools?: boolean;
  /** Edit mode: send a corrected application back after a revision request. */
  initial?: MonetizedFormInitial;
  onDone?: () => void;
}

type Photo = { path: string; preview: string | null };

export function MonetizedListingForm({ locale, devTools, initial, onDone }: Props) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { user, handleGoogleLogin, loading: authLoading } = useAuth();
  const { isTelegram } = useTelegram();
  const isEdit = Boolean(initial?.id);
  const p = initial?.payload || {};

  const [dealType, setDealType] = useState<"sale" | "rent">(p.deal_type || "sale");
  const [propertyType, setPropertyType] = useState<string>(p.property_type || "apartment");
  const [location, setLocation] = useState<string>(p.location || "");
  const [rooms, setRooms] = useState<string>(p.rooms ? String(p.rooms) : "3");
  const [area, setArea] = useState<string>(p.area ? String(p.area) : "");
  const [price, setPrice] = useState<string>(p.price ? String(p.price) : "");
  const [currency, setCurrency] = useState<"USD" | "UZS">(p.currency || "USD");
  const [description, setDescription] = useState<string>(p.description || "");
  const [name, setName] = useState<string>(initial?.contact_name || "");
  const [phone, setPhone] = useState<string>(initial?.contact_phone || "+998 ");
  const [channel, setChannel] = useState<"phone" | "telegram">(initial?.preferred_channel || "phone");
  const [photos, setPhotos] = useState<Photo[]>((initial?.photos || []).map((path) => ({ path, preview: null })));
  const [promo, setPromo] = useState("");
  const [tier, setTier] = useState<"standard" | "premium">("standard");
  const [plans, setPlans] = useState<{ standard: number | null; premium: number | null; features: string[] }>({ standard: null, premium: null, features: [] });
  const [terms, setTerms] = useState<any>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { billing: string; status: string }>(null);
  const keyRef = useRef(newIdempotencyKey());
  const fileRef = useRef<HTMLInputElement>(null);

  const canUse = Boolean(user) || isTelegram;

  useEffect(() => {
    if (user?.full_name && !name) setName(user.full_name);
    if (user?.phone && phone.trim() === "+998") setPhone(user.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Tariff prices and Premium features (set by the admin).
  useEffect(() => {
    if (isEdit) return;
    fetch("/api/monetization/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((c) => setPlans({ standard: c?.prices?.listing ?? null, premium: c?.prices?.premium ?? null, features: Array.isArray(c?.premium_features) ? c.premium_features : [] }))
      .catch(() => undefined);
  }, [isEdit]);

  // Price preview from the server (free first listing / price / discount).
  useEffect(() => {
    if (!canUse || isEdit) return;
    const handle = setTimeout(async () => {
      const r = await monApi("/api/monetization/terms", {
        method: "POST",
        body: JSON.stringify({ contact_phone: phone, promo_code: promo, listing_tier: tier }),
      }, locale);
      if (r.ok) {
        setTerms(r.data.terms);
        setTermsError(null);
      } else {
        setTerms(null);
        setTermsError(r.message || null);
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [phone, promo, tier, canUse, isEdit, locale]);

  const quote = terms?.billing === "paid" ? terms?.quote : null;
  const promoErrorText = useMemo(() => {
    const code = quote?.promo_error;
    if (!code || !promo.trim()) return null;
    const map: Record<string, [string, string]> = {
      invalid: ["Promokod topilmadi", "Промокод не найден"],
      expired: ["Promokod muddati tugagan", "Срок промокода истёк"],
      not_started: ["Promokod hali boshlanmagan", "Промокод ещё не действует"],
      not_applicable: ["Bu promokod e'lon uchun emas", "Промокод не подходит к объявлению"],
      min_order: ["Buyurtma summasi yetarli emas", "Сумма заказа недостаточна"],
      limit_reached: ["Promokod limiti tugagan", "Лимит промокода исчерпан"],
      already_used: ["Siz bu promokodni ishlatgansiz", "Вы уже использовали этот промокод"],
    };
    const m = map[code];
    return m ? t(m[0], m[1]) : code;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, promo, locale]);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 10 - photos.length)) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await monApi("/api/listings/uploads", { method: "POST", body: fd }, locale);
        if (!r.ok) {
          setError(r.message || t("Rasmni yuklab bo‘lmadi", "Не удалось загрузить фото"));
          break;
        }
        setPhotos((prev) => [...prev, { path: r.data.path, preview: r.data.preview_url }]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (location.trim().length < 2) return setError(t("Manzilni kiriting", "Укажите адрес"));
    if (description.trim().length < 3) return setError(t("Obyekt haqida yozing", "Опишите объект"));
    if (name.trim().length < 2) return setError(t("Ismingizni kiriting", "Укажите имя"));
    setSubmitting(true);
    const body = {
      deal_type: dealType,
      property_type: propertyType,
      location,
      rooms: propertyType === "land" ? undefined : rooms,
      area: area || undefined,
      price: price || undefined,
      currency,
      description,
      contact_name: name,
      contact_phone: phone,
      preferred_channel: channel,
      photos: photos.map((ph) => ph.path),
      promo_code: promo || undefined,
      idempotency_key: keyRef.current,
      listing_tier: tier,
    };
    const r = isEdit
      ? await monApi(`/api/listings/submissions/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) }, locale)
      : await monApi("/api/listings/submissions", { method: "POST", body: JSON.stringify(body) }, locale);
    setSubmitting(false);
    if (!r.ok) return setError(r.message || null);
    if (!isEdit && r.data.checkout?.redirect_url) {
      window.location.href = r.data.checkout.redirect_url;
      return;
    }
    setDone({ billing: isEdit ? "edit" : r.data.submission?.billing, status: isEdit ? r.data.status : r.data.submission?.moderation_status });
  }

  if (done) {
    return (
      <div className="py-8 text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 text-[#167d4f] mx-auto" />
        <h3 className="text-lg font-black text-slate-900">
          {done.billing === "edit"
            ? t("Tuzatilgan ariza qayta yuborildi", "Исправленная заявка отправлена")
            : done.status === "AWAITING_PAYMENT"
              ? t("Ariza saqlandi — to‘lovni “Mening e'lonlarim”da qiling", "Заявка сохранена — оплатите в «Мои объявления»")
              : t("Arizangiz moderatsiyaga yuborildi", "Заявка отправлена на модерацию")}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {t(
            "E'lon darhol saytga chiqmaydi: admin ma’lumotlarni tekshirib, tasdiqlagandan keyin chop etiladi.",
            "Объявление не публикуется сразу: администратор проверит данные и опубликует после одобрения."
          )}
        </p>
        <Link href="/kabinet" onClick={onDone} className="inline-flex px-4 py-2.5 rounded-2xl bg-[#167d4f] text-white text-xs font-bold">
          {t("Mening e'lonlarim", "Мои объявления")}
        </Link>
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="py-6 text-center space-y-4">
        <ShieldCheck className="h-10 w-10 text-[#167d4f] mx-auto" />
        <h3 className="text-base font-black text-slate-900">{t("E'lon berish uchun kiring", "Войдите, чтобы подать объявление")}</h3>
        <p className="text-xs text-slate-500">{t("Google yoki Telegram orqali kirish talab qilinadi.", "Нужен вход через Google или Telegram.")}</p>
        <div className="flex flex-col gap-2 max-w-xs mx-auto">
          <button type="button" disabled={authLoading} onClick={() => handleGoogleLogin()} className="px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold">
            {t("Google orqali kirish", "Войти через Google")}
          </button>
          {devTools && (
            <Link href="/dev/test-login" className="px-4 py-2.5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold">
              {t("Test kirishi (faqat lokal)", "Тестовый вход (только локально)")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#167d4f]/30";
  const label = "block text-[11px] font-bold text-slate-600 mb-1";

  return (
    <form onSubmit={submit} className="space-y-3.5" data-testid="monetized-listing-form">
      {isEdit && initial?.admin_note && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
          <b>{t("Admin izohi:", "Комментарий администратора:")}</b> {initial.admin_note}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(["sale", "rent"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDealType(d)}
            className={`rounded-xl py-2 text-xs font-bold border ${dealType === d ? "bg-[#167d4f] text-white border-[#167d4f]" : "bg-white text-slate-600 border-slate-200"}`}>
            {d === "sale" ? t("Sotuv", "Продажа") : t("Ijara", "Аренда")}
          </button>
        ))}
      </div>
      <div>
        <span className={label}>{t("Obyekt turi", "Тип объекта")}</span>
        <div className="grid grid-cols-5 gap-1.5">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setPropertyType(k)}
              className={`rounded-xl py-2 text-[11px] font-bold border ${propertyType === k ? "bg-[#eaf5f0] text-[#167d4f] border-[#167d4f]" : "bg-white text-slate-600 border-slate-200"}`}>
              {v[locale]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={label}>{t("Manzil *", "Адрес *")}</label>
        <input className={input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("Masalan: 5/2 dahasi, 14-uy", "Например: 5/2 мкр, дом 14")} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {propertyType !== "land" && (
          <div>
            <label className={label}>{t("Xonalar", "Комнат")}</label>
            <input className={input} type="number" min={0} value={rooms} onChange={(e) => setRooms(e.target.value)} />
          </div>
        )}
        <div>
          <label className={label}>{t("Maydon (m²)", "Площадь (м²)")}</label>
          <input className={input} type="number" min={1} value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
        <div>
          <label className={label}>{t("Narx", "Цена")} ({currency})</label>
          <div className="flex gap-1">
            <input className={input} type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
            <button type="button" onClick={() => setCurrency(currency === "USD" ? "UZS" : "USD")} className="px-2 rounded-xl border border-slate-200 text-[11px] font-bold">
              {currency}
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className={label}>{t("Obyekt haqida *", "Описание *")}</label>
        <textarea className={input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <span className={label}>{t("Rasmlar (10 tagacha)", "Фото (до 10)")}</span>
        <div className="flex flex-wrap gap-2">
          {photos.map((ph) => (
            <div key={ph.path} className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              {ph.preview ? <img src={ph.preview} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400">✓</div>}
              <button type="button" onClick={() => setPhotos((prev) => prev.filter((x) => x.path !== ph.path))}
                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="remove">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < 10 && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
        <p className="text-[10px] text-slate-400 mt-1">{t("Rasmlar faqat admin tekshirgandan keyin saytga chiqadi.", "Фото попадут на сайт только после проверки администратором.")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>{t("Ismingiz *", "Ваше имя *")}</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={label}>{t("Telefon *", "Телефон *")}</label>
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isEdit} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["phone", "telegram"] as const).map((c) => (
          <button key={c} type="button" onClick={() => setChannel(c)}
            className={`rounded-xl py-2 text-xs font-bold border ${channel === c ? "bg-[#eaf5f0] text-[#167d4f] border-[#167d4f]" : "bg-white text-slate-600 border-slate-200"}`}>
            {c === "phone" ? t("Qo‘ng‘iroq", "Звонок") : "Telegram"}
          </button>
        ))}
      </div>

      {!isEdit && plans.premium !== null && (
        <div className="grid grid-cols-2 gap-2" data-testid="listing-tier">
          {(["standard", "premium"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setTier(id)} aria-pressed={tier === id}
              className={`rounded-2xl border-2 p-3 text-left transition ${tier === id ? "border-[#167d4f] bg-[#eaf5f0]" : "border-slate-200 bg-white"}`}>
              <span className="block text-sm font-black text-slate-900">{id === "standard" ? "Standart" : "Premium"}</span>
              <span className="block text-xs font-bold text-[#167d4f]">{formatSum(id === "standard" ? plans.standard : plans.premium, locale)}</span>
              {id === "standard" ? (
                <span className="block text-[11px] text-slate-500">{t("Birinchi e'lon bepul", "Первое объявление бесплатно")}</span>
              ) : (
                <span className="block text-[11px] text-slate-500">
                  {(plans.features.length ? plans.features : [t("Premium belgisi", "Значок Premium")]).join(" · ")}
                  <span className="block text-slate-400">{t("TOP alohida sotib olinadi", "TOP покупается отдельно")}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!isEdit && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5" data-testid="listing-terms">
          {termsError && <p className="text-xs text-rose-600">{termsError}</p>}
          {!terms && !termsError && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("Narx hisoblanmoqda…", "Считаем стоимость…")}</p>}
          {terms?.billing === "free" && (
            <div className="flex items-start gap-2.5">
              <Gift className="h-5 w-5 text-[#167d4f] shrink-0" />
              <div>
                <p className="text-sm font-black text-[#167d4f]">
                  {terms.free_reason === "first_listing" ? t("Birinchi e'loningiz bepul!", "Ваше первое объявление бесплатно!") : t("Hozircha e'lon berish bepul", "Сейчас размещение бесплатное")}
                </p>
                <p className="text-[11px] text-slate-500">{t("To‘lov talab qilinmaydi. Ariza moderatsiyaga yuboriladi.", "Оплата не нужна. Заявка уйдёт на модерацию.")}</p>
              </div>
            </div>
          )}
          {terms?.billing === "paid" && (
            <>
              <div className="flex items-start gap-2.5">
                <CreditCard className="h-5 w-5 text-slate-700 shrink-0" />
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-bold text-slate-800">
                    {terms.listing_tier === "premium"
                      ? t("Premium tarif — pullik (TOP kirmaydi)", "Тариф Premium — платный (TOP не входит)")
                      : terms.phone_conflict
                        ? t("Bu telefon raqami bilan bepul e'lon allaqachon berilgan", "С этим номером уже было бесплатное объявление")
                        : t("Bepul e'lon huquqi ishlatilgan — e'lon pullik", "Бесплатное объявление уже использовано — размещение платное")}
                  </p>
                  {quote?.ok ? (
                    <>
                      <p>{t("Narx", "Цена")}: <b>{formatSum(quote.base, locale)}</b></p>
                      {quote.discount > 0 && (
                        <p className="text-emerald-700">
                          {quote.discount_source === "promotion" ? `${t("Aksiya", "Акция")} «${quote.promotion_name}»` : t("Promokod", "Промокод")}: −{formatSum(quote.discount, locale)}
                        </p>
                      )}
                      <p className="text-sm text-slate-900">{t("To‘lov", "К оплате")}: <b data-testid="final-amount">{formatSum(quote.final, locale)}</b></p>
                      {quote.promo_not_applied && (
                        <p className="text-amber-700">{t("Promokod qo‘llanmadi: aksiya chegirmasi kattaroq (chegirmalar qo‘shilmaydi)", "Промокод не применён: скидка акции больше (скидки не суммируются)")}</p>
                      )}
                      <p className="text-[11px] text-slate-500">{t("To‘lov kartadan kartaga o‘tkaziladi, chekni yuklaysiz — admin tekshiradi.", "Оплата переводом с карты на карту, вы загружаете чек — администратор проверяет.")}</p>
                    </>
                  ) : (
                    <p className="text-rose-600">{t("Narx hali belgilanmagan", "Цена ещё не установлена")}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400" />
                <input className={input} placeholder={t("Promokod (ixtiyoriy)", "Промокод (необязательно)")} value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
              </div>
              {promoErrorText && <p className="text-[11px] text-rose-600">{promoErrorText}</p>}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <button type="submit" disabled={submitting || uploading || (!isEdit && terms?.billing === "paid" && !quote?.ok)}
        className="w-full rounded-2xl bg-[#167d4f] py-3 text-sm font-black text-white disabled:opacity-50 flex items-center justify-center gap-2">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isEdit
          ? t("Tuzatilgan arizani yuborish", "Отправить исправленную заявку")
          : terms?.billing === "paid"
            ? `${t("Davom etish va to‘lash", "Продолжить и оплатить")} ${quote?.ok ? formatSum(quote.final, locale) : ""}`
            : t("Arizani yuborish", "Отправить заявку")}
      </button>
    </form>
  );
}
