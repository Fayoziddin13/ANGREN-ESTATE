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
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0c2e1f] border border-[#19573c] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-white/80" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="w-7 h-7 text-[#0c2e1f]" />
            {locale === "uz" ? "Kontent Boshqaruvi (CMS)" : "Управление Контентом (CMS)"}
          </h1>
          <p className="text-slate-600 text-sm mt-1 font-medium">
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
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-300 text-sm font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
            {locale === "uz" ? "Yangilash" : "Обновить"}
          </button>

          <button
            type="button"
            onClick={() => handleSaveSection(activeTab)}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 px-5 py-2 bg-[#0c2e1f] hover:bg-[#19573c] text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50"
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
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold">{conflictError}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {locale === "uz" ? "Qayta yuklash" : "Перезагрузить"}
          </button>
        </div>
      )}

      {/* Language Policy Standard Notice */}
      <div className="p-4 bg-[#e5f0eb]/60 border border-[#c2d3c9] rounded-2xl flex items-center gap-3 text-xs text-[#0c2e1f] font-medium">
        <Globe className="w-5 h-5 text-[#0c2e1f] flex-shrink-0" />
        <div>
          <span className="font-bold text-[#0c2e1f]">
            {locale === "uz" ? "Til standarti: " : "Языковой стандарт: "}
          </span>
          {locale === "uz"
            ? "O‘zbek tili qat’iy ravishda Lotin alifbosida (kirill ishlatilmaydi), Rus tili esa toza ruscha yoziladi."
            : "Узбекский язык строго на латинице (без кириллицы), русский язык на грамотном русском."}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-4 sm:gap-6 overflow-x-auto text-sm font-bold scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("hero")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "hero"
              ? "border-[#0c2e1f] text-[#0c2e1f]"
              : "border-transparent text-slate-500 hover:text-slate-900"
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
              ? "border-[#0c2e1f] text-[#0c2e1f]"
              : "border-transparent text-slate-500 hover:text-slate-900"
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
              ? "border-[#0c2e1f] text-[#0c2e1f]"
              : "border-transparent text-slate-500 hover:text-slate-900"
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
              ? "border-[#0c2e1f] text-[#0c2e1f]"
              : "border-transparent text-slate-500 hover:text-slate-900"
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
              ? "border-[#0c2e1f] text-[#0c2e1f]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Search className="w-4 h-4" />
          {locale === "uz" ? "SEO & Meta" : "SEO и мета"}
        </button>
      </div>

      {/* 1. HERO SECTION */}
      {activeTab === "hero" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0c2e1f]" />
              {locale === "uz" ? "Hero Sarlavhalari va Nishon (Badge)" : "Заголовки и значок Hero"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
                  placeholder="ANGREN KO‘CHMAS MULKI"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
                  placeholder="НЕДВИЖИМОСТЬ АНГРЕНА"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
                  placeholder="Angrendagi ko‘chmas mulk — bir xaritada"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
                  placeholder="Недвижимость Ангрена — на одной карте"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
                  placeholder="Kvartiralar, hovlilar va tijorat binolarini shahar xaritasida qulay toping"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
                  placeholder="Удобный поиск квартир, домов и коммерческой недвижимости на карте города"
                />
              </div>
            </div>
          </div>

          {/* Hero Live Preview Card */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div className="text-xs font-bold text-[#0c2e1f] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {locale === "uz" ? "Jonli ko‘rinish namoyishi" : "Живой предпросмотр"}
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs text-center space-y-3">
              <span className="inline-block px-3 py-1 rounded-full bg-[#e5f0eb]/60 border border-[#c2d3c9] text-[11px] font-bold text-[#0c2e1f]">
                {locale === "uz" ? payload.hero.badge_uz : payload.hero.badge_ru}
              </span>
              <h3 className="text-xl md:text-2xl font-black text-slate-900">
                {locale === "uz" ? payload.hero.title_uz : payload.hero.title_ru}
              </h3>
              <p className="text-sm text-slate-600 max-w-xl mx-auto font-medium">
                {locale === "uz" ? payload.hero.subtitle_uz : payload.hero.subtitle_ru}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABOUT US SECTION */}
      {activeTab === "about" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0c2e1f]" />
            {locale === "uz" ? "'Biz Haqimizda' Sahifasi Matnlari" : "Тексты страницы 'О нас'"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. CONTACTS SECTION */}
      {activeTab === "contacts" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#0c2e1f]" />
            {locale === "uz" ? "Kompaniya va Bosh Ofis Kontaktlari" : "Контакты компании и головного офиса"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. ANNOUNCEMENT SECTION */}
      {activeTab === "announcement" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#0c2e1f]" />
                {locale === "uz" ? "Saytning Yuqori Qismidagi E’lon Banneri" : "Верхний баннер объявлений сайта"}
              </h2>
              <p className="text-xs text-slate-600 font-medium mt-1">
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
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0c2e1f]"></div>
              <span className="ml-3 text-xs font-bold text-slate-700">
                {payload.announcement.is_active
                  ? locale === "uz" ? "Faol (Ko‘rinmoqda)" : "Активен"
                  : locale === "uz" ? "O‘chirilgan" : "Отключен"}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
                placeholder="/sotib-olish"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Banner Uslubi / Rangi
              </label>
              <div className="flex items-center gap-3">
                {[
                  { id: "info", uz: "Axborot (Yashil)", color: "border-[#19573c] bg-[#e5f0eb]/60 text-[#0c2e1f]" },
                  { id: "warning", uz: "Ogohlantirish (Sariq)", color: "border-amber-600 bg-amber-50 text-amber-800" },
                  { id: "success", uz: "Muvaffaqiyat (Yorqin)", color: "border-[#19573c] bg-[#e5f0eb]/60 text-[#0c2e1f]" },
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
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      payload.announcement.type === item.id
                        ? `${item.color} shadow-sm ring-1 ring-emerald-600`
                        : "border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
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
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-600">
                {locale === "uz" ? "Banner ko‘rinishi:" : "Предпросмотр баннера:"}
              </div>
              <div
                className={`p-3 rounded-xl border text-center text-xs font-bold flex items-center justify-center gap-2 ${
                  payload.announcement.type === "warning"
                    ? "bg-amber-50 text-amber-900 border-amber-300"
                    : payload.announcement.type === "success"
                    ? "bg-[#e5f0eb]/60 text-[#0c2e1f] border-[#c2d3c9]"
                    : "bg-[#e5f0eb]/60 text-[#0c2e1f] border-[#c2d3c9]"
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-[#0c2e1f]" />
            {locale === "uz" ? "Qidiruv Tizimi va Meta Sozlamalari (SEO)" : "Поисковая оптимизация и метатеги (SEO)"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#0c2e1f] focus:ring-1 focus:ring-[#0c2e1f]"
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
          className="flex items-center gap-2 px-6 py-3 bg-[#0c2e1f] hover:bg-[#19573c] text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50"
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
