"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Phone,
  Send,
  Mail,
  Clock,
  MapPin,
  Instagram,
  ShieldCheck,
  Users,
  Building2,
  ExternalLink,
  UserCheck,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Home,
  Tag,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useLanguage } from "@/context/LanguageContext";
import { useAdminContact, useRealtors } from "@/lib/realtorStore";
import { detectDevice, detectTrafficSource } from "@/lib/leadClient";

type DealType = "sale" | "rent";
type PropertyType = "kvartira" | "hovli" | "yer" | "yangi_qurilish" | "tijorat" | "boshqa";

export default function ContactsPage() {
  const { locale, t } = useLanguage();
  const { contact: adminContact, isLoaded: isAdminLoaded } = useAdminContact();
  const { activeRealtors, isLoaded: isRealtorsLoaded } = useRealtors();

  const [formData, setFormData] = useState({
    name: "",
    phone: "+998 ",
    dealType: "sale" as DealType,
    propertyType: "kvartira" as PropertyType,
    location: "",
    description: "",
    channel: "phone" as "phone" | "telegram",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmitListingRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const name = formData.name.trim();
    const phone = formData.phone.trim();
    const location = formData.location.trim();
    const description = formData.description.trim();

    if (name.length < 2) {
      setErrorMessage(locale === "uz" ? "Ismingizni kiriting" : "Введите ваше имя");
      return;
    }
    if (phone.replace(/[\s\(\)\-]/g, "").length < 9) {
      setErrorMessage(
        locale === "uz" ? "Telefon raqamingizni to'liq kiriting" : "Введите корректный номер телефона"
      );
      return;
    }
    if (!location) {
      setErrorMessage(
        locale === "uz" ? "Lokatsiyani kiriting (masalan: 5-mavze)" : "Укажите локацию (например: 5-й массив)"
      );
      return;
    }
    if (!description || description.length < 3) {
      setErrorMessage(
        locale === "uz" ? "Obyekt haqida qisqacha ma’lumot kiriting" : "Введите краткое описание объекта"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "property_listing_request",
          client_name: name,
          client_phone: phone,
          location,
          deal_type: formData.dealType,
          property_type: formData.propertyType,
          description,
          message: description,
          preferred_channel: formData.channel,
          device: detectDevice(),
          traffic_source: "Listing Request",
          metadata: {
            lead_type: "property_listing_request",
            request_type: "property_listing_request",
            location,
            deal_type: formData.dealType,
            property_type: formData.propertyType,
            description,
            preferred_channel: formData.channel,
            submitted_from: "/kontaktlar",
          },
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSubmitSuccess(true);
        setFormData({
          name: "",
          phone: "+998 ",
          dealType: "sale",
          propertyType: "kvartira",
          location: "",
          description: "",
          channel: "phone",
        });
      } else {
        setErrorMessage(json.error || (locale === "uz" ? "Xatolik yuz berdi" : "Произошла ошибка"));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || (locale === "uz" ? "Tarmoq xatosi" : "Ошибка сети"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-canvas overflow-x-hidden text-brand-dark">
      {/* Header */}
      <Header />

      <main className="flex-1 pb-16 sm:pb-24">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white border-b border-gray-100 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-light px-4 py-1.5 text-xs font-extrabold text-brand-primary border border-brand-border/60">
              <MessageSquare className="h-3.5 w-3.5 text-brand-primary" />
              <span>{t.contactsPage.badge}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-brand-dark">
              {t.contactsPage.title}
            </h1>

            <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-600 leading-relaxed font-normal">
              {t.contactsPage.subtitle}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
          {/* SECTION A: ANGREN ESTATE Administratsiyasi */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-white shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">
                  {t.contactsPage.adminSectionTitle}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  {t.contactsPage.adminSectionSubtitle}
                </p>
              </div>
            </div>

            {adminContact.is_configured ? (
              /* Configured Admin Contact Card */
              <div className="rounded-3xl bg-white/95 backdrop-blur-xl p-6 sm:p-8 border border-gray-100 shadow-elevated grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {adminContact.name && (
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Mas'ul shaxs / Ответственное лицо
                      </span>
                      <h3 className="text-lg font-extrabold text-brand-dark">
                        {adminContact.name}
                      </h3>
                    </div>
                  )}

                  {adminContact.phone && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand-primary shrink-0">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">{t.contactsPage.phone}</p>
                        <a
                          href={`tel:${adminContact.phone}`}
                          className="text-sm font-bold text-brand-dark hover:text-brand-primary transition-colors"
                        >
                          {adminContact.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {adminContact.telegram && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shrink-0">
                        <Send className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">{t.contactsPage.telegram}</p>
                        <a
                          href={adminContact.telegram.startsWith("http") ? adminContact.telegram : `https://t.me/${adminContact.telegram.replace("@", "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-bold text-sky-700 hover:text-sky-800 transition-colors flex items-center gap-1"
                        >
                          <span>{adminContact.telegram.startsWith("@") ? adminContact.telegram : `@${adminContact.telegram}`}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {adminContact.email && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">{t.contactsPage.email}</p>
                        <a
                          href={`mailto:${adminContact.email}`}
                          className="text-sm font-bold text-brand-dark hover:text-brand-primary transition-colors"
                        >
                          {adminContact.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {(adminContact.working_hours_uz || adminContact.working_hours_ru) && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">{t.contactsPage.workingHours}</p>
                        <p className="text-sm font-bold text-brand-dark">
                          {locale === "uz" ? adminContact.working_hours_uz : adminContact.working_hours_ru}
                        </p>
                      </div>
                    </div>
                  )}

                  {adminContact.instagram && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                        <Instagram className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">{t.contactsPage.instagram}</p>
                        <a
                          href={`https://instagram.com/${adminContact.instagram.replace("@", "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-bold text-rose-700 hover:text-rose-800 transition-colors flex items-center gap-1"
                        >
                          <span>{adminContact.instagram}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* High-End Admin Empty State (Zero Fake Data) */
              <div className="rounded-3xl bg-white/90 backdrop-blur-md p-8 sm:p-10 border border-gray-100 shadow-card text-center max-w-xl mx-auto space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand-primary shadow-sm">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-brand-dark">
                  {t.contactsPage.emptyAdminTitle}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                  {t.contactsPage.emptyAdminDesc}
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3.5 py-1 text-xs font-medium text-brand-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Angren shahar, Toshkent viloyati</span>
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* SECTION B: Hamkor Rieltorlar / Риелторы-партнёры */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-white shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">
                  {t.contactsPage.realtorsSectionTitle}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  {t.contactsPage.realtorsSectionSubtitle}
                </p>
              </div>
            </div>

            {isRealtorsLoaded && activeRealtors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeRealtors.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col rounded-3xl bg-white/95 backdrop-blur-xl border border-gray-100 p-6 shadow-card hover:shadow-elevated transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative h-16 w-16 rounded-2xl overflow-hidden bg-brand-light flex items-center justify-center text-brand-primary font-black text-2xl shrink-0 shadow-sm border border-brand-border/40">
                        {r.photo_url || r.avatar_url ? (
                          <Image
                            src={r.photo_url || r.avatar_url || ""}
                            alt={r.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <UserCheck className="h-8 w-8 text-brand-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-base text-brand-dark truncate">
                          {r.name}
                        </h3>
                        <p className="text-xs text-brand-primary font-semibold truncate">
                          {locale === "uz" ? r.specialization_uz : r.specialization_ru}
                        </p>
                        <span className="inline-block mt-1 rounded-md bg-brand-light px-2.5 py-0.5 text-[10px] font-bold text-brand-dark">
                          {r.experience_years} {t.aboutPage.yearsExp}
                        </span>
                      </div>
                    </div>

                    <div className={`mt-auto grid ${r.instagram_url || r.instagram ? "grid-cols-3" : "grid-cols-2"} gap-2 pt-4 border-t border-gray-100`}>
                      <a
                        href={`tel:${r.phone}`}
                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-primary px-3 py-2.5 text-xs font-bold text-white hover:bg-brand-primary-hover shadow-sm active:scale-95 transition-all"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>{t.aboutPage.callBtn}</span>
                      </a>
                      <a
                        href={r.telegram.startsWith("http") ? r.telegram : `https://t.me/${r.telegram.replace("@", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-brand-dark hover:bg-gray-50 shadow-sm active:scale-95 transition-all"
                      >
                        <Send className="h-3.5 w-3.5 text-sky-600" />
                        <span>{t.aboutPage.telegramBtn}</span>
                      </a>
                      {(r.instagram_url || r.instagram) && (
                        <a
                          href={(r.instagram_url || r.instagram) || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-2xl border border-pink-200 bg-pink-50/50 px-2.5 py-2.5 text-xs font-bold text-pink-700 hover:bg-pink-100 shadow-sm active:scale-95 transition-all"
                          title="Instagram"
                        >
                          <Instagram className="h-3.5 w-3.5 text-pink-600" />
                          <span>Instagram</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* High-End Realtors Empty State (Zero Fake Data) */
              <div className="rounded-3xl bg-white/90 backdrop-blur-md p-8 sm:p-12 border border-dashed border-gray-200 text-center max-w-xl mx-auto space-y-3 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand-primary shadow-sm">
                  <Users className="h-7 w-7" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-brand-dark">
                  {t.contactsPage.emptyRealtorsTitle}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                  {t.contactsPage.emptyRealtorsDesc}
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-medium text-gray-500 border border-gray-200/80 shadow-sm">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
                    <span>ANGREN ESTATE Official Partners</span>
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* SECTION C: ELON BERISH UCHUN ARIZA / ОСТАВИТЬ ЗАЯВКУ НА РАЗМЕЩЕНИЕ */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-white shadow-sm">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">
                  {t.contactsPage.listingSectionTitle}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  {t.contactsPage.listingSectionSubtitle}
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-gray-100 p-6 sm:p-10 shadow-card max-w-2xl mx-auto">
              {submitSuccess ? (
                <div className="py-8 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-brand-dark">
                    {t.contactsPage.listingSuccessTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                    {t.contactsPage.listingSuccessDesc}
                  </p>
                  <button
                    onClick={() => setSubmitSuccess(false)}
                    className="mt-4 px-6 py-2.5 rounded-2xl bg-brand-light text-brand-primary text-xs font-bold hover:bg-brand-primary hover:text-white transition-colors"
                  >
                    {t.contactsPage.listingNewBtn}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitListingRequest} className="space-y-5">
                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700 font-semibold">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* 1. Name & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700">
                        {locale === "uz" ? "Ismingiz *" : "Ваше имя *"}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={locale === "uz" ? "Masalan: Alisher" : "Например: Алишер"}
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700">
                        {locale === "uz" ? "Telefon raqamingiz *" : "Номер телефона *"}
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+998 90 123 45 67"
                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* 2. Bitim turi (Deal Type Pills) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      {locale === "uz" ? "Bitim turi" : "Тип сделки"}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, dealType: "sale" })}
                        className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                          formData.dealType === "sale"
                            ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <Tag className="h-4 w-4" />
                        <span>{locale === "uz" ? "Sotuv" : "Продажа"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, dealType: "rent" })}
                        className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                          formData.dealType === "rent"
                            ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <Clock className="h-4 w-4" />
                        <span>{locale === "uz" ? "Ijara" : "Аренда"}</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Mulk turi (Property Type Pills) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      {locale === "uz" ? "Mulk turi" : "Тип недвижимости"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: "kvartira", uz: "Kvartira", ru: "Квартира" },
                        { id: "hovli", uz: "Hovli uy", ru: "Участок / дом" },
                        { id: "yer", uz: "Yer uchastkasi", ru: "Земля" },
                        { id: "yangi_qurilish", uz: "Yangi qurilish", ru: "Новостройка" },
                        { id: "tijorat", uz: "Tijorat", ru: "Коммерческая" },
                        { id: "boshqa", uz: "Boshqa", ru: "Другое" },
                      ].map((p) => {
                        const isSelected = formData.propertyType === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, propertyType: p.id as PropertyType })}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                              isSelected
                                ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                                : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            {locale === "uz" ? p.uz : p.ru}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Lokatsiya (Required) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                      <span>{locale === "uz" ? "Lokatsiya *" : "Локация *"}</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder={locale === "uz" ? "Masalan: 5-mavze, Mustaqillik ko‘chasi" : "Например: 5-й массив, ул. Мустакиллик"}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                    />
                  </div>

                  {/* 5. Obyekt haqida qisqacha (Required) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      {locale === "uz" ? "Obyekt haqida qisqacha *" : "Кратко об объекте *"}
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={
                        locale === "uz"
                          ? "Masalan: 5 sotixli hovli uy, 4 xona, ta’mirlangan..."
                          : "Например: дом на 5 сотках, 4 комнаты, с ремонтом..."
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all resize-none"
                    />
                  </div>

                  {/* 6. Preferred Contact Method */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      {locale === "uz" ? "Qulay aloqa usuli" : "Удобный способ связи"}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, channel: "phone" })}
                        className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                          formData.channel === "phone"
                            ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <Phone className="h-4 w-4" />
                        <span>{locale === "uz" ? "Telefon qo‘ng‘iroq" : "Телефонный звонок"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, channel: "telegram" })}
                        className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                          formData.channel === "telegram"
                            ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                            : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <Send className="h-4 w-4" />
                        <span>Telegram</span>
                      </button>
                    </div>
                  </div>

                  {/* 7. Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-2xl bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold shadow-md shadow-brand-primary/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{locale === "uz" ? "Yuborilmoqda..." : "Отправка..."}</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>{t.contactsPage.listingSubmitBtn}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
