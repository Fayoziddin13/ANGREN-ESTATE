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
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Power,
  Upload,
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
  const [publishToChannel, setPublishToChannel] = useState(true);
  const [publishToBot, setPublishToBot] = useState(false);
  const [publishForceRepeat, setPublishForceRepeat] = useState(false);
  const [publishResultsReport, setPublishResultsReport] = useState<any[] | null>(null);
  const [publishLang, setPublishLang] = useState<"uz" | "ru" | "both">("uz");
  const [syncSummary, setSyncSummary] = useState<any | null>(null);
  const [generatingAsset, setGeneratingAsset] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [sendWithoutImage, setSendWithoutImage] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);
  const [checkingSourceId, setCheckingSourceId] = useState<string | null>(null);
  const [seedingSources, setSeedingSources] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

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
    setSyncSummary(null);
    try {
      const res = await fetch("/api/admin/social/sources/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncSummary(data);
        await loadData();
      } else {
        alert(data.error || (isUz ? "Sinxronlashtirishda xatolik yuz berdi" : "Ошибка синхронизации"));
      }
    } catch (e: any) {
      console.error("Sync error:", e);
      alert(e?.message || (isUz ? "Sinxronlashtirishda tarmoq xatosi" : "Ошибка сети при синхронизации"));
    } finally {
      setSyncing(false);
    }
  };

  // Generate Brand Asset (AI or Source image)
  const handleGenerateAsset = async (
    newsId: string,
    lang: "uz" | "ru",
    options?: { preferSourceImage?: boolean; forceAi?: boolean }
  ) => {
    setGeneratingAsset(true);
    setAssetError(null);
    try {
      const res = await fetch(`/api/admin/social/news/${newsId}/generate-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          preferSourceImage: options?.preferSourceImage,
          forceAi: options?.forceAi,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.news && previewNews && previewNews.id === newsId) {
          setPreviewNews(data.news);
        } else if (previewNews && previewNews.id === newsId) {
          const updated = await fetch(`/api/admin/social/news/${newsId}`).then((r) => r.json());
          if (updated.success) setPreviewNews(updated.news);
        }
        await loadData();
      } else {
        setAssetError(data.error || (isUz ? "Rasm yaratishda xatolik yuz berdi" : "Ошибка при генерации изображения"));
      }
    } catch (e: any) {
      console.error("Asset generation error:", e);
      setAssetError(e?.message || (isUz ? "Tarmoq xatosi" : "Ошибка сети"));
    } finally {
      setGeneratingAsset(false);
    }
  };

  // Upload Custom Image Asset from PC
  const handleUploadCustomAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !previewNews) return;

    e.target.value = "";
    setUploadingAsset(true);
    setAssetError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("lang", publishLang === "ru" ? "ru" : "uz");

      const res = await fetch(`/api/admin/social/news/${previewNews.id}/upload-asset`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.news) {
        setPreviewNews(data.news);
        setNewsList((prev) => prev.map((n) => (n.id === data.news.id ? data.news : n)));
        setSendWithoutImage(false); // Switch to image mode when custom image is uploaded
      } else {
        setAssetError(data.error || (isUz ? "Rasm yuklashda xatolik yuz berdi" : "Ошибка загрузки изображения"));
      }
    } catch (err: any) {
      setAssetError(err?.message || (isUz ? "Rasm yuklashda tarmoq xatosi" : "Сетевая ошибка при загрузке"));
    } finally {
      setUploadingAsset(false);
    }
  };

  // Publish News to Telegram
  const handlePublish = async () => {
    if (!previewNews) return;
    if (!publishToChannel && !publishToBot) {
      alert(
        isUz
          ? "Iltimos, kamida bitta yo‘nalishni tanlang (Kanal yoki Bot obunachilari)!"
          : "Пожалуйста, выберите хотя бы одно направление (Канал или Подписчики бота)!"
      );
      return;
    }

    setPublishing(true);
    setPublishSuccessMsg(null);
    setPublishResultsReport(null);

    const target = publishToChannel && publishToBot ? "both" : publishToChannel ? "channel" : "bot";

    try {
      const res = await fetch(`/api/admin/social/news/${previewNews.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          language: publishLang,
          forceRepeat: publishForceRepeat,
          withoutImage: sendWithoutImage,
        }),
      });
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        setPublishResultsReport(data.results);
        await loadData();
        if (data.allSuccessful) {
          setPublishSuccessMsg(
            isUz
              ? "Barcha yo‘nalishlarda muvaffaqiyatli nashr qilindi!"
              : "Успешно опубликовано по всем выбранным направлениям!"
          );
        } else if (data.success) {
          setPublishSuccessMsg(
            isUz
              ? "Qisman muvaffaqiyatli nashr qilindi (pastdagi hisobotni tekshiring)."
              : "Частично опубликовано (проверьте подробный отчет ниже)."
          );
        }
      } else if (data.success) {
        setPublishSuccessMsg(
          isUz
            ? "Muvaffaqiyatli nashr qilindi!"
            : "Успешно опубликовано в Telegram!"
        );
        await loadData();
      } else {
        alert(data.error || "Nashr qilishda xatolik yuz berdi");
      }
    } catch (e: any) {
      alert(e?.message || "Xatolik");
    } finally {
      setPublishing(false);
    }
  };

  // Seed verified default sources
  const handleSeedDefaults = async () => {
    setSeedingSources(true);
    setSeedNotice(null);
    try {
      const res = await fetch("/api/admin/social/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_defaults" }),
      });
      const data = await res.json();
      if (data.success) {
        setSeedNotice(data.message || (isUz ? "Rasmiy manbalar bazasi to‘ldirildi!" : "Официальные источники успешно добавлены!"));
        await loadData();
        setTimeout(() => setSeedNotice(null), 5000);
      } else {
        alert(data.error || "Xatolik yuz berdi");
      }
    } catch (e: any) {
      alert(e?.message || "Xatolik");
    } finally {
      setSeedingSources(false);
    }
  };

  // Check / Harvest a single source
  const handleCheckSingleSource = async (sourceId: string) => {
    setCheckingSourceId(sourceId);
    try {
      const res = await fetch("/api/admin/social/sources/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      } else {
        alert(data.error || (isUz ? "Manbani tekshirishda xatolik yuz berdi" : "Ошибка проверки источника"));
      }
    } catch (e: any) {
      alert(e?.message || "Xatolik");
    } finally {
      setCheckingSourceId(null);
    }
  };

  // Toggle Source Active
  const handleToggleSourceActive = async (sourceId: string, currentActive: boolean) => {
    try {
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, is_active: !currentActive } : s))
      );
      const res = await fetch("/api/admin/social/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sourceId, is_active: !currentActive }),
      });
      const data = await res.json();
      if (!data.success) {
        await loadData();
        alert(data.error || "Xatolik yuz berdi");
      }
    } catch (e: any) {
      await loadData();
      alert(e?.message || "Xatolik");
    }
  };

  // Delete Source
  const handleDeleteSource = async (sourceId: string, name: string) => {
    const confirmed = window.confirm(
      isUz
        ? `"${name}" manbasini ro‘yxatdan o‘chirishni xohlaysizmi?`
        : `Удалить источник "${name}" из списка?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/social/sources?id=${encodeURIComponent(sourceId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      } else {
        alert(data.error || (isUz ? "O‘chirishda xatolik yuz berdi" : "Ошибка при удалении"));
      }
    } catch (e: any) {
      alert(e?.message || "Xatolik");
    }
  };

  // Add Source Form Submit
  const handleAddSourceSubmit = async () => {
    if (!sourceName.trim() || !sourceFeedUrl.trim()) {
      setAddSourceError(isUz ? "Manba nomi va feed havolasi majburiy" : "Заполните название и ссылку на ленту");
      return;
    }

    setIsAddingSource(true);
    setAddSourceError(null);
    try {
      let domain = sourceDomain.trim();
      if (!domain) {
        try {
          domain = new URL(sourceFeedUrl.trim()).hostname;
        } catch {
          domain = "unknown";
        }
      }

      const res = await fetch("/api/admin/social/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sourceName.trim(),
          domain,
          feed_url: sourceFeedUrl.trim(),
          trust_level: sourceTrust,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsAddSourceOpen(false);
        setSourceName("");
        setSourceDomain("");
        setSourceFeedUrl("");
        setAddSourceError(null);
        await loadData();
      } else {
        setAddSourceError(data.error || (isUz ? "Manbani qo‘shishda xatolik yuz berdi" : "Ошибка добавления источника"));
      }
    } catch (err: any) {
      setAddSourceError(err?.message || (isUz ? "Serverga ulanish xatosi" : "Ошибка соединения с сервером"));
    } finally {
      setIsAddingSource(false);
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
                        {news.publications?.some((p) => p.target_type === "channel" && p.status === "published") && (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            <Send className="w-3 h-3" />
                            {isUz ? "📢 Kanalga chiqarilgan" : "📢 В канале"}
                          </span>
                        )}
                        {news.publications?.some((p) => p.target_type === "bot_broadcast" && p.status === "published") && (
                          <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                            <Radio className="w-3 h-3" />
                            {isUz ? "🤖 Botga tarqatilgan" : "🤖 В боте"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => {
                          setPreviewNews(news);
                          setPublishToChannel(true);
                          setPublishToBot(false);
                          setPublishForceRepeat(false);
                          setPublishResultsReport(null);
                          setPublishSuccessMsg(null);
                          setPublishLang("uz");
                          setSendWithoutImage(false);
                          setAssetError(null);
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
        <div className="space-y-5">
          {/* Seed Notice Banner */}
          {seedNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{seedNotice}</span>
              </div>
              <button onClick={() => setSeedNotice(null)} className="text-emerald-700 hover:text-emerald-950 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Sources KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isUz ? "Jami manbalar" : "Всего источников"}
                </p>
                <p className="text-xl font-black text-slate-900">{sources.length}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isUz ? "Faol manbalar" : "Активные"}
                </p>
                <p className="text-xl font-black text-emerald-700">
                  {sources.filter((s) => s.is_active).length}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isUz ? "Davlat organlari" : "Гос. органы"}
                </p>
                <p className="text-xl font-black text-blue-700">
                  {sources.filter((s) => s.trust_level === "official_gov").length}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                sources.filter((s) => s.last_check?.status === "failed").length > 0
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-50 text-slate-400"
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isUz ? "Xatoliklar" : "Ошибки"}
                </p>
                <p className={`text-xl font-black ${
                  sources.filter((s) => s.last_check?.status === "failed").length > 0
                    ? "text-rose-700"
                    : "text-slate-700"
                }`}>
                  {sources.filter((s) => s.last_check?.status === "failed").length}
                </p>
              </div>
            </div>
          </div>

          {/* Sources Control Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {isUz ? "Ishonchli axborot manbalari ro‘yxati" : "Список проверенных источников информации"}
              </h2>
              <p className="text-xs text-slate-400">
                {isUz
                  ? "O‘zbekiston davlat idoralari qonunchilik bazasi, statistika va nufuzli OAV portallari"
                  : "Официальные порталы органов власти, законодательство и авторитетные СМИ Узбекистана"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Seed missing official defaults */}
              <button
                onClick={handleSeedDefaults}
                disabled={seedingSources}
                title={isUz ? "Barcha 11 ta tasdiqlangan rasmiy va nufuzli manbalarni bazaga qo‘shish" : "Добавить все 11 проверенных официальных источников"}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-600 ${seedingSources ? "animate-spin" : ""}`} />
                {seedingSources
                  ? isUz ? "To‘ldirilmoqda..." : "Заполнение..."
                  : isUz ? "Rasmiy manbalarni to‘ldirish" : "Заполнить офиц. источниками"}
              </button>

              {/* Check all sources */}
              <button
                onClick={handleSyncAll}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${syncing ? "animate-spin" : ""}`} />
                {syncing
                  ? isUz ? "Tekshirilmoqda..." : "Проверка..."
                  : isUz ? "Manbalarni qayta tekshirish" : "Проверить все"}
              </button>

              {/* Add custom source */}
              <button
                onClick={() => {
                  setAddSourceError(null);
                  setIsAddSourceOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white hover:bg-emerald-800 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                {isUz ? "Manba qo‘shish" : "Добавить источник"}
              </button>
            </div>
          </div>

          {/* Sources Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{isUz ? "Manba nomi & Toifa" : "Источник & Категория"}</th>
                    <th className="py-3 px-4">{isUz ? "Domen & RSS havola" : "Домен & RSS ссылка"}</th>
                    <th className="py-3 px-4">{isUz ? "Tekshiruv holati" : "Статус проверки"}</th>
                    <th className="py-3 px-4 text-center">{isUz ? "Faollik" : "Активность"}</th>
                    <th className="py-3 px-4 text-right">{isUz ? "Amallar" : "Действия"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sources.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        {isUz
                          ? "Hozircha manbalar yo‘q. «Rasmiy manbalarni to‘ldirish» tugmasini bosing."
                          : "Источники отсутствуют. Нажмите «Заполнить офиц. источниками»."}
                      </td>
                    </tr>
                  ) : (
                    sources.map((src) => {
                      const check = src.last_check;
                      const isCheckingThis = checkingSourceId === src.id;

                      return (
                        <tr key={src.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Name & Trust Level */}
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              {src.trust_level === "official_gov" && (
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              )}
                              <span>{src.name}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                src.trust_level === "official_gov"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : src.trust_level === "analytical_center"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}>
                                {src.trust_level === "official_gov"
                                  ? isUz ? "Davlat organi" : "Гос. орган"
                                  : src.trust_level === "analytical_center"
                                  ? isUz ? "Tahliliy markaz" : "Аналитический центр"
                                  : isUz ? "Ishonchli OAV" : "Авторитетное СМИ"}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-bold">
                                {src.source_type}
                              </span>
                            </div>
                          </td>

                          {/* Domain & URL */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{src.domain}</div>
                            <a
                              href={src.feed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 truncate max-w-xs"
                              title={src.feed_url}
                            >
                              <span className="truncate">{src.feed_url}</span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
                            </a>
                          </td>

                          {/* Health Status */}
                          <td className="py-3.5 px-4">
                            {check ? (
                              <div className="space-y-0.5">
                                {check.status === "success" && (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                    <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                    <span>
                                      {isUz ? "Ishlayapti" : "Работает"}
                                      {check.items_found > 0 && ` (${check.items_found})`}
                                    </span>
                                  </div>
                                )}

                                {check.status === "empty" && (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                                    <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                    <span>{isUz ? "Bo‘sh (0 ta)" : "Пусто (0)"}</span>
                                  </div>
                                )}

                                {check.status === "failed" && (
                                  <div className="space-y-0.5">
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                                      <AlertTriangle className="w-3 h-3 text-rose-600 flex-shrink-0" />
                                      <span>{isUz ? "Xatolik" : "Ошибка"}</span>
                                    </div>
                                    {check.error_message && (
                                      <p className="text-[10px] text-rose-600 font-semibold truncate max-w-[200px]" title={check.error_message}>
                                        {check.error_message}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {check.checked_at && (
                                  <p className="text-[10px] text-slate-400">
                                    {new Date(check.checked_at).toLocaleDateString(isUz ? "uz-UZ" : "ru-RU", {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                <Clock className="w-3 h-3" />
                                {isUz ? "Tekshirilmagan" : "Не проверен"}
                              </span>
                            )}
                          </td>

                          {/* Active Toggle Switch */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleToggleSourceActive(src.id, src.is_active)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                src.is_active ? "bg-emerald-600" : "bg-slate-300"
                              }`}
                              title={src.is_active ? (isUz ? "Faol (O‘chirish uchun bosing)" : "Активен") : (isUz ? "O‘chiq (Yoqish uchun bosing)" : "Отключен")}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  src.is_active ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </td>

                          {/* Actions (Single Test & Delete) */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Single Source Sync */}
                              <button
                                onClick={() => handleCheckSingleSource(src.id)}
                                disabled={isCheckingThis}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                                title={isUz ? "Ushbu manbani tekshirish" : "Проверить этот источник"}
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingThis ? "animate-spin text-emerald-700" : ""}`} />
                              </button>

                              {/* Delete Source */}
                              <button
                                onClick={() => handleDeleteSource(src.id, src.name)}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-all active:scale-95"
                                title={isUz ? "Manbani o‘chirish" : "Удалить источник"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 0: SYNC SUMMARY REPORT MODAL */}
      {syncSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-700" />
                <h3 className="font-black text-slate-900 text-base">
                  {isUz ? "Sinxronlashtirish hisoboti" : "Отчет о синхронизации"}
                </h3>
              </div>
              <button
                onClick={() => setSyncSummary(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                  <span className="block text-xl font-black text-slate-900">
                    {syncSummary.summary?.sourcesChecked ?? 0}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {isUz ? "Tekshirilgan" : "Проверено"}
                  </span>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                  <span className="block text-xl font-black text-emerald-700">
                    {syncSummary.summary?.totalNew ?? 0}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-800">
                    {isUz ? "Yangi maqola" : "Новые статьи"}
                  </span>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-center">
                  <span className="block text-xl font-black text-amber-700">
                    {syncSummary.summary?.totalDuplicates ?? 0}
                  </span>
                  <span className="text-[11px] font-bold text-amber-800">
                    {isUz ? "Dublikatlar" : "Дубликаты"}
                  </span>
                </div>

                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-center">
                  <span className="block text-xl font-black text-blue-700">
                    {syncSummary.summary?.totalFound ?? 0}
                  </span>
                  <span className="text-[11px] font-bold text-blue-800">
                    {isUz ? "Jami RSS" : "Всего в RSS"}
                  </span>
                </div>
              </div>

              {/* Status explanation */}
              {(syncSummary.summary?.totalNew ?? 0) === 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold leading-relaxed">
                  💡 {isUz
                    ? "0 ta yangi yangilik qo‘shildi: RSS manbalaridagi barcha maqolalar allaqachon bazaga kiritilgan (dublikat) yoki manbalarda so‘nggi paytda yangi xabarlar chiqmagan."
                    : "0 новых статей добавлено: все статьи из RSS уже сохранены в базе или новых публикаций по недвижимости пока не появилось."}
                </div>
              )}

              {/* Per-Source details */}
              <div className="space-y-2">
                <span className="block text-xs font-extrabold text-slate-700">
                  {isUz ? "Manbalar holati:" : "Статус источников:"}
                </span>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {syncSummary.results?.map((res: any, idx: number) => {
                    const hasErr = Boolean(res.error);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                          hasErr
                            ? "bg-rose-50 border-rose-200 text-rose-900"
                            : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {hasErr ? (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="font-bold truncate">{res.sourceName}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          {hasErr ? (
                            <span className="font-semibold text-rose-700 text-[11px]">{res.error}</span>
                          ) : (
                            <span className="font-bold text-slate-600 text-[11px]">
                              {res.newItemsSaved > 0
                                ? `+${res.newItemsSaved} ta yangi`
                                : `${res.itemsFound} ta (0 yangi)`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSyncSummary(null)}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all"
              >
                {isUz ? "Tushunarli" : "Понятно"}
              </button>
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
                {/* Targets */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    {isUz ? "Nashr yo‘nalishlari (tanlang):" : "Направления публикации:"}
                  </label>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      publishToChannel ? "bg-emerald-50 border-emerald-300 text-emerald-950" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <input
                        type="checkbox"
                        checked={publishToChannel}
                        onChange={(e) => setPublishToChannel(e.target.checked)}
                        className="rounded text-emerald-700 focus:ring-emerald-600 w-4 h-4"
                      />
                      <span>{isUz ? "📢 @angren_estate Kanaliga" : "📢 В канал @angren_estate"}</span>
                    </label>

                    <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      publishToBot ? "bg-emerald-50 border-emerald-300 text-emerald-950" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <input
                        type="checkbox"
                        checked={publishToBot}
                        onChange={(e) => setPublishToBot(e.target.checked)}
                        className="rounded text-emerald-700 focus:ring-emerald-600 w-4 h-4"
                      />
                      <span>{isUz ? "🤖 Bot obunachilariga" : "🤖 Подписчикам бота"}</span>
                    </label>

                    <label className="flex items-center gap-2 px-1 pt-1 text-[11px] font-semibold text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={publishForceRepeat}
                        onChange={(e) => setPublishForceRepeat(e.target.checked)}
                        className="rounded text-slate-600 focus:ring-slate-500 w-3.5 h-3.5"
                      />
                      <span>{isUz ? "Takroran nashr qilish (Force repeat)" : "Повторная публикация"}</span>
                    </label>
                  </div>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    {isUz ? "Post tili:" : "Язык публикации:"}
                  </label>
                  <select
                    value={publishLang}
                    onChange={(e: any) => setPublishLang(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="uz">{isUz ? "O‘zbekcha (Lotin)" : "Узбекский (Латиница)"}</option>
                    <option value="ru">{isUz ? "Ruscha" : "Русский"}</option>
                    <option value="both">{isUz ? "Ikkala tilda ham (2 ta post)" : "На двух языках (2 поста)"}</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-2">
                    {isUz
                      ? "Har bir yo‘nalish mustaqil ishlaydi: kanal va bot natijalari alohida qayd etiladi."
                      : "Каждое направление работает автономно: результаты канала и бота фиксируются отдельно."}
                  </p>
                </div>
              </div>

              {/* Brand Visual Preview & Upload */}
              <div>
                {/* Hidden file input for uploading from computer */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadCustomAsset}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-700">
                      {isUz ? "Mavzuga mos rasm vizuali:" : "Визуал к публикации:"}
                    </span>

                    {/* Mode / Origin Badge */}
                    {sendWithoutImage ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <FileText className="w-2.5 h-2.5 text-amber-700" />
                        <span>{isUz ? "Faqat matn (rasmsiz)" : "Только текст (без фото)"}</span>
                      </span>
                    ) : (() => {
                      const curAsset = publishLang === "ru" ? previewNews.assets?.ru : previewNews.assets?.uz;
                      if (!curAsset?.public_url) return null;
                      if (curAsset.source_origin === "custom_upload" || curAsset.asset_type === "custom_upload") {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Upload className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{isUz ? "Kompyuterdan yuklangan" : "Загружено с ПК"}</span>
                          </span>
                        );
                      }
                      if (curAsset.source_origin === "ai") {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                            <span>AI Generatsiya</span>
                          </span>
                        );
                      }
                      if (curAsset.source_origin === "source_rss" || curAsset.source_origin === "source_og") {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Globe className="w-2.5 h-2.5 text-blue-600" />
                            <span>{isUz ? "Manba rasmi" : "Из источника"}</span>
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Building className="w-2.5 h-2.5 text-emerald-600" />
                          <span>{isUz ? "Mavzuiy rasm" : "Тематическое фото"}</span>
                        </span>
                      );
                    })()}
                  </div>

                  {/* Visual Control Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* 1. Upload from Computer */}
                    <button
                      type="button"
                      disabled={uploadingAsset || generatingAsset}
                      onClick={() => fileInputRef.current?.click()}
                      title={isUz ? "Kompyuterdan rasm tanlab yuklash (JPG, PNG, WEBP)" : "Выбрать и загрузить фото с компьютера"}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-950 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Upload className={`w-3 h-3 ${uploadingAsset ? "animate-bounce" : ""}`} />
                      <span>{uploadingAsset ? (isUz ? "Yuklanmoqda..." : "Загрузка...") : (isUz ? "Rasm yuklash" : "Загрузить фото")}</span>
                    </button>

                    {/* 2. Toggle Text-Only (Rasmsiz) */}
                    <button
                      type="button"
                      onClick={() => setSendWithoutImage(!sendWithoutImage)}
                      className={`text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border transition-all active:scale-95 ${
                        sendWithoutImage
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : "text-slate-600 hover:bg-slate-100 border-slate-200"
                      }`}
                      title={isUz ? "Rasm yuklamaslik, faqat matnli post yuborish" : "Отправить только текст без фото"}
                    >
                      <FileText className="w-3 h-3" />
                      <span>{sendWithoutImage ? (isUz ? "✓ Faqat matn" : "✓ Только текст") : (isUz ? "Faqat matn" : "Без фото")}</span>
                    </button>

                    {/* 3. Source Image */}
                    <button
                      type="button"
                      disabled={generatingAsset || uploadingAsset}
                      onClick={() => {
                        setSendWithoutImage(false);
                        handleGenerateAsset(previewNews.id, publishLang === "ru" ? "ru" : "uz", { preferSourceImage: true });
                      }}
                      title={isUz ? "Asl maqoladagi rasmni yuklash" : "Загрузить фото из источника"}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 border border-slate-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Globe className="w-3 h-3" />
                      <span>{isUz ? "Manba rasmi" : "Из источника"}</span>
                    </button>

                    {/* 4. AI Regeneration */}
                    <button
                      type="button"
                      disabled={generatingAsset || uploadingAsset}
                      onClick={() => {
                        setSendWithoutImage(false);
                        handleGenerateAsset(previewNews.id, publishLang === "ru" ? "ru" : "uz", { forceAi: true });
                      }}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-purple-50 border border-slate-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{generatingAsset ? (isUz ? "Yaratilmoqda..." : "Генерация...") : (isUz ? "AI orqali" : "Через ИИ")}</span>
                    </button>
                  </div>
                </div>

                {assetError && (
                  <div className="mb-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                    <span>⚠️ {assetError}</span>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="underline font-bold text-xs ml-2 shrink-0"
                    >
                      {isUz ? "Boshqa rasm tanlash" : "Выбрать другое"}
                    </button>
                  </div>
                )}

                <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-md relative flex items-center justify-center">
                  {sendWithoutImage ? (
                    <div className="text-center p-6 text-slate-300 space-y-2">
                      <FileText className="w-10 h-10 mx-auto text-amber-400 opacity-90" />
                      <p className="text-xs font-bold text-white">
                        {isUz
                          ? "Post Telegram kanaliga rasmsiz, faqat matnli ko‘rinishda yuboriladi"
                          : "Пост будет отправлен в Telegram без изображения (только текст)"}
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        {isUz
                          ? "Rasm yuklash majburiy emas. Agar rasm qo‘shmoqchi bo‘lsangiz, «Rasm yuklash» tugmasini bosing."
                          : "Изображение не обязательно. Чтобы добавить, нажмите «Загрузить фото»."}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSendWithoutImage(false)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                      >
                        {isUz ? "Rasmli rejimga qaytish" : "Вернуть изображение"}
                      </button>
                    </div>
                  ) : (() => {
                    const activeAsset = publishLang === "ru" ? previewNews.assets?.ru : previewNews.assets?.uz;
                    const isValidUrl =
                      activeAsset?.public_url &&
                      activeAsset.public_url.startsWith("https://") &&
                      !activeAsset.public_url.endsWith(".svg") &&
                      !activeAsset.storage_path?.endsWith(".svg");

                    if (isValidUrl) {
                      return (
                        <div className="relative w-full h-full group">
                          <img
                            src={activeAsset!.public_url}
                            alt="Brand card"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isUz ? "Almashtirish" : "Заменить"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSendWithoutImage(true)}
                              className="px-3 py-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{isUz ? "Faqat matn" : "Удалить фото"}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="text-center p-6 text-slate-400 space-y-2">
                        <ImageIcon className="w-10 h-10 mx-auto opacity-50" />
                        <p className="text-xs font-medium">
                          {isUz
                            ? "Rasm tanlanmagan. Kompyuterdan yuklang, sun’iy intellekt orqali yarating yoki rasmsiz yuboring."
                            : "Изображение не прикреплено. Загрузите с ПК, создайте через ИИ или отправьте только текст."}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={uploadingAsset}
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Upload className="w-3 h-3" />
                            <span>{isUz ? "Kompyuterdan rasm tanlash" : "Загрузить с ПК"}</span>
                          </button>
                          <button
                            type="button"
                            disabled={generatingAsset}
                            onClick={() => handleGenerateAsset(previewNews.id, publishLang === "ru" ? "ru" : "uz", { forceAi: true })}
                            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{isUz ? "AI orqali yaratish" : "Создать через ИИ"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSendWithoutImage(true)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{isUz ? "Rasmsiz (faqat matn)" : "Без фото (текст)"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {(generatingAsset || uploadingAsset) && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-10">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                      <span className="text-xs font-bold">
                        {uploadingAsset
                          ? (isUz ? "Rasm kompyuterdan yuklanmoqda..." : "Загрузка изображения...")
                          : (isUz ? "AI rasm tayyorlamoqda..." : "ИИ генерирует изображение...")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Telegram Post Text Mockup */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-slate-700">
                    {isUz ? "Telegram xabar ko‘rinishi:" : "Текст сообщения в Telegram:"}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    sendWithoutImage ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
                  }`}>
                    {sendWithoutImage
                      ? (isUz ? "Format: 📝 Matnli post (rasmsiz)" : "Формат: 📝 Текстовый пост")
                      : (isUz ? "Format: 🖼 Rasmli post" : "Формат: 🖼 Пост с фото")}
                  </span>
                </div>

                <div className="bg-[#182533] text-white p-4 rounded-2xl space-y-3 font-sans text-xs leading-relaxed shadow-inner">
                  <div className="font-bold text-emerald-400">
                    {publishLang === "ru" ? "🏛 ANGREN ESTATE | Новости" : "🏛 ANGREN ESTATE | Yangiliklar"}
                  </div>

                  <div className="font-extrabold text-white text-sm">
                    📌 {publishLang === "ru" ? previewNews.translations?.ru?.title || previewNews.original_title : previewNews.translations?.uz?.title || previewNews.original_title}
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2 border-b border-slate-700/60 pb-2">
                    <span>📅 {new Date(previewNews.published_at).toLocaleDateString(isUz ? "uz-UZ" : "ru-RU")}</span>
                    <span>•</span>
                    <span>📰 {previewNews.source?.name || previewNews.original_url.split("/")[2]}</span>
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
                    <span className="truncate max-w-[280px]">
                      🔗 {isUz ? "Asl maqola:" : "Оригинал:"} {previewNews.original_url}
                    </span>
                    <span className="text-emerald-400 font-bold shrink-0">@angren_estate</span>
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

              {/* Detailed publication report */}
              {publishResultsReport && publishResultsReport.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="block text-xs font-extrabold text-slate-800">
                    {isUz ? "Nashr hisoboti (har bir yo‘nalish bo‘yicha):" : "Отчет о публикации по направлениям:"}
                  </span>
                  <div className="space-y-1.5">
                    {publishResultsReport.map((res: any, idx: number) => {
                      const isChannel = res.targetType === "channel";
                      const label = isChannel
                        ? isUz ? "📢 @angren_estate Kanali" : "📢 Канал @angren_estate"
                        : isUz ? "🤖 Bot obunachilari" : "🤖 Подписчики бота";

                      if (res.status === "published") {
                        return (
                          <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                              <span>
                                {label}: {isUz ? "Muvaffaqiyatli yuborildi" : "Успешно отправлено"}
                                {res.messageId ? ` (Telegram Post ID: #${res.messageId})` : ""}
                                {res.recipientsCount !== undefined ? ` (${res.recipientsCount} ta obunachiga)` : ""}
                              </span>
                            </div>
                            {isChannel && res.messageId && (
                              <a
                                href={`https://t.me/angren_estate/${res.messageId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-950 underline shrink-0 ml-auto"
                              >
                                <span>{isUz ? "Telegramda ko‘rish" : "Открыть в Telegram"}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        );
                      }

                      if (res.status === "already_published") {
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                            <span>
                              {label}: {isUz ? "Ushbu yangilik allaqachon chiqarilgan" : "Новость уже опубликована ранее"}
                              {res.messageId ? ` (Post ID: ${res.messageId})` : ""}
                              {isUz ? ". Qayta yuborish uchun 'Takroran nashr qilish'ni belgilang." : ". Для повтора включите повторную публикацию."}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs font-bold text-red-800 bg-red-50 p-2.5 rounded-xl border border-red-200">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>
                            {label}: {res.error || (isUz ? "Yuborishda xatolik yuz berdi" : "Ошибка при публикации")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-700" />
                <h3 className="font-black text-slate-900 text-base">
                  {isUz ? "Yangi manba qo‘shish" : "Добавить новый источник"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setAddSourceError(null);
                  setIsAddSourceOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Error display */}
              {addSourceError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold flex items-start gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">{addSourceError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Manba nomi:" : "Название источника:"}
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Masalan: Kadastr agentligi yangiliklari"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "RSS feed yoki API havolasi:" : "RSS или API ссылка:"}
                </label>
                <input
                  type="url"
                  value={sourceFeedUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSourceFeedUrl(val);
                    try {
                      if (val.startsWith("http://") || val.startsWith("https://")) {
                        const parsed = new URL(val);
                        if (!sourceDomain) {
                          setSourceDomain(parsed.hostname.replace(/^www\./, ""));
                        }
                      }
                    } catch {}
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="https://kadastr.uz/rss"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {isUz ? "Faqat ochiq va xavfsiz HTTPS/HTTP RSS feed manzili qabul qilinadi" : "Принимаются только публичные HTTPS/HTTP RSS ленты"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Asl domen:" : "Домен:"}
                </label>
                <input
                  type="text"
                  value={sourceDomain}
                  onChange={(e) => setSourceDomain(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="kadastr.uz"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isUz ? "Ishonchlilik toifasi:" : "Категория доверия:"}
                </label>
                <select
                  value={sourceTrust}
                  onChange={(e: any) => setSourceTrust(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="official_gov">{isUz ? "Davlat organi (Rasmiy)" : "Гос. орган (Официальный)"}</option>
                  <option value="reputable_media">{isUz ? "Ishonchli OAV" : "Авторитетное СМИ"}</option>
                  <option value="analytical_center">{isUz ? "Tahliliy markaz" : "Аналитический центр"}</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setAddSourceError(null);
                  setIsAddSourceOpen(false);
                }}
                disabled={isAddingSource}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl disabled:opacity-50"
              >
                {isUz ? "Bekor qilish" : "Отмена"}
              </button>

              <button
                onClick={handleAddSourceSubmit}
                disabled={isAddingSource}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
              >
                {isAddingSource && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isAddingSource
                  ? isUz ? "Tekshirilmoqda..." : "Проверка..."
                  : isUz ? "Tekshirish va qo‘shish" : "Проверить и добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
