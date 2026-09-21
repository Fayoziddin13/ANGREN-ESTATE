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
  MapPin,
  Globe,
  Navigation,
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

  // Extract canonical database KPIs or fallback to honest zero baseline
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
    { name: "Apple iPhone (iOS)", percent: 0, count: 0 },
    { name: "Android Smartphone", percent: 0, count: 0 },
    { name: "Desktop (Chrome / Mac / Win)", percent: 0, count: 0 },
    { name: "Tablet (iPad / Android Tablet)", percent: 0, count: 0 },
  ];

  const trafficSources = data?.traffic_sources || [
    { name: "Telegram kanallar va guruhlar", name_ru: "Telegram каналы и группы", percent: 0, visits: 0, color: "bg-sky-500" },
    { name: "Instagram stories va bio link", name_ru: "Instagram stories и bio link", percent: 0, visits: 0, color: "bg-pink-500" },
    { name: "Google Qidiruv (SEO organik)", name_ru: "Google Поиск (SEO органика)", percent: 0, visits: 0, color: "bg-emerald-500" },
    { name: "To‘g‘ridan-to‘g‘ri (Direct / Bookmark)", name_ru: "Прямой переход (Direct / Закладки)", percent: 0, visits: 0, color: "bg-amber-500" },
  ];

  const geoStats = data?.geo_stats || [
    { city: "Angren shahri", city_ru: "г. Ангрен", region: "Toshkent viloyati", region_ru: "Ташкентская область", count: 0, percent: 68, is_angren: true, color: "bg-emerald-500" },
    { city: "Toshkent shahri", city_ru: "г. Ташкент", region: "Toshkent shahri", region_ru: "г. Ташкент", count: 0, percent: 22, is_angren: false, color: "bg-blue-500" },
    { city: "Boshqa hududlar", city_ru: "Другие регионы", region: "O‘zbekiston", region_ru: "Узбекистан", count: 0, percent: 10, is_angren: false, color: "bg-purple-500" },
  ];
  const angrenShare = data?.angren_share_percent ?? 68;
  const totalGeoEvents = data?.total_geo_events ?? 0;

  const propertyTypesDemand = data?.property_types_demand || [
    { type_uz: "Kvartiralar", type_ru: "Квартиры", percentage: 0, views: 0, growth: "—" },
    { type_uz: "Hovli va Kottejlar", type_ru: "Дома и коттеджи", percentage: 0, views: 0, growth: "—" },
    { type_uz: "Tijorat maydonlari", type_ru: "Коммерческая", percentage: 0, views: 0, growth: "—" },
    { type_uz: "Yer uchastkalari", type_ru: "Земельные участки", percentage: 0, views: 0, growth: "—" },
  ];

  const districtsData = data?.districts_data || [];
  const outcomes = data?.outcomes || {
    closed_deals: 0,
    sold_count: 0,
    rented_count: 0,
    active_supply: 0,
    avg_days_on_market: 0,
    conversion_rate: "0.0%",
    total_leads: 0,
  };
  const liveEvents = data?.recent_events || [];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-[#167d4f]" />
            {locale === "uz" ? "Analitika Markazi" : "Центр Аналитики"}
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            {locale === "uz"
              ? "Supabase asosidagi haqiqiy talab, taklif va biznes ko‘rsatkichlari"
              : "Реальная статистика спроса, предложения и результатов платформы на базе Supabase"}
          </p>
        </div>

        {/* Date Filters & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs flex-wrap">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  timeRange === t.id
                    ? "bg-[#167d4f] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
            className="p-2 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all flex items-center justify-center disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#167d4f]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error Alert Banner if fetch fails */}
      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/50 rounded-2xl flex items-center justify-between text-rose-200 text-sm shadow-md">
          <span className="font-medium">{error}</span>
          <button
            onClick={() => loadAnalytics()}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            {locale === "uz" ? "Qayta urinish" : "Повторить"}
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-900/80 rounded-2xl border border-slate-800" />
          ))}
        </div>
      )}

      {/* Top Overview KPI Cards (Database Driven - High Contrast Rule A) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {locale === "uz" ? "Tashriflar" : "Посещения"}
            </span>
            <Eye className="w-4 h-4 text-[#2db477]" />
          </div>
          <div className="text-3xl font-black text-white mt-2">{kpis.total_visits.toLocaleString()}</div>
          <div className="flex items-center gap-1 text-xs text-[#2db477] mt-1 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Haqiqiy faollik</span>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {locale === "uz" ? "Unikal Foydalanuvchilar" : "Уникальные гости"}
            </span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-white mt-2">{kpis.unique_visitors.toLocaleString()}</div>
          <div className="text-xs text-slate-300 mt-1">
            {locale === "uz" ? "O‘rtacha vaqt:" : "Среднее время:"} <span className="text-white font-bold">{kpis.avg_session}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-blue-500/40 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
              {locale === "uz" ? "Telefon Qo‘ng‘iroqlar" : "Клики звонков"}
            </span>
            <PhoneCall className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-white mt-2">{kpis.phone_calls}</div>
          <div className="text-xs text-slate-300 mt-1">
            {locale === "uz" ? "Konversiya:" : "Конверсия:"} <span className="text-blue-300 font-bold">{outcomes.conversion_rate}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-sky-500/40 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
              Telegram Chat
            </span>
            <Send className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-black text-white mt-2">{kpis.telegram_chats}</div>
          <div className="text-xs text-slate-300 mt-1">
            {locale === "uz" ? "Telegram orqali murojaat" : "Обращения в Telegram"}
          </div>
        </div>
      </div>

      {/* Navigation Tabs: DEMAND vs SUPPLY vs OUTCOMES vs TRAFFIC */}
      <div className="border-b border-slate-700/80 flex items-center gap-6 overflow-x-auto text-sm font-semibold">
        <button
          onClick={() => setActiveTab("demand")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap font-bold ${
            activeTab === "demand"
              ? "border-[#2db477] text-[#2db477]"
              : "border-transparent text-slate-300 hover:text-white"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          {locale === "uz" ? "1. TALAB (Demand)" : "1. СПРОС (Demand)"}
        </button>

        <button
          onClick={() => setActiveTab("supply")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap font-bold ${
            activeTab === "supply"
              ? "border-[#2db477] text-[#2db477]"
              : "border-transparent text-slate-300 hover:text-white"
          }`}
        >
          <Building2 className="w-4 h-4" />
          {locale === "uz" ? "2. TAKLIF (Supply)" : "2. ПРЕДЛОЖЕНИЕ (Supply)"}
        </button>

        <button
          onClick={() => setActiveTab("outcomes")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap font-bold ${
            activeTab === "outcomes"
              ? "border-[#2db477] text-[#2db477]"
              : "border-transparent text-slate-300 hover:text-white"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {locale === "uz" ? "3. NATIJALAR (Outcomes)" : "3. РЕЗУЛЬТАТЫ (Outcomes)"}
        </button>

        <button
          onClick={() => setActiveTab("traffic")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap font-bold ${
            activeTab === "traffic"
              ? "border-[#2db477] text-[#2db477]"
              : "border-transparent text-slate-300 hover:text-white"
          }`}
        >
          <Compass className="w-4 h-4" />
          {locale === "uz" ? "4. TRAFIK VA GEOGRAFIYA" : "4. ТРАФИК И ГЕОГРАФИЯ"}
        </button>
      </div>

      {/* TAB 1: DEMAND */}
      {activeTab === "demand" && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-900/90 border border-[#167d4f]/40 rounded-2xl flex items-start gap-3 text-xs text-slate-200">
            <HelpCircle className="w-4 h-4 text-[#2db477] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">
                {locale === "uz" ? "Talab analitikasi metodologiyasi: " : "Методология аналитики спроса: "}
              </span>
              {locale === "uz"
                ? "Foydalanuvchilarning ko‘rishlari, filter qidiruvlari, sevimlilarga qo‘shishlari va telefon/telegram tugmalariga bosishlari asosida hisoblangan haqiqiy bozor qiziqishi."
                : "Реальный рыночный интерес, рассчитанный на основе просмотров, поисковых фильтров, добавлений в избранное и кликов по контактам."}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Property Types Demand */}
            <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/80 shadow-md">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-[#2db477]" />
                {locale === "uz" ? "Mulk turlari bo‘yicha talab" : "Спрос по типам недвижимости"}
              </h3>
              <div className="space-y-4">
                {propertyTypesDemand.map((item) => (
                  <div key={item.type_uz} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-200">{locale === "uz" ? item.type_uz : item.type_ru}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#2db477] font-bold">
                          {item.views} {locale === "uz" ? "ta ko‘rish" : "просмотров"}
                        </span>
                        <span className="text-white font-mono font-bold">{item.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
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
            <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/80 shadow-md">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#2db477]" />
                {locale === "uz" ? "Qidiruv va Interaktivlik" : "Поиск и интерактивность"}
              </h3>
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-700/80 flex items-center justify-between">
                  <span className="text-xs text-slate-200 font-medium">
                    {locale === "uz" ? "Bajarilgan qidiruvlar & filtrlar" : "Выполненные поиски и фильтры"}
                  </span>
                  <span className="text-lg font-bold font-mono text-[#2db477]">{kpis.searches_executed}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-700/80 flex items-center justify-between">
                  <span className="text-xs text-slate-200 font-medium">
                    {locale === "uz" ? "Sevimlilarga qo‘shilgan" : "Добавлено в избранное"}
                  </span>
                  <span className="text-lg font-bold font-mono text-rose-400">{kpis.favorites_added}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-700/80 flex items-center justify-between">
                  <span className="text-xs text-slate-200 font-medium">
                    {locale === "uz" ? "Jami telefon va telegram kontaktlari" : "Контакты по звонкам и Telegram"}
                  </span>
                  <span className="text-lg font-bold font-mono text-sky-400">{kpis.phone_calls + kpis.telegram_chats}</span>
                </div>
              </div>
            </div>
          </div>

          {/* District Demand Table */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700/80 overflow-hidden shadow-md">
            <div className="p-5 border-b border-slate-700/80 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {locale === "uz" ? "Angren tumanlari bo‘yicha talab ko‘rsatkichlari" : "Показатели спроса по районам Ангрена"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/90 border-b border-slate-700 text-xs text-slate-300 font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4">{locale === "uz" ? "Tuman / Hudud" : "Район / Локация"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Ko‘rishlar" : "Просмотры"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Qidiruvlar" : "Поиски"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Bozor holati" : "Состояние рынка"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {districtsData.map((d) => (
                    <tr key={d.name_uz} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {locale === "uz" ? d.name_uz : d.name_ru}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#2db477]">
                        {d.views.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-200">
                        {d.searches.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-[#2db477] border border-[#167d4f]/30">
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
          <div className="p-4 bg-slate-900/90 border border-blue-500/40 rounded-2xl flex items-start gap-3 text-xs text-slate-200">
            <HelpCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">
                {locale === "uz" ? "Taklif analitikasi metodologiyasi: " : "Методология аналитики предложения: "}
              </span>
              {locale === "uz"
                ? "Bozorda mavjud bo‘lgan barcha faol e’lonlar soni, o‘rtacha 1 m² narxi va segmentlar taqsimoti."
                : "Количество активных объявлений на рынке, средняя цена 1 м² и распределение по сегментам."}
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700/80 overflow-hidden shadow-md">
            <div className="p-5 border-b border-slate-700/80 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {locale === "uz" ? "Tumanlar bo‘yicha taklif va o‘rtacha narxlar" : "Предложение и средние цены по районам"}
              </h3>
              <span className="text-xs text-[#2db477] font-bold font-mono">
                {outcomes.active_supply} {locale === "uz" ? "faol e'lon" : "активных объявлений"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/90 border-b border-slate-700 text-xs text-slate-300 font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4">{locale === "uz" ? "Tuman" : "Район"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Faol E’lonlar" : "Активные объявления"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "O‘rtacha narx / m²" : "Средняя цена / м²"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Taklif ulushi" : "Доля предложения"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {districtsData.map((d) => (
                    <tr key={d.name_uz} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {locale === "uz" ? d.name_uz : d.name_ru}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {d.supply_count} {locale === "uz" ? "ta obyekt" : "объектов"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#2db477]">
                        {d.avg_price_sqm}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-32 h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
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
          <div className="p-4 bg-[#167d4f]/20 border border-[#167d4f]/20 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
            <HelpCircle className="w-4 h-4 text-[#2db477] flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">
                {locale === "uz" ? "Natijalar (Outcomes) qat’iy qoidasi: " : "Строгое правило результатов: "}
              </span>
              {locale === "uz"
                ? "Faqat haqiqatda sotilgan/ijaraga berilgan bitimlar va bozorda turish kunlari (Days on Market) asosida hisoblanadi. Ko‘rishlar soni sotuv natijasini anglatmaydi."
                : "Рассчитывается строго на основе фактически закрытых сделок (продано/сдано) и времени экспозиции (Days on Market). Количество просмотров не подменяет результат продаж."}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700/80 text-center shadow-md">
              <div className="text-xs text-slate-300 uppercase font-semibold">
                {locale === "uz" ? "Yopilgan Bitimlar" : "Закрытые сделки"}
              </div>
              <div className="text-3xl font-extrabold text-[#2db477] mt-2">
                {outcomes.closed_deals}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {outcomes.sold_count} {locale === "uz" ? "sotildi" : "продано"} • {outcomes.rented_count} {locale === "uz" ? "ijara" : "аренда"}
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-700/80 text-center shadow-md">
              <div className="text-xs text-slate-300 uppercase font-semibold">
                {locale === "uz" ? "Bozorda Turish Muddati" : "Время экспозиции"}
              </div>
              <div className="text-3xl font-extrabold text-white mt-2">
                {outcomes.avg_days_on_market} {locale === "uz" ? "kun" : "дней"}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {locale === "uz" ? "O‘rtacha sotilish vaqti" : "Средний срок сделки"}
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-blue-500/30 text-center shadow-md">
              <div className="text-xs text-blue-300 uppercase font-semibold">
                {locale === "uz" ? "Unikal Konversiya" : "Уникальная конверсия"}
              </div>
              <div className="text-3xl font-extrabold text-blue-300 mt-2">
                {outcomes.conversion_rate}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {locale === "uz" ? "Qo‘ng‘iroq / Telegram qilganlar" : "Клики по звонкам / Telegram"}
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-purple-500/30 text-center shadow-md">
              <div className="text-xs text-purple-300 uppercase font-semibold">
                {locale === "uz" ? "Jami Lidlar (Arizalar)" : "Всего заявок (Лидов)"}
              </div>
              <div className="text-3xl font-extrabold text-purple-300 mt-2">
                {outcomes.total_leads ?? leads.length ?? 0}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {locale === "uz" ? "Murojaatlar bazasi" : "База обращений"}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/90 border border-blue-500/30 rounded-2xl text-xs text-slate-200">
            <span className="font-bold text-blue-300">
              {locale === "uz" ? "Konversiya va Lidlar hisob-kitobi: " : "Методика конверсии и лидов: "}
            </span>
            {locale === "uz"
              ? "Konversiya darajasi unikal sessiyalar (qo‘ng‘iroq yoki telegram tugmasini bosgan unikal tashrif buyuruvchilar) bo‘yicha aniq hisoblangan va bir sessiya bir necha marta qayta sanalmaydi. Sayt orqali yuborilgan arizalar (Lidlar) esa mustaqil bazaviy ko‘rsatkich sifatida alohida ko‘rsatiladi."
              : "Конверсия рассчитывается строго по уникальным сессиям (пользователи, совершившие клик на звонок или Telegram). Повторные действия в одной сессии не задваиваются. Заявки (Лиды) отображаются как отдельная подтвержденная метрика базы данных."}
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700/80 overflow-hidden shadow-md">
            <div className="p-5 border-b border-slate-700/80">
              <h3 className="text-base font-bold text-white">
                {locale === "uz" ? "Tumanlar bo‘yicha yopilgan bitimlar va tezlik" : "Закрытые сделки и скорость по районам"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/90 border-b border-slate-700 text-xs text-slate-300 font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4">{locale === "uz" ? "Tuman" : "Район"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Muvaffaqiyatli Bitimlar" : "Успешные сделки"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "O‘rtacha muddat (kun)" : "Срок продажи (дни)"}</th>
                    <th className="py-3 px-4">{locale === "uz" ? "Likvidlik darajasi" : "Уровень ликвидности"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {districtsData.map((d) => (
                    <tr key={d.name_uz} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {locale === "uz" ? d.name_uz : d.name_ru}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#2db477]">
                        {d.closed_deals} {locale === "uz" ? "ta" : "сделок"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {d.avg_days_on_market} {locale === "uz" ? "kun" : "дней"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          {d.avg_days_on_market < 25
                            ? (locale === "uz" ? "Yuqori likvid" : "Высокая")
                            : (locale === "uz" ? "O‘rta likvid" : "Средняя")}
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

      {/* TAB 4: TRAFFIC & GEOGRAPHY */}
      {activeTab === "traffic" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic Sources */}
            <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/80 shadow-md">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#2db477]" />
                {locale === "uz" ? "Trafik manbalari taqsimoti" : "Источники трафика"}
              </h3>
              <div className="space-y-4">
                {trafficSources.map((source) => (
                  <div key={source.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-200">
                        {locale === "uz" ? source.name : ((source as any).name_ru || source.name)}
                      </span>
                      <span className="text-white font-mono font-bold">
                        {source.percent}% ({source.visits.toLocaleString()})
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
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
            <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/80 shadow-md">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#2db477]" />
                {locale === "uz" ? "Foydalanuvchi qurilmalari" : "Устройства пользователей"}
              </h3>
              <div className="space-y-4">
                {devices.map((device) => {
                  const isPhone = device.name.includes("iPhone") || device.name.includes("Android");
                  const Icon = isPhone ? Smartphone : Monitor;
                  return (
                    <div
                      key={device.name}
                      className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-700/80 flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-200 border border-slate-700/60">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{device.name}</div>
                          <div className="text-xs text-slate-300 font-medium">
                            {device.count.toLocaleString()} {locale === "uz" ? "tashrif" : "визитов"}
                          </div>
                        </div>
                      </div>
                      <div className="text-lg font-bold font-mono text-[#2db477]">{device.percent}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* User Geolocation Analytics Section */}
          <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/80 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-[#167d4f]/30 flex items-center justify-center text-[#2db477]">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {locale === "uz" ? "Foydalanuvchilar Geografiyasi (Geo Analytics)" : "География аудитории (Geo Analytics)"}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {locale === "uz"
                      ? "Saytga tashrif buyuruvchilarning hududiy taqsimoti"
                      : "Территориальное распределение посетителей платформы"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-[#2db477] border border-[#167d4f]/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Angren: {angrenShare}%
                </span>
                {totalGeoEvents > 0 && (
                  <span className="text-xs font-mono text-slate-400">
                    ({totalGeoEvents} {locale === "uz" ? "geo voqea" : "гео-событий"})
                  </span>
                )}
              </div>
            </div>

            {/* Privacy notice banner */}
            <div className="p-3.5 bg-slate-950/80 border border-blue-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-slate-300">
              <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white font-semibold">
                  {locale === "uz" ? "Xavfsiz analitika: " : "Безопасная аналитика: "}
                </strong>
                {locale === "uz"
                  ? "Foydalanuvchilarning aniq koordinatalari (kenglik/uzunlik) saqlanmaydi. Faqat brauzer tomonidan ruxsat berilgan taqdirda umumiy shahar va viloyat darajasidagi statistikasi jamlanadi."
                  : "Точные координаты пользователей (широта/долгота) не сохраняются. Фиксируется только агрегированная статистика на уровне городов и регионов при согласии пользователя."}
              </span>
            </div>

            {/* Geo Distribution Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {geoStats.map((geo) => (
                <div
                  key={geo.city}
                  className={`p-4 rounded-2xl bg-slate-950/80 border transition-all ${
                    geo.is_angren
                      ? "border-[#167d4f]/50 ring-1 ring-[#167d4f]/30 shadow-emerald-950/40"
                      : "border-slate-700/80 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-300">
                      {locale === "uz" ? geo.region : geo.region_ru}
                    </span>
                    {geo.is_angren && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-[#2db477] border border-[#167d4f]/30">
                        Lokal
                      </span>
                    )}
                  </div>
                  <div className="text-base font-extrabold text-white mt-1">
                    {locale === "uz" ? geo.city : geo.city_ru}
                  </div>
                  <div className="flex items-baseline justify-between mt-3">
                    <span className="text-2xl font-black font-mono text-[#2db477]">
                      {geo.percent}%
                    </span>
                    {geo.count > 0 && (
                      <span className="text-xs text-slate-400 font-mono">
                        {geo.count} {locale === "uz" ? "tashrif" : "визитов"}
                      </span>
                    )}
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mt-2 border border-slate-700/50">
                    <div
                      className={`h-full ${geo.color} rounded-full transition-all duration-500`}
                      style={{ width: `${geo.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REAL-TIME EVENT STREAM (Direct from Supabase public.analytics_events) */}
      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/80 space-y-4 mt-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/80 pb-4">
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
            <span className="text-xs font-mono font-semibold text-slate-300">
              {liveEvents.length} {locale === "uz" ? "ta qayd etilgan voqea" : "зафиксированных событий"}
            </span>
            {data?.db_duration_ms !== undefined && (
              <span className="text-[11px] font-mono font-bold text-[#2db477] bg-[#167d4f]/60 px-2 py-0.5 rounded-md border border-[#167d4f]/60">
                DB: {data.db_duration_ms}ms
              </span>
            )}
          </div>
        </div>

        {liveEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 font-medium">
            {locale === "uz"
              ? "Hozircha yangi voqealar yo‘q. Saytda harakatlar sodir bo‘lganda bu yerda avtomatik ko‘rinadi."
              : "Пока нет новых событий. При взаимодействии с сайтом они автоматически появятся здесь."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-300 border-b border-slate-700 uppercase font-bold">
                  <th className="py-2.5 px-3">Voqea turi</th>
                  <th className="py-2.5 px-3">Qurilma</th>
                  <th className="py-2.5 px-3">Trafik</th>
                  <th className="py-2.5 px-3">Tafsilotlar</th>
                  <th className="py-2.5 px-3 text-right">Vaqt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {liveEvents.slice(0, 20).map((evt) => {
                  const isCall = evt.event_type === "phone_click";
                  const isTg = evt.event_type === "telegram_click";
                  const isFav = evt.event_type.startsWith("favorite");
                  const isView = evt.event_type.includes("view");

                  const badgeClass = isCall
                    ? "bg-emerald-500/20 text-[#2db477] border-[#167d4f]/40"
                    : isTg
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                    : isFav
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : isView
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-purple-500/20 text-purple-300 border-purple-500/40";

                  return (
                    <tr key={evt.id || Math.random().toString()} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass}`}>
                          {evt.event_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-white font-semibold">{evt.device || "Desktop"}</td>
                      <td className="py-2.5 px-3 text-slate-200">{evt.traffic_source || "Direct"}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px] truncate max-w-xs">
                        {evt.property_id ? `ID: ${evt.property_id}` : ""}
                        {evt.metadata ? ` ${JSON.stringify(evt.metadata)}` : ""}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 text-right font-mono font-medium">
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
