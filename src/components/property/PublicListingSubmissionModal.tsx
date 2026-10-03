"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, CheckCircle2, Phone, Send, Building2, Home, MapPin, DollarSign, Layers, ShieldCheck, AlertCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PublicListingSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PublicListingSubmissionModal({ isOpen, onClose }: PublicListingSubmissionModalProps) {
  const { locale } = useLanguage();

  const [dealType, setDealType] = useState<"sale" | "rent">("sale");
  const [propertyType, setPropertyType] = useState<"apartment" | "house" | "commercial" | "land" | "other">("apartment");
  const [location, setLocation] = useState("");
  const [rooms, setRooms] = useState<string>("3");
  const [area, setArea] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [currency, setCurrency] = useState<"USD" | "UZS">("USD");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("+998 ");
  const [preferredChannel, setPreferredChannel] = useState<"phone" | "telegram">("phone");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsSuccess(false);
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate name
    if (!clientName.trim() || clientName.trim().length < 2) {
      setErrorMsg(locale === "uz" ? "Iltimos, ismingizni to‘liq kiriting" : "Пожалуйста, укажите ваше имя");
      return;
    }

    // Validate phone
    const cleanPhone = clientPhone.replace(/[\s\(\)\-]/g, "");
    if (!/^\+?\d{9,15}$/.test(cleanPhone)) {
      setErrorMsg(locale === "uz" ? "Telefon raqami noto‘g‘ri kiritildi (+998901234567)" : "Некорректный номер телефона (+998901234567)");
      return;
    }

    // Validate location
    if (!location.trim() || location.trim().length < 2) {
      setErrorMsg(locale === "uz" ? "Obyekt manzili yoki mo‘ljalni kiriting" : "Укажите адрес или ориентир объекта");
      return;
    }

    // Validate description
    if (!description.trim() || description.trim().length < 3) {
      setErrorMsg(locale === "uz" ? "Obyekt haqida qisqacha ma’lumot kiriting" : "Укажите краткую информацию об объекте");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "property_listing_request",
          client_name: clientName.trim(),
          client_phone: cleanPhone,
          message: description.trim(),
          location: location.trim(),
          deal_type: dealType,
          property_type: propertyType,
          rooms: propertyType === "land" ? undefined : rooms,
          area: area ? Number(area) : undefined,
          price: price ? Number(price) : undefined,
          currency,
          preferred_channel: preferredChannel,
          metadata: {
            lead_type: "property_listing_request",
            source: "Public Website - E'lon qoldirish",
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
      } else {
        setErrorMsg(data.error || (locale === "uz" ? "Ariza yuborishda xatolik yuz berdi" : "Произошла ошибка при отправке заявки"));
      }
    } catch (err: any) {
      console.error("Listing submission error:", err);
      setErrorMsg(err?.message || (locale === "uz" ? "Aloqa xatosi. Qayta urinib ko‘ring" : "Ошибка связи. Попробуйте еще раз"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[90vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-[#eaf5f0]/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#167d4f] text-white flex items-center justify-center shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {locale === "uz" ? "ANGREN ESTATE orqali e'lon bering" : "Разместить объявление через ANGREN ESTATE"}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {locale === "uz" ? "Obyektingizni minglab xaridorlarga taqdim eting" : "Предложите ваш объект тысячам покупателей"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 text-[#167d4f] flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-[#167d4f]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">
                  {locale === "uz" ? "Arizangiz muvaffaqiyatli qabul qilindi!" : "Ваша заявка успешно принята!"}
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  {locale === "uz"
                    ? "Ma'lumotlar moderatsiyaga yuborildi. Mutaxassisimiz tez orada siz bilan bog‘lanadi va e'lonni rasmiylashtirishda yordam beradi."
                    : "Данные отправлены на модерацию. Наш специалист свяжется с вами в ближайшее время для оформления объявления."}
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#167d4f] hover:bg-[#145d3c] text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  {locale === "uz" ? "Tushunarli, yopish" : "Понятно, закрыть"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs font-bold">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Bitim turi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {locale === "uz" ? "Bitim turi *" : "Тип сделки *"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDealType("sale")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      dealType === "sale"
                        ? "bg-[#167d4f] text-white border-[#167d4f] shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {locale === "uz" ? "Sotuv (Sotmoqchiman)" : "Продажа (Хочу продать)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealType("rent")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      dealType === "rent"
                        ? "bg-[#167d4f] text-white border-[#167d4f] shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {locale === "uz" ? "Ijara (Ijaraga bermoqchiman)" : "Аренда (Сдать в аренду)"}
                  </button>
                </div>
              </div>

              {/* Obyekt turi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {locale === "uz" ? "Obyekt turi *" : "Тип объекта *"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: "apartment", labelUz: "Kvartira", labelRu: "Квартира" },
                    { id: "house", labelUz: "Hovli / Uy", labelRu: "Дом / Участок" },
                    { id: "commercial", labelUz: "Tijorat", labelRu: "Коммерция" },
                    { id: "land", labelUz: "Yer", labelRu: "Участок" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPropertyType(item.id as any)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        propertyType === item.id
                          ? "bg-emerald-50 text-[#167d4f] border-[#167d4f] ring-1 ring-[#167d4f]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {locale === "uz" ? item.labelUz : item.labelRu}
                    </button>
                  ))}
                </div>
              </div>

              {/* Joylashuvi / Manzili */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {locale === "uz" ? "Joylashuvi / Manzili *" : "Расположение / Адрес *"}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={locale === "uz" ? "Masalan: 5/2 dahasi, 14-uy yoki Bo‘ston dahasi" : "Например: 5/2 массив, дом 14 или массив Бустон"}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
              </div>

              {/* Xonalar soni & Maydoni */}
              <div className="grid grid-cols-2 gap-3">
                {propertyType !== "land" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {locale === "uz" ? "Xonalar soni" : "Количество комнат"}
                    </label>
                    <select
                      value={rooms}
                      onChange={(e) => setRooms(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#167d4f] outline-none bg-white"
                    >
                      <option value="1">1 xona</option>
                      <option value="2">2 xona</option>
                      <option value="3">3 xona</option>
                      <option value="4">4 xona</option>
                      <option value="5">5+ xona</option>
                    </select>
                  </div>
                )}

                <div className={propertyType === "land" ? "col-span-2" : ""}>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {propertyType === "land" || propertyType === "house"
                      ? (locale === "uz" ? "Maydoni (sotix yoki m²)" : "Площадь (соток или м²)")
                      : (locale === "uz" ? "Maydoni (m²)" : "Площадь (м²)")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder={propertyType === "land" ? "6" : "65"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
              </div>

              {/* Kutilayotgan narxi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {locale === "uz" ? "Kutilayotgan narxi" : "Ориентировочная цена"}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={currency === "USD" ? "35000" : "450000000"}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#167d4f] outline-none"
                    />
                  </div>
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setCurrency("USD")}
                      className={`px-3 py-2 text-xs font-bold transition-colors ${
                        currency === "USD" ? "bg-[#167d4f] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency("UZS")}
                      className={`px-3 py-2 text-xs font-bold transition-colors ${
                        currency === "UZS" ? "bg-[#167d4f] text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      UZS (so‘m)
                    </button>
                  </div>
                </div>
              </div>

              {/* Obyekt haqida qisqacha ma'lumot */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {locale === "uz" ? "Obyekt haqida qisqacha ma'lumot *" : "Краткое описание объекта *"}
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={locale === "uz" ? "Qavat, ta'mir holati, yaqinidagi qulayliklar yoki muhim tafsilotlar..." : "Этаж, состояние ремонта, удобства рядом или важные детали..."}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#167d4f] outline-none resize-none"
                />
              </div>

              {/* Aloqa ma'lumotlari: Ism & Telefon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {locale === "uz" ? "Ismingiz *" : "Ваше имя *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder={locale === "uz" ? "Masalan: Jasur" : "Например: Жасур"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {locale === "uz" ? "Telefon raqamingiz *" : "Номер телефона *"}
                  </label>
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
              </div>

              {/* Qulay aloqa usuli */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {locale === "uz" ? "Qulay aloqa usuli" : "Удобный способ связи"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferredChannel("phone")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      preferredChannel === "phone"
                        ? "bg-emerald-50 text-[#167d4f] border-[#167d4f]"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{locale === "uz" ? "Qo‘ng‘iroq" : "Звонок"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredChannel("telegram")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      preferredChannel === "telegram"
                        ? "bg-sky-50 text-sky-700 border-sky-400"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Telegram</span>
                  </button>
                </div>
              </div>

              {/* Moderation safety notice */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-[11px] text-slate-600">
                <ShieldCheck className="h-4 w-4 text-[#167d4f] shrink-0 mt-0.5" />
                <span>
                  {locale === "uz"
                    ? "E'lon darhol saytga chiqmaydi. Mutaxassislarimiz ma'lumotlarni tekshirib, siz bilan bog‘langandan so‘ng e'lon chop etiladi."
                    : "Объявление не публикуется сразу. Наши специалисты проверят информацию и свяжутся с вами для публикации."}
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-[#167d4f] hover:bg-[#145d3c] active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>{locale === "uz" ? "Yuborilmoqda..." : "Отправка..."}</span>
                ) : (
                  <>
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                    <span>{locale === "uz" ? "E'lon berish arizasini yuborish" : "Отправить заявку на размещение"}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
