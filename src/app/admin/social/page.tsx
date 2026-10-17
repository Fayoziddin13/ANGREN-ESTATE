"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Share2,
  RefreshCw,
  Plus,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  Eye,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Check,
  X,
  Globe,
  Radio,
  FileText,
  Sliders,
  ChevronRight,
  TrendingUp,
  Landmark,
  Scale,
  Building,
  Key,
  Receipt,
  Lightbulb,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { NEWS_CATEGORIES } from "@/lib/types/news";
import type {
  RealEstateNews,
  NewsSource,
  NewsCategory,
  NewsStatus,
} from "@/lib/types/news";

export default function AdminSocialPage() {
  const { locale } = useLanguage();
  const isUz = locale === "uz";

  const [activeTab, setActiveTab] = useState<"news" | "sources">("news");
  const [newsList, setNewsList] = useState<RealEstateNews[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [previewNews, setPreviewNews] = useState<RealEstateNews | null>(null);
  const [editNews, setEditNews] = useState<RealEstateNews | null>(null);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isAddManualNewsOpen, setIsAddManualNewsOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<"channel" | "bot" | "both">("channel");
  const [publishLang, setPublishLang] = useState<"uz" | "ru" | "both">("uz");

  // Manual news form state
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualCategory, setManualCategory] = useState<NewsCategory>("market_prices");
  const [manualSummaryUz, setManualSummaryUz] = useState("");
  const [manualTakeawayUz, setManualTakeawayUz] = useState("");
  const [manualSummaryRu, setManualSummaryRu] = useState("");
  const [manualTakeawayRu, setManualTakeawayRu] = useState("");

  // New source form state
  const [sourceName, setSourceName] = useState("");
  const [sourceDomain, setSourceDomain] = useState("");
  const [sourceFeedUrl, setSourceFeedUrl] = useState("");
  const [sourceTrust, setSourceTrust] = useState<"official_gov" | "reputable_media" | "analytical_center">("reputable_media");

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [newsRes, sourcesRes] = await Promise.all([
        fetch("/api/admin/social/news"),
        fetch("/api/admin/social/sources"),
      ]);
      const newsData = await newsRes.json();
      const sourcesData = await sourcesRes.json();

      if (newsData.success) setNewsList(newsData.items || []);
      if (sourcesData.success) setSources(sourcesData.sources || []);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync Trigger
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/social/sources/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setSyncing(false);
    }
  };

  // Generate Brand Asset
  const handleGenerateAsset = async (newsId: string, lang: "uz" | "ru") => {
    try {
      const res = await fetch(`/api/admin/social/news/${newsId}/generate-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        if (previewNews && previewNews.id === newsId) {
          const updated = await fetch(`/api/admin/social/news/${newsId}`).then((r) => r.json());
          if (updated.success) setPreviewNews(updated.news);
        }
      }
    } catch (e) {
      console.error("Asset generation error:", e);
    }
  };

  // Publish News to Telegram
  const handlePublish = async () => {
    if (!previewNews) return;
    setPublishing(true);
    setPublishSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/social/news/${previewNews.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: publishTarget,
          language: publishLang,
          forceRepeat: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishSuccessMsg(
          isUz
            ? "Muvaffaqiyatli nashr qilindi!"
            : "Успешно опубликовано в Telegram!"
        );
        await loadData();
        setTimeout(() => {
          setPreviewNews(null);
          setPublishSuccessMsg(null);
        }, 1500);
      } else {
        alert(data.error || "Nashr qilishda xatolik yuz berdi");
      }
    } catch (e: any) {
      alert(e?.message || "Xatolik");
    } finally {
      setPublishing(false);
    }
  };

  // Filtered news
  const filteredNews = newsList.filter((n) => {
    if (selectedStatus !== "all" && n.status !== selectedStatus) return false;
    if (selectedCategory !== "all" && n.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inTitle = n.original_title.toLowerCase().includes(q);
      const inUz = n.translations?.uz?.title?.toLowerCase().includes(q);
      const inRu = n.translations?.ru?.title?.toLowerCase().includes(q);
      if (!inTitle && !inUz && !inRu) return false;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-md">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {isUz ? "Янги ижтимоий тармоқлар" : "Социальные сети и публикации"}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium">
                {isUz
                  ? "Ko‘chmas mulk yangiliklarini yig‘ish, ikki tilda tayyorlash va Telegram’ga nashr qilish"
                  : "Сбор новостей недвижимости, подготовка на 2 языках и публикация в Telegram"}
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-emerald-700" : ""}`} />
            {syncing
              ? isUz ? "Tekshirilmoqda..." : "Синхронизация..."
              : isUz ? "Hozir tekshirish" : "Синхронизировать"}
          </button>

          <button
            onClick={() => setIsAddManualNewsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white hover:bg-emerald-800 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {isUz ? "Yangilik qo‘shish" : "Добавить новость"}
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("news")}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all ${
            activeTab === "news"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          {isUz ? "Yangiliklar lentasi" : "Лента новостей"}
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-bold">
            {newsList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("sources")}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all ${
            activeTab === "sources"
              ? "border-emerald-700 text-emerald-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Radio className="w-4 h-4" />
          {isUz ? "Manbalar boshqaruvi" : "Управление источниками"}
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-bold">
            {sources.length}
          </span>
        </button>
      </div>

      {/* TAB 1: NEWS FEED */}
      {activeTab === "news" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {[
                { id: "all", labelUz: "Barchasi", labelRu: "Все" },
                { id: "discovered", labelUz: "Yangi", labelRu: "Новые" },
                { id: "needs_review", labelUz: "Tekshiruvda", labelRu: "На проверке" },
                { id: "ready", labelUz: "Tayyor", labelRu: "Готовы" },
                { id: "published", labelUz: "Nashr qilingan", labelRu: "Опубликованы" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStatus(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    selectedStatus === st.id
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {isUz ? st.labelUz : st.labelRu}
                </button>
              ))}
            </div>

            {/* Category Select */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full md:w-48 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="all">{isUz ? "Barcha kategoriyalar" : "Все категории"}</option>
                {Object.entries(NEWS_CATEGORIES).map(([catKey, cat]) => (
                  <option key={catKey} value={catKey}>
                    {isUz ? cat.uz : cat.ru}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* News List Items */}
          {loading ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-700 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold text-sm">
                {isUz ? "Yangiliklar yuklanmoqda..." : "Загрузка новостей..."}
              </p>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-bold text-base mb-1">
                {isUz ? "Hozircha yangiliklar topilmadi" : "Новости пока не найдены"}
              </p>
              <p className="text-slate-400 text-xs max-w-md mx-auto mb-4">
                {isUz
                  ? "Ishonchli RSS manbalarini tekshirish uchun «Hozir tekshirish» tugmasini bosing yoki qo‘lda yangilik kiriting."
                  : "Нажмите «Синхронизировать» для сбора новостей из проверенных RSS-источников."}
              </p>
              <button
                onClick={handleSyncAll}
                className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-800 transition-all"
              >
                {isUz ? "Hozir tekshirish" : "Синхронизировать"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredNews.map((news) => {
                const catMeta = NEWS_CATEGORIES[news.category] || NEWS_CATEGORIES.market_prices;
                const uzReady = Boolean(news.translations?.uz?.title);
                const ruReady = Boolean(news.translations?.ru?.title);
                const hasAsset = Boolean(news.assets?.uz?.public_url || news.assets?.ru?.public_url);
                const isPublished = news.status === "published";

                return (
                  <div
                    key={news.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Category Badge */}
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${catMeta.badgeColor}`}
                        >
                          {isUz ? catMeta.uz : catMeta.ru}
                        </span>

                        {/* Source Tag */}
                        <a
                          href={news.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700 transition-colors"
                        >
                          <Globe className="w-3 h-3" />
                          {news.source?.name || news.original_url.split("/")[2]}
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>

                        {/* Date */}
                        <span className="text-[11px] text-slate-400">
                          {new Date(news.published_at).toLocaleDateString(isUz ? "uz-UZ" : "ru-RU", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-snug group-hover:text-emerald-800 transition-colors">
                        {news.translations?.uz?.title || news.original_title}
                      </h3>

                      {/* Short summary */}
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {news.translations?.uz?.summary || news.translations?.ru?.summary || ""}
                      </p>

                      {/* Status Indicators */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md ${
                            uzReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {uzReady ? "UZ ✓" : "UZ ⏳"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md ${
                            ruReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {ruReady ? "RU ✓" : "RU ⏳"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md ${
                            hasAsset ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <ImageIcon className="w-3 h-3" />
                          {hasAsset ? (isUz ? "Rasm tayyor" : "Фото готово") : (isUz ? "Rasm yo‘q" : "Без фото")}
                        </span>
                        {isPublished && (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" />
                            {isUz ? "Telegram’da nashr qilingan" : "Опубликовано в Telegram"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => {
                          setPreviewNews(news);
                          setPublishTarget("channel");
                          setPublishLang("uz");
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {isUz ? "Ko‘rish & Nashr" : "Просмотр & Публикация"}
                      </button>

                      <button
                        onClick={() => setEditNews(news)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all active:scale-95"
                        title={isUz ? "Tahrirlash" : "Редактировать"}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SOURCES MANAGEMENT */}
      {activeTab === "sources" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="font-bold text-slate-800 text-sm">
                {isUz ? "Ishonchli yangiliklar manbalari" : "Проверенные источники новостей"}
              </h2>
              <p className="text-xs text-slate-400">
                {isUz
                  ? "Davlat organlari, rasmiy qonunchilik va tahliliy portallar"
                  : "Государственные органы, официальное законодательство и аналитические порталы"}
              </p>
            </div>
            <button
              onClick={() => setIsAddSourceOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {isUz ? "Manba qo‘shish" : "Добавить источник"}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{isUz ? "Manba nomi" : "Название источника"}</th>
                    <th className="py-3 px-4">{isUz ? "Domen & Havola" : "Домен & Ссылка"}</th>
                    <th className="py-3 px-4">{isUz ? "Toifa" : "Категория"}</th>
                    <th className="py-3 px-4">{isUz ? "Chastota" : "Частота"}</th>
                    <th className="py-3 px-4">{isUz ? "Holati" : "Статус"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sources.map((src) => (
                    <tr key={src.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{src.name}</td>
                      <td className="py-3.5 px-4">
                        <a
                          href={src.feed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:underline font-semibold flex items-center gap-1"
                        >
                          {src.domain}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {src.trust_level === "official_gov"
                            ? isUz ? "Davlat organi" : "Гос. орган"
                            : isUz ? "OAV" : "СМИ"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {src.check_frequency_min} {isUz ? "daqiqa" : "мин"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            src.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${src.is_active ? "bg-emerald-600" : "bg-slate-400"}`} />
                          {src.is_active ? (isUz ? "Faol" : "Активен") : (isUz ? "O‘chiq" : "Отключен")}
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

      {/* MODAL 1: PUBLISH PREVIEW MODAL */}
      {previewNews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-700" />
                <h3 className="font-black text-slate-900 text-base">
                  {isUz ? "Telegram nashr preview" : "Предпросмотр публикации в Telegram"}
                </h3>
              </div>
              <button
                onClick={() => setPreviewNews(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Publication Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {/* Target */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    {isUz ? "Qayerga nashr qilish:" : "Куда публиковать:"}
                  </label>
                  <select
                    value={publishTarget}
                    onChange={(e: any) => setPublishTarget(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 text-slate-800"
                  >
                    <option value="channel">{isUz ? "📢 @angren_estate Kanaliga" : "📢 В канал @angren_estate"}</option>
                    <option value="bot">{isUz ? "🤖 Bot obunachilariga" : "🤖 Подписчикам бота"}</option>
                    <option value="both">{isUz ? "✨ Ikkalasiga ham (Kanal + Bot)" : "✨ И в канал, и в бот"}</option>
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    {isUz ? "Post tili:" : "Язык публикации:"}
                  </label>
                  <select
                    value={publishLang}
                    onChange={(e: any) => setPublishLang(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 text-slate-800"
                  >
                    <option value="uz">{isUz ? "O‘zbekcha (Lotin)" : "Узбекский (Латиница)"}</option>
                    <option value="ru">{isUz ? "Ruscha" : "Русский"}</option>
                    <option value="both">{isUz ? "Ikkala tilda ham (2 ta post)" : "На двух языках (2 поста)"}</option>
                  </select>
                </div>
              </div>

              {/* Brand Visual Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-slate-700">
                    {isUz ? "ANGREN ESTATE brend vizuali:" : "Фирменный визуал ANGREN ESTATE:"}
                  </span>
                  <button
                    onClick={() => handleGenerateAsset(previewNews.id, publishLang === "ru" ? "ru" : "uz")}
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {isUz ? "Qayta yaratish" : "Сгенерировать заново"}
                  </button>
                </div>

                <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-md relative flex items-center justify-center">
                  {publishLang === "ru" && previewNews.assets?.ru?.public_url ? (
                    <img
                      src={previewNews.assets.ru.public_url}
                      alt="Brand card"
                      className="w-full h-full object-cover"
                    />
                  ) : previewNews.assets?.uz?.public_url ? (
                    <img
                      src={previewNews.assets.uz.public_url}
                      alt="Brand card"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-400 space-y-2">
                      <ImageIcon className="w-10 h-10 mx-auto opacity-50" />
                      <p className="text-xs font-medium">
                        {isUz
                          ? "Brend vizual kartochkasi hali yaratilmagan. Nashr paytida avtomatik yaratiladi."
                          : "Визуальная карточка будет автоматически создана при публикации."}
                      </p>
                      <button
                        onClick={() => handleGenerateAsset(previewNews.id, "uz")}
                        className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                      >
                        {isUz ? "Hozir yaratish" : "Создать сейчас"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Telegram Post Text Mockup */}
              <div>
                <span className="block text-xs font-extrabold text-slate-700 mb-2">
                  {isUz ? "Telegram xabar ko‘rinishi:" : "Текст сообщения в Telegram:"}
                </span>

                <div className="bg-[#182533] text-white p-4 rounded-2xl space-y-3 font-sans text-xs leading-relaxed shadow-inner">
                  <div className="font-bold text-emerald-400">
                    {publishLang === "ru" ? "🏛 ANGREN ESTATE | Новости" : "🏛 ANGREN ESTATE | Yangiliklar"}
                  </div>

                  <div className="font-extrabold text-white text-sm">
                    📌 {publishLang === "ru" ? previewNews.translations?.ru?.title || previewNews.original_title : previewNews.translations?.uz?.title || previewNews.original_title}
                  </div>

                  <div className="text-slate-300">
                    {publishLang === "ru" ? previewNews.translations?.ru?.summary || "" : previewNews.translations?.uz?.summary || ""}
                  </div>

                  <div className="text-emerald-300 font-medium">
                    {publishLang === "ru"
                      ? `💡 Практическая польза: ${previewNews.translations?.ru?.practical_takeaway || "Следите за обновлениями законодательства."}`
                      : `💡 O‘quvchi uchun ahamiyati: ${previewNews.translations?.uz?.practical_takeaway || "Qonunchilik yangiliklaridan boxabar bo‘ling."}`}
                  </div>

                  <div className="pt-2 border-t border-slate-700/60 text-slate-400 flex items-center justify-between text-[11px]">
                    <span>
                      📰 {publishLang === "ru" ? "Источник:" : "Manba:"} {previewNews.source?.name || previewNews.original_url.split("/")[2]}
                    </span>
                    <span className="text-emerald-400 font-bold">@angren_estate</span>
                  </div>

                  {/* Inline Buttons Mockup */}
                  <div className="pt-2 flex flex-col gap-1.5">
                    <div className="w-full bg-[#2b5278] hover:bg-[#346391] text-white py-2 rounded-lg text-center font-bold text-xs cursor-pointer shadow-sm">
                      {publishLang === "ru" ? "📖 Читать источник →" : "📖 Asl manbani o‘qish →"}
                    </div>
                    <div className="w-full bg-[#2b5278] hover:bg-[#346391] text-white py-2 rounded-lg text-center font-bold text-xs cursor-pointer shadow-sm">
                      🏠 ANGREN ESTATE
                    </div>
                  </div>
                </div>
              </div>

              {publishSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center">
                  {publishSuccessMsg}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setPreviewNews(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                {isUz ? "Bekor qilish" : "Отмена"}
              </button>

              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {publishing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {publishing
                  ? isUz ? "Yuborilmoqda..." : "Публикация..."
                  : isUz ? "Tasdiqlash va Telegram’ga yuborish" : "Подтвердить и отправить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD MANUAL NEWS */}
      {isAddManualNewsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base">
                {isUz ? "Yangi yangilik qo‘shish" : "Добавить новость вручную"}
              </h3>
              <button onClick={() => setIsAddManualNewsOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Sarlavha (Asl nusxa):" : "Заголовок:"}
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Masalan: Uy-joy narxlari bo'yicha tahlil"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Asl manba URL havolasi:" : "URL источника:"}
                </label>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Kategoriya:" : "Категория:"}
                </label>
                <select
                  value={manualCategory}
                  onChange={(e: any) => setManualCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                >
                  {Object.entries(NEWS_CATEGORIES).map(([catKey, cat]) => (
                    <option key={catKey} value={catKey}>
                      {isUz ? cat.uz : cat.ru}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Qisqa xulosa (O‘zbekcha):" : "Краткое содержание (UZ):"}
                </label>
                <textarea
                  rows={3}
                  value={manualSummaryUz}
                  onChange={(e) => setManualSummaryUz(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "O‘quvchi uchun ahamiyati (O‘zbekcha):" : "Практическая польза (UZ):"}
                </label>
                <input
                  type="text"
                  value={manualTakeawayUz}
                  onChange={(e) => setManualTakeawayUz(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsAddManualNewsOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                {isUz ? "Bekor qilish" : "Отмена"}
              </button>

              <button
                onClick={async () => {
                  if (!manualTitle || !manualUrl) {
                    alert(isUz ? "Sarlavha va havola majburiy" : "Заполните заголовок и ссылку");
                    return;
                  }
                  await fetch("/api/admin/social/news", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      original_title: manualTitle,
                      original_url: manualUrl,
                      category: manualCategory,
                      uz_title: manualTitle,
                      uz_summary: manualSummaryUz,
                      uz_takeaway: manualTakeawayUz,
                    }),
                  });
                  setIsAddManualNewsOpen(false);
                  setManualTitle("");
                  setManualUrl("");
                  await loadData();
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md"
              >
                {isUz ? "Saqlash" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD SOURCE */}
      {isAddSourceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base">
                {isUz ? "Yangi manba qo‘shish" : "Добавить новый источник"}
              </h3>
              <button onClick={() => setIsAddSourceOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Manba nomi:" : "Название источника:"}
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                  placeholder="Masalan: Kadastr agentligi"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Asl domen:" : "Домен:"}
                </label>
                <input
                  type="text"
                  value={sourceDomain}
                  onChange={(e) => setSourceDomain(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                  placeholder="kadastr.uz"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "RSS feed yoki API havolasi:" : "RSS или API ссылка:"}
                </label>
                <input
                  type="url"
                  value={sourceFeedUrl}
                  onChange={(e) => setSourceFeedUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                  placeholder="https://kadastr.uz/rss"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Ishonchlilik toifasi:" : "Категория доверия:"}
                </label>
                <select
                  value={sourceTrust}
                  onChange={(e: any) => setSourceTrust(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                >
                  <option value="official_gov">{isUz ? "Davlat organi" : "Гос. орган"}</option>
                  <option value="reputable_media">{isUz ? "Ishonchli OAV" : "Авторитетное СМИ"}</option>
                  <option value="analytical_center">{isUz ? "Tahliliy markaz" : "Аналитический центр"}</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsAddSourceOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                {isUz ? "Bekor qilish" : "Отмена"}
              </button>

              <button
                onClick={async () => {
                  if (!sourceName || !sourceDomain || !sourceFeedUrl) {
                    alert(isUz ? "Barcha maydonlarni to‘ldiring" : "Заполните все поля");
                    return;
                  }
                  await fetch("/api/admin/social/sources", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: sourceName,
                      domain: sourceDomain,
                      feed_url: sourceFeedUrl,
                      trust_level: sourceTrust,
                    }),
                  });
                  setIsAddSourceOpen(false);
                  setSourceName("");
                  setSourceDomain("");
                  setSourceFeedUrl("");
                  await loadData();
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md"
              >
                {isUz ? "Qo‘shish" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
