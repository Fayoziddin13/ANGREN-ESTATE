"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  PhoneCall,
  Send,
  Heart,
  Search,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Smartphone,
  Monitor,
  Building2,
  PieChart,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  Download,
  RefreshCw,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProperties } from "@/lib/propertyStore";
import { useLeads } from "@/lib/leadStore";
import { AnalyticsDashboardPayload, AnalyticsEvent } from "@/lib/types";

type TimeRange = "today" | "7d" | "30d" | "3m" | "6m" | "1y" | "all";

export default function AdminAnalyticsPage() {
  const { locale } = useLanguage();
  const { properties } = useProperties();
  const { leads } = useLeads();

  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [activeTab, setActiveTab] = useState<"demand" | "supply" | "outcomes" | "traffic">("demand");
  const [data, setData] = useState<AnalyticsDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?range=${timeRange}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const payload: AnalyticsDashboardPayload = await res.json();
        if (payload.success) {
          setData(payload);
        } else {
          setError("Ma'lumotlarni yuklab bo'lmadi");
        }
      } else {
        setError(`Server xatosi (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || "Tarmoq xatosi");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Listen for real-time analytics events dispatched locally
  useEffect(() => {
    const handleEventChange = () => {
      loadAnalytics();
    };
    window.addEventListener("angren_estate_analytics_change", handleEventChange);
    return () => window.removeEventListener("angren_estate_analytics_change", handleEventChange);
  }, [loadAnalytics]);

  // Extract canonical database KPIs or fallback to zero baseline
  const kpis = data?.kpis || {
    total_visits: 0,
    unique_visitors: 0,
    phone_calls: 0,
    telegram_chats: 0,
    favorites_added: 0,
    searches_executed: 0,
    avg_session: "0m 00s",
    bounce_rate: "0.0%",
  };

  const devices = data?.devices || [
    { name: "Apple iPhone (iOS)", percent: 56, count: 0 },
    { name: "Android Smartphone", percent: 34, count: 0 },
    { name: "Desktop (Chrome / Mac / Win)", percent: 10, count: 0 },
    { name: "Tablet (iPad / Android Tablet)", percent: 0, count: 0 },
  ];

  const trafficSources = data?.traffic_sources || [
    { name: "Telegram kanallar va guruhlar", percent: 44, visits: 0, color: "bg-sky-500" },
    { name: "Instagram stories va bio link", percent: 28, visits: 0, color: "bg-pink-500" },
    { name: "Google Qidiruv (SEO organik)", percent: 18, visits: 0, color: "bg-emerald-500" },
    { name: "To‘g‘ridan-to‘g‘ri (Direct / Bookmark)", percent: 10, visits: 0, color: "bg-amber-500" },
  ];

  const propertyTypesDemand = data?.property_types_demand || [
    { type_uz: "Kvartiralar", type_ru: "Квартиры", percentage: 54, views: 0, growth: "+14%" },
    { type_uz: "Hovli va Kottejlar", type_ru: "Дома и коттеджи", percentage: 26, views: 0, growth: "+8%" },
    { type_uz: "Tijorat maydonlari", type_ru: "Коммерческая", percentage: 14, views: 0, growth: "+19%" },
    { type_uz: "Yer uchastkalari", type_ru: "Земельные участки", percentage: 6, views: 0, growth: "+4%" },
  ];

  const districtsData = data?.districts_data || [];
  const outcomes = data?.outcomes || {
    closed_deals: 0,
    sold_count: 0,
    rented_count: 0,
    active_supply: 0,
    avg_days_on_market: 22,
    conversion_rate: "0.0%",
  };
  const liveEvents = data?.recent_events || [];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
            {locale === "uz" ? "Analitika Markazi" : "Центр Аналитики"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {locale === "uz"
              ? "Supabase asosidagi haqiqiy talab, taklif va biznes ko‘rsatkichlari"
              : "Реальная статистика спроса, предложения и результатов платформы на базе Supabase"}
          </p>
        </div>

        {/* Date Filters & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 flex-wrap">
            {(
              [
                { id: "today", uz: "Bugun", ru: "Сегодня" },
                { id: "7d", uz: "7 kun", ru: "7 дней" },
                { id: "30d", uz: "30 kun", ru: "30 дней" },
                { id: "3m", uz: "3 oy", ru: "3 месяца" },
                { id: "6m", uz: "6 oy", ru: "6 месяцев" },
                { id: "1y", uz: "1 yil", ru: "1 год" },
                { id: "all", uz: "Barchasi", ru: "Всё время" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  timeRange === t.id
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {locale === "uz" ? t.uz : t.ru}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadAnalytics()}
            disabled={loading}
            title={locale === "uz" ? "Yangilash" : "Обновить"}
            className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Top Overview KPI Cards (Database Driven) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {locale === "uz" ? "Tashriflar" : "Посещения"}
            </span>
            <Eye className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2">{kpis.total_visits.toLocaleString()}</div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 mt-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Haqiqiy faollik</span>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {locale === "uz" ? "Unikal Foydalanuvchilar" : "Уникальные гости"}
            </span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2">{kpis.unique_visitors.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">
            {locale === "uz" ? "O‘rtacha vaqt:" : "Среднее время:"} <span className="text-white font-medium">{kpis.avg_session}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              {locale === "uz" ? "Telefon Qo‘ng‘iroqlar" : "Клики звонков"}
            </span>
            <PhoneCall className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-300 mt-2">{kpis.phone_calls}</div>
          <div className="text-xs text-slate-400 mt-1">
            {locale === "uz" ? "Konversiya:" : "Конверсия:"} <span className="text-blue-300 font-medium">{outcomes.conversion_rate}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-sky-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Telegram Chat
            </span>
            <Send className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-300 mt-2">{kpis.telegram_chats}</div>
          <div className="text-xs text-slate-400 mt-1">
            {locale === "uz" ? "Telegram orqali murojaat" : "Обращения в Telegram"}
          </div>
        </div>
      </div>

      {/* Navigation Tabs: DEMAND vs SUPPLY vs OUTCOMES vs TRAFFIC */}
      <div className="border-b border-slate-800 flex items-center gap-6 overflow-x-auto text-sm font-semibold">
        <button
          onClick={() => setActiveTab("demand")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "demand"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          {locale === "uz" ? "1. TALAB (Demand)" : "1. СПРОС (Demand)"}
        </button>

        <button
          onClick={() => setActiveTab("supply")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "supply"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Building2 className="w-4 h-4" />
          {locale === "uz" ? "2. TAKLIF (Supply)" : "2. ПРЕДЛОЖЕНИЕ (Supply)"}
        </button>

        <button
          onClick={() => setActiveTab("outcomes")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "outcomes"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {locale === "uz" ? "3. NATIJALAR (Outcomes)" : "3. РЕЗУЛЬТАТЫ (Outcomes)"}
        </button>

        <button
          onClick={() => setActiveTab("traffic")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "traffic"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Compass className="w-4 h-4" />
          {locale === "uz" ? "4. TRAFIK VA QURILMALAR" : "4. ТРАФИК И УСТРОЙСТВА"}
        </button>
      </div>

      {/* TAB 1: DEMAND */}
      {activeTab === "demand" && (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
            <HelpCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">
                {locale === "uz" ? "Talab analitikasi metodologiyasi: " : "Методология аналитики спроса: "}
              </span>
              {locale === "uz"
                ? "Foydalanuvchilarning ko‘rishlari, filter qidiruvlari, sevimlilarga qo‘shishlari va telefon/telegram tugmalariga bosishlari asosida hisoblangan haqiqiy bozor qiziqishi."
                : "Реальный рыночный интерес, рассчитанный на основе просмотров, поисковых фильтров, добавлений в избранное и кликов по контактам."}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Property Types Demand */}
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-400" />
                {locale === "uz" ? "Mulk turlari bo‘yicha talab" : "Спрос по типам недвижимости"}
              </h3>
              <div className="space-y-4">
                {propertyTypesDemand.map((item) => (
                  <div key={item.type_uz} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-200">{locale === "uz" ? item.type_uz : item.type_ru}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400">{item.views} ta ko‘rish</span>
                        <span className="text-white font-mono">{item.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                {locale === "uz" ? "Qidiruv va Interaktivlik" : "Поиск и интерактивность"}
              </h3>
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-300">Bajarilgan qidiruvlar & filtrlar</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">{kpis.searches_executed}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-300">Sevimlilarga qo‘shilgan</span>
                  <span className="text-lg font-bold font-mono text-rose-400">{kpis.favorites_added}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-300">Jami telefon va telegram kontaktlari</span>
                  <span className="text-lg font-bold font-mono text-sky-400">{kpis.phone_calls + kpis.telegram_chats}</span>
                </div>
              </div>
            </div>
          </div>

          {/* District Demand Table */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl border border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {locale === "uz" ? "Angren tumanlari bo‘yicha talab ko‘rsatkichlari" : "Показатели спроса по районам Ангрена"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-4">{locale === "uz" ? "Tuman / Hudud" : "Район / Локация"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Ko‘rishlar" : "Просмотры"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Qidiruvlar" : "Поиски"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Bozor holati" : "Состояние рынка"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {districtsData.map((d) => (
                    <tr key={d.name_uz} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {locale === "uz" ? d.name_uz : d.name_ru}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        {d.views.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {d.searches.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {locale === "uz" ? d.ratio : d.ratio_ru}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLY */}
      {activeTab === "supply" && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
            <HelpCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">
                {locale === "uz" ? "Taklif analitikasi metodologiyasi: " : "Методология аналитики предложения: "}
              </span>
              {locale === "uz"
                ? "Bozorda mavjud bo‘lgan barcha faol e’lonlar soni, o‘rtacha 1 m² narxi va segmentlar taqsimoti."
                : "Количество активных объявлений на рынке, средняя цена 1 м² и распределение по сегментам."}
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl border border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {locale === "uz" ? "Tumanlar bo‘yicha taklif va o‘rtacha narxlar" : "Предложение и средние цены по районам"}
              </h3>
              <span className="text-xs text-emerald-400 font-semibold font-mono">
                {outcomes.active_supply} {locale === "uz" ? "faol e'lon" : "активных объявлений"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-4">{locale === "uz" ? "Tuman" : "Район"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Faol E’lonlar" : "Активные объявления"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "O‘rtacha narx / m²" : "Средняя цена / м²"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Taklif ulushi" : "Доля предложения"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {districtsData.map((d) => (
                    <tr key={d.name_uz} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {locale === "uz" ? d.name_uz : d.name_ru}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-white">
                        {d.supply_count} {locale === "uz" ? "ta obyekt" : "объектов"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400">
                        {d.avg_price_sqm}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-32 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((d.supply_count / Math.max(1, outcomes.active_supply)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OUTCOMES */}
      {activeTab === "outcomes" && (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
            <HelpCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">
                {locale === "uz" ? "Natijalar (Outcomes) qat’iy qoidasi: " : "Строгое правило результатов: "}
              </span>
              {locale === "uz"
                ? "Faqat haqiqatda sotilgan/ijaraga berilgan bitimlar va bozorda turish kunlari (Days on Market) asosida hisoblanadi. Ko‘rishlar soni sotuv natijasini anglatmaydi."
                : "Рассчитывается строго на основе фактически закрытых сделок (продано/сдано) и времени экспозиции (Days on Market). Количество просмотров не подменяет результат продаж."}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-slate-800 text-center">
              <div className="text-xs text-slate-400 uppercase font-semibold">
                {locale === "uz" ? "Yopilgan Bitimlar" : "Закрытые сделки"}
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-2">
                {outcomes.closed_deals}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {outcomes.sold_count} {locale === "uz" ? "sotildi" : "продано"} • {outcomes.rented_count} {locale === "uz" ? "ijara" : "аренда"}
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-slate-800 text-center">
              <div className="text-xs text-slate-400 uppercase font-semibold">
                {locale === "uz" ? "Bozorda Turish Muddati" : "Время экспозиции"}
              </div>
              <div className="text-3xl font-extrabold text-white mt-2">
                {outcomes.avg_days_on_market} {locale === "uz" ? "kun" : "дня"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {locale === "uz" ? "O‘rtacha sotilish vaqti" : "Средний срок сделки"}
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-slate-800 text-center">
              <div className="text-xs text-slate-400 uppercase font-semibold">
                {locale === "uz" ? "Konversiya Samaradorligi" : "Эффективность воронки"}
              </div>
              <div className="text-3xl font-extrabold text-blue-400 mt-2">
                {outcomes.conversion_rate}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {locale === "uz" ? "Ko‘rishdan qo‘ng‘iroqqacha" : "Из просмотра в звонок"}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-md rounded-3xl border border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {locale === "uz" ? "Tumanlar bo‘yicha yopilgan bitimlar va tezlik" : "Закрытые сделки и скорость по районам"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-4">{locale === "uz" ? "Tuman" : "Район"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Muvaffaqiyatli Bitimlar" : "Успешные сделки"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "O‘rtacha muddat (kun)" : "Срок продажи (дни)"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Likvidlik darajasi" : "Уровень ликвидности"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {districtsData.map((d) => (
                    <tr key={d.name_uz} className="hover:bg-slate-800/30">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {locale === "uz" ? d.name_uz : d.name_ru}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {d.closed_deals} ta
                      </td>
                      <td className="py-3.5 px-4 font-mono text-white">
                        {d.avg_days_on_market} {locale === "uz" ? "kun" : "дней"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {d.avg_days_on_market < 25 ? "Yuqori likvid" : "O‘rta likvid"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRAFFIC & DEVICES */}
      {activeTab === "traffic" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Traffic Sources */}
          <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-400" />
              {locale === "uz" ? "Trafik manbalari taqsimoti" : "Источники трафика"}
            </h3>
            <div className="space-y-4">
              {trafficSources.map((source) => (
                <div key={source.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-200">{source.name}</span>
                    <span className="text-white font-mono">
                      {source.percent}% ({source.visits.toLocaleString()})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${source.color} rounded-full transition-all duration-500`}
                      style={{ width: `${source.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Devices */}
          <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              {locale === "uz" ? "Foydalanuvchi qurilmalari" : "Устройства пользователей"}
            </h3>
            <div className="space-y-4">
              {devices.map((device) => {
                const isPhone = device.name.includes("iPhone") || device.name.includes("Android");
                const Icon = isPhone ? Smartphone : Monitor;
                return (
                  <div
                    key={device.name}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{device.name}</div>
                        <div className="text-xs text-slate-400">{device.count.toLocaleString()} tashrif</div>
                      </div>
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-400">{device.percent}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* REAL-TIME EVENT STREAM (Direct from Supabase public.analytics_events) */}
      <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800 space-y-4 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <h3 className="text-base font-bold text-white">
              {locale === "uz"
                ? "Jonli foydalanuvchi faolligi (Supabase Real-time Stream)"
                : "Действия пользователей в реальном времени (Supabase Stream)"}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">
              {liveEvents.length} {locale === "uz" ? "ta qayd etilgan voqea" : "зафиксированных событий"}
            </span>
            {data?.db_duration_ms !== undefined && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/50">
                DB: {data.db_duration_ms}ms
              </span>
            )}
          </div>
        </div>

        {liveEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            {locale === "uz"
              ? "Hozircha yangi voqealar yo‘q. Saytda harakatlar sodir bo‘lganda bu yerda avtomatik ko‘rinadi."
              : "Пока нет новых событий. При взаимодействии с сайтом они автоматически появятся здесь."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">Voqea turi</th>
                  <th className="py-2.5 px-3">Qurilma</th>
                  <th className="py-2.5 px-3">Trafik</th>
                  <th className="py-2.5 px-3">Tafsilotlar</th>
                  <th className="py-2.5 px-3 text-right">Vaqt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {liveEvents.slice(0, 20).map((evt) => {
                  const isCall = evt.event_type === "phone_click";
                  const isTg = evt.event_type === "telegram_click";
                  const isFav = evt.event_type.startsWith("favorite");
                  const isView = evt.event_type.includes("view");

                  const badgeClass = isCall
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : isTg
                    ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                    : isFav
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : isView
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-purple-500/10 text-purple-400 border-purple-500/30";

                  return (
                    <tr key={evt.id || Math.random().toString()} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass}`}>
                          {evt.event_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-medium">{evt.device || "Desktop"}</td>
                      <td className="py-2.5 px-3 text-slate-300">{evt.traffic_source || "Direct"}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                        {evt.property_id ? `ID: ${evt.property_id}` : ""}
                        {evt.metadata ? ` ${JSON.stringify(evt.metadata)}` : ""}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-right font-mono">
                        {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
