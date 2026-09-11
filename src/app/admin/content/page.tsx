"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Layers,
  Phone,
  Megaphone,
  Globe,
  Search,
  AlertTriangle,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  CMSFullPayload,
} from "@/lib/types";
import { defaultFullPayload } from "@/lib/cmsStore";

type TabKey = "hero" | "about" | "contacts" | "announcement" | "seo";

export default function AdminContentPage() {
  const { locale } = useLanguage();

  const [payload, setPayload] = useState<CMSFullPayload>(defaultFullPayload);
  const [timestamps, setTimestamps] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("hero");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setConflictError(null);
    try {
      const res = await fetch("/api/admin/content", { cache: "no-store" });
      if (res.status === 401) {
        showToast(locale === "uz" ? "Avtorizatsiyadan o‘tish talab qilinadi" : "Требуется авторизация");
        return;
      }
      const data = await res.json();
      if (data.success && data.content) {
        setPayload(data.content);
        setTimestamps(data.timestamps || {});
      }
    } catch (err: any) {
      console.error("Failed to load CMS content:", err);
      showToast(locale === "uz" ? "Ma'lumotlarni yuklab bo‘lmadi" : "Ошибка загрузки данных");
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Section Save with Optimistic Concurrency Control
  const handleSaveSection = async (section: TabKey) => {
    setIsSaving(true);
    setConflictError(null);

    const sectionData = payload[section];
    const expectedUpdatedAt = timestamps[section] || "";

    try {
      const res = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          data: sectionData,
          expected_updated_at: expectedUpdatedAt,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setConflictError(
          locale === "uz"
            ? "Tahrir to‘qnashuvi (Conflict 409): Ushbu bo‘lim boshqa admin tomonidan yangilangan. Iltimos, so‘nggi ma’lumotlarni qayta yuklang."
            : "Конфликт версий (Conflict 409): Этот раздел был изменен другим администратором. Пожалуйста, перезагрузите актуальные данные."
        );
        return;
      }

      if (!res.ok || !data.success) {
        showToast(data.message || (locale === "uz" ? "Saqlashda xatolik yuz berdi" : "Ошибка сохранения"));
        return;
      }

      // Update timestamp for section
      if (data.updated_at) {
        setTimestamps((prev) => ({ ...prev, [section]: data.updated_at }));
      }

      showToast(
        locale === "uz"
          ? "O‘zgarishlar muvaffaqiyatli saqlandi!"
          : "Изменения успешно сохранены!"
      );
    } catch (err: any) {
      console.error("Save error:", err);
      showToast(locale === "uz" ? "Server bilan aloqa uzildi" : "Сбой связи с сервером");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900 border border-emerald-500/50 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <FileText className="w-7 h-7 text-emerald-400" />
            {locale === "uz" ? "Kontent Boshqaruvi (CMS)" : "Управление Контентом (CMS)"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {locale === "uz"
              ? "Bosh sahifa, 'Biz haqimizda', kontaktlar, e’lon banneri va SEO sozlamalarini boshqarish"
              : "Управление главной страницей, 'О нас', контактами, баннером и SEO настройками"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700/70 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
            {locale === "uz" ? "Yangilash" : "Обновить"}
          </button>

          <button
            type="button"
            onClick={() => handleSaveSection(activeTab)}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-900/30 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving
              ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
              : locale === "uz" ? "Bo‘limni saqlash" : "Сохранить раздел"}
          </button>
        </div>
      </div>

      {/* Conflict Banner Alert */}
      {conflictError && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <p className="text-sm font-medium">{conflictError}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {locale === "uz" ? "Qayta yuklash" : "Перезагрузить"}
          </button>
        </div>
      )}

      {/* Language Policy Standard Notice */}
      <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-slate-300">
        <Globe className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div>
          <span className="font-bold text-white">
            {locale === "uz" ? "Til standarti: " : "Языковой стандарт: "}
          </span>
          {locale === "uz"
            ? "O‘zbek tili qat’iy ravishda Lotin alifbosida (kirill ishlatilmaydi), Rus tili esa toza ruscha yoziladi."
            : "Узбекский язык строго на латинице (без кириллицы), русский язык на грамотном русском."}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-4 sm:gap-6 overflow-x-auto text-sm font-semibold scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("hero")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "hero"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {locale === "uz" ? "Bosh Sahifa (Hero)" : "Главная (Hero)"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("about")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "about"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          {locale === "uz" ? "Biz Haqimizda" : "О нас"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("contacts")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "contacts"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Phone className="w-4 h-4" />
          {locale === "uz" ? "Ofis & Kontaktlar" : "Офис и контакты"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("announcement")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "announcement"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          {locale === "uz" ? "E’lon Banneri" : "Баннер"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("seo")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "seo"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Search className="w-4 h-4" />
          {locale === "uz" ? "SEO & Meta" : "SEO и мета"}
        </button>
      </div>

      {/* 1. HERO SECTION */}
      {activeTab === "hero" && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              {locale === "uz" ? "Hero Sarlavhalari va Nishon (Badge)" : "Заголовки и значок Hero"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Hero Badge (O‘zbekcha - Lotin)
                </label>
                <input
                  type="text"
                  value={payload.hero.badge_uz}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      hero: { ...payload.hero, badge_uz: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="ANGREN KO‘CHMAS MULKI"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Hero Badge (Русский)
                </label>
                <input
                  type="text"
                  value={payload.hero.badge_ru}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      hero: { ...payload.hero, badge_ru: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="НЕДВИЖИМОСТЬ АНГРЕНА"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Hero Title (O‘zbekcha - Lotin)
                </label>
                <input
                  type="text"
                  value={payload.hero.title_uz}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      hero: { ...payload.hero, title_uz: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Angrendagi ko‘chmas mulk — bir xaritada"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Hero Title (Русский)
                </label>
                <input
                  type="text"
                  value={payload.hero.title_ru}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      hero: { ...payload.hero, title_ru: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Недвижимость Ангрена — на одной карте"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Hero Subtitle (O‘zbekcha - Lotin)
                </label>
                <textarea
                  rows={3}
                  value={payload.hero.subtitle_uz}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      hero: { ...payload.hero, subtitle_uz: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Kvartiralar, hovlilar va tijorat binolarini shahar xaritasida qulay toping"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Hero Subtitle (Русский)
                </label>
                <textarea
                  rows={3}
                  value={payload.hero.subtitle_ru}
                  onChange={(e) =>
                    setPayload({
                      ...payload,
                      hero: { ...payload.hero, subtitle_ru: e.target.value },
                    })
                  }
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Удобный поиск квартир, домов и коммерческой недвижимости на карте города"
                />
              </div>
            </div>
          </div>

          {/* Hero Live Preview Card */}
          <div className="bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {locale === "uz" ? "Jonli ko‘rinish namoyishi" : "Живой предпросмотр"}
            </div>
            <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 p-6 rounded-2xl border border-emerald-500/20 text-center space-y-3">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
                {locale === "uz" ? payload.hero.badge_uz : payload.hero.badge_ru}
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white">
                {locale === "uz" ? payload.hero.title_uz : payload.hero.title_ru}
              </h3>
              <p className="text-sm text-slate-300 max-w-xl mx-auto">
                {locale === "uz" ? payload.hero.subtitle_uz : payload.hero.subtitle_ru}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABOUT US SECTION */}
      {activeTab === "about" && (
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            {locale === "uz" ? "'Biz Haqimizda' Sahifasi Matnlari" : "Тексты страницы 'О нас'"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Badge (O‘zbekcha - Lotin)
              </label>
              <input
                type="text"
                value={payload.about.badge_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, badge_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Badge (Русский)
              </label>
              <input
                type="text"
                value={payload.about.badge_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, badge_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Headline (O‘zbekcha - Lotin)
              </label>
              <input
                type="text"
                value={payload.about.headline_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, headline_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Headline (Русский)
              </label>
              <input
                type="text"
                value={payload.about.headline_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, headline_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                1-Abzas: Platforma maqsadi (O‘zbekcha)
              </label>
              <textarea
                rows={3}
                value={payload.about.intro_p1_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, intro_p1_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                1-й Абзац: Цель платформы (Русский)
              </label>
              <textarea
                rows={3}
                value={payload.about.intro_p1_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, intro_p1_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                2-Abzas: Rieltorlar va ekspertlar (O‘zbekcha)
              </label>
              <textarea
                rows={3}
                value={payload.about.intro_p2_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, intro_p2_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                2-й Абзац: Риелторы и специалисты (Русский)
              </label>
              <textarea
                rows={3}
                value={payload.about.intro_p2_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, intro_p2_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                3-Abzas: Vazifa va shaffoflik (O‘zbekcha)
              </label>
              <textarea
                rows={3}
                value={payload.about.intro_p3_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, intro_p3_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                3-й Абзац: Прозрачность и задачи (Русский)
              </label>
              <textarea
                rows={3}
                value={payload.about.intro_p3_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, intro_p3_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Missiya (O‘zbekcha)
              </label>
              <textarea
                rows={2}
                value={payload.about.mission_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, mission_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Миссия (Русский)
              </label>
              <textarea
                rows={2}
                value={payload.about.mission_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    about: { ...payload.about, mission_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. CONTACTS SECTION */}
      {activeTab === "contacts" && (
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-400" />
            {locale === "uz" ? "Kompaniya va Bosh Ofis Kontaktlari" : "Контакты компании и головного офиса"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Kompaniya Nomi (Company Name)
              </label>
              <input
                type="text"
                value={payload.contacts.company_name}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, company_name: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Asosiy Telefon (Primary Phone)
              </label>
              <input
                type="text"
                value={payload.contacts.phone}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, phone: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Qo‘shimcha Telefon (Secondary Phone)
              </label>
              <input
                type="text"
                value={payload.contacts.phone_secondary || ""}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, phone_secondary: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={payload.contacts.email}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, email: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Telegram Foydalanuvchi Nomi
              </label>
              <input
                type="text"
                value={payload.contacts.telegram}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, telegram: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Telegram Havola (URL)
              </label>
              <input
                type="text"
                value={payload.contacts.telegram_url}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, telegram_url: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Instagram Login
              </label>
              <input
                type="text"
                value={payload.contacts.instagram || ""}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, instagram: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Instagram Havola (URL)
              </label>
              <input
                type="text"
                value={payload.contacts.instagram_url || ""}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, instagram_url: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Manzil (O‘zbekcha - Lotin)
              </label>
              <input
                type="text"
                value={payload.contacts.address_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, address_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Адрес (Русский)
              </label>
              <input
                type="text"
                value={payload.contacts.address_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, address_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Ish Vaqtlari (O‘zbekcha)
              </label>
              <input
                type="text"
                value={payload.contacts.working_hours_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, working_hours_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Режим работы (Русский)
              </label>
              <input
                type="text"
                value={payload.contacts.working_hours_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    contacts: { ...payload.contacts, working_hours_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. ANNOUNCEMENT SECTION */}
      {activeTab === "announcement" && (
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-emerald-400" />
                {locale === "uz" ? "Saytning Yuqori Qismidagi E’lon Banneri" : "Верхний баннер объявлений сайта"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {locale === "uz"
                  ? "Barcha sahifalarning yuqori qismida favqulodda xabar yoki yangilikni ko‘rsatish"
                  : "Показ важных объявлений или акций в шапке всех страниц сайта"}
              </p>
            </div>

            {/* Active Toggle */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={payload.announcement.is_active}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    announcement: { ...payload.announcement, is_active: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-3 text-xs font-semibold text-slate-300">
                {payload.announcement.is_active
                  ? locale === "uz" ? "Faol (Ko‘rinmoqda)" : "Активен"
                  : locale === "uz" ? "O‘chirilgan" : "Отключен"}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Banner Matni (O‘zbekcha - Lotin)
              </label>
              <input
                type="text"
                value={payload.announcement.text_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    announcement: { ...payload.announcement, text_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Banner Matni (Русский)
              </label>
              <input
                type="text"
                value={payload.announcement.text_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    announcement: { ...payload.announcement, text_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Havola Manzili (URL)
              </label>
              <input
                type="text"
                value={payload.announcement.link_url || ""}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    announcement: { ...payload.announcement, link_url: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
                placeholder="/sotib-olish"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Banner Uslubi / Rangi
              </label>
              <div className="flex items-center gap-3">
                {[
                  { id: "info", uz: "Axborot (Yashil)", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
                  { id: "warning", uz: "Ogohlantirish (Sariq)", color: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
                  { id: "success", uz: "Muvaffaqiyat (Yorqin)", color: "border-teal-500/40 bg-teal-500/10 text-teal-300" },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() =>
                      setPayload({
                        ...payload,
                        announcement: { ...payload.announcement, type: item.id as any },
                      })
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      payload.announcement.type === item.id
                        ? `${item.color} shadow-md`
                        : "border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {item.uz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Banner Preview */}
          {payload.announcement.is_active && (
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="text-[10px] uppercase font-semibold text-slate-400">
                {locale === "uz" ? "Banner ko‘rinishi:" : "Предпросмотр баннера:"}
              </div>
              <div
                className={`p-3 rounded-xl border text-center text-xs font-semibold flex items-center justify-center gap-2 ${
                  payload.announcement.type === "warning"
                    ? "bg-amber-950/60 text-amber-300 border-amber-500/40"
                    : payload.announcement.type === "success"
                    ? "bg-emerald-900/60 text-white border-emerald-500/40"
                    : "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                }`}
              >
                <Megaphone className="w-4 h-4 flex-shrink-0" />
                <span>{locale === "uz" ? payload.announcement.text_uz : payload.announcement.text_ru}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. SEO SECTION */}
      {activeTab === "seo" && (
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-400" />
            {locale === "uz" ? "Qidiruv Tizimi va Meta Sozlamalari (SEO)" : "Поисковая оптимизация и метатеги (SEO)"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Site Title (O‘zbekcha - Lotin)
              </label>
              <input
                type="text"
                value={payload.seo.site_title_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    seo: { ...payload.seo, site_title_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Site Title (Русский)
              </label>
              <input
                type="text"
                value={payload.seo.site_title_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    seo: { ...payload.seo, site_title_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Meta Description (O‘zbekcha - Lotin)
              </label>
              <textarea
                rows={3}
                value={payload.seo.meta_description_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    seo: { ...payload.seo, meta_description_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Meta Description (Русский)
              </label>
              <textarea
                rows={3}
                value={payload.seo.meta_description_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    seo: { ...payload.seo, meta_description_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Kalit So‘zlar (Keywords UZ)
              </label>
              <input
                type="text"
                value={payload.seo.keywords_uz}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    seo: { ...payload.seo, keywords_uz: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Ключевые слова (Keywords RU)
              </label>
              <input
                type="text"
                value={payload.seo.keywords_ru}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    seo: { ...payload.seo, keywords_ru: e.target.value },
                  })
                }
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Save Button (Sticky bottom bar) */}
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={() => handleSaveSection(activeTab)}
          disabled={isSaving || isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-xl shadow-emerald-900/40 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving
            ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
            : locale === "uz" ? "Bo‘limni saqlash" : "Сохранить раздел"}
        </button>
      </div>
    </div>
  );
}
