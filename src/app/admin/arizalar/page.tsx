"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  Building2,
  Tag,
  Calendar,
  User,
  Check,
  Save,
  RefreshCw,
  XCircle,
  AlertCircle,
  X,
  PlusCircle,
  Send,
  Home,
  Briefcase,
  Layers,
  ArrowRight,
  Eye,
  MessageSquare,
  RotateCcw,
  Archive,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Lead } from "@/lib/types";

type StatusTab = "all" | "new" | "in_progress" | "contacted" | "completed" | "cancelled";
type DealFilter = "all" | "sale" | "rent";
type PropTypeFilter = "all" | "kvartira" | "uy_hovli" | "dala_hovli" | "tijorat" | "yer_uchastkasi" | "boshqa";

interface ListingStats {
  total: number;
  new: number;
  in_progress: number;
  contacted: number;
  completed: number;
  cancelled: number;
}

export default function AdminArizalarPage() {
  const { locale } = useLanguage();

  const [requests, setRequests] = useState<Lead[]>([]);
  const [stats, setStats] = useState<ListingStats>({
    total: 0,
    new: 0,
    in_progress: 0,
    contacted: 0,
    completed: 0,
    cancelled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [dealFilter, setDealFilter] = useState<DealFilter>("all");
  const [propTypeFilter, setPropTypeFilter] = useState<PropTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Detail state
  const [selectedRequest, setSelectedRequest] = useState<Lead | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [archiveConfirmRequest, setArchiveConfirmRequest] = useState<Lead | null>(null);
  const [isArchivingRequest, setIsArchivingRequest] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Permanent Delete state
  const [permanentDeleteRequest, setPermanentDeleteRequest] = useState<Lead | null>(null);
  const [permanentDeleteConfirmText, setPermanentDeleteConfirmText] = useState("");
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch listing requests from /api/admin/leads?type=property_listing_request
  const fetchRequests = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/leads?type=property_listing_request&limit=100", {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError(locale === "uz" ? "Admin sessiyasi talab qilinadi" : "Требуется сессия администратора");
        } else {
          setError(locale === "uz" ? `Xatolik yuz berdi (${res.status})` : `Ошибка загрузки (${res.status})`);
        }
        return;
      }

      const data = await res.json();
      if (data.success) {
        const list: Lead[] = data.leads || [];
        setRequests(list);

        // Compute exact stats for listing requests
        const s: ListingStats = {
          total: list.length,
          new: 0,
          in_progress: 0,
          contacted: 0,
          completed: 0,
          cancelled: 0,
        };

        for (const item of list) {
          const st = item.status === "closed" ? "completed" : item.status;
          if (st === "new") s.new++;
          else if (st === "in_progress") s.in_progress++;
          else if (st === "contacted") s.contacted++;
          else if (st === "completed") s.completed++;
          else if (st === "cancelled") s.cancelled++;
        }
        setStats(s);
      } else {
        setError(data.error || (locale === "uz" ? "Ma'lumotlarni yuklab bo‘lmadi" : "Не удалось загрузить"));
      }
    } catch (err: any) {
      console.error("[Admin Arizalar] Fetch error:", err);
      setError(err?.message || (locale === "uz" ? "Tarmoq xatosi" : "Ошибка сети"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Sync draft notes when selected request changes
  useEffect(() => {
    if (selectedRequest) {
      setNotesDraft(selectedRequest.notes || "");
    }
  }, [selectedRequest]);

  // Update Status handler
  const handleUpdateStatus = async (id: string, newStatus: Lead["status"]) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.lead) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...data.lead } : r))
        );
        if (selectedRequest && selectedRequest.id === id) {
          setSelectedRequest((prev) => (prev ? { ...prev, ...data.lead } : null));
        }
        showToast(
          locale === "uz"
            ? `Ariza holati o‘zgartirildi: ${getStatusLabel(newStatus, locale)}`
            : `Статус заявки обновлен: ${getStatusLabel(newStatus, locale)}`
        );
        fetchRequests(true);
      } else {
        showToast(data.error || (locale === "uz" ? "Xatolik yuz berdi" : "Ошибка обновления"));
      }
    } catch (err: any) {
      showToast(err?.message || (locale === "uz" ? "Tarmoq xatosi" : "Ошибка сети"));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Update Notes handler
  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/leads/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.lead) {
        setRequests((prev) =>
          prev.map((r) => (r.id === selectedRequest.id ? { ...r, ...data.lead } : r))
        );
        setSelectedRequest((prev) => (prev ? { ...prev, ...data.lead } : null));
        showToast(
          locale === "uz" ? "Izoh muvaffaqiyatli saqlandi!" : "Заметка успешно сохранена!"
        );
      } else {
        showToast(data.error || (locale === "uz" ? "Saqlashda xatolik" : "Ошибка сохранения"));
      }
    } catch (err: any) {
      showToast(err?.message || (locale === "uz" ? "Tarmoq xatosi" : "Ошибка сети"));
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      // Status filter
      if (statusFilter !== "all") {
        const effectiveStatus = item.status === "closed" ? "completed" : item.status;
        if (effectiveStatus !== statusFilter) return false;
      }

      const meta = item.metadata || {};
      const dealType = meta.deal_type || "sale";
      const propType = meta.property_type || "kvartira";
      const location = meta.location || "";
      const desc = item.message || meta.description || "";

      // Deal filter
      if (dealFilter !== "all" && dealType !== dealFilter) {
        return false;
      }

      // Property type filter
      if (propTypeFilter !== "all") {
        if (propTypeFilter === "kvartira" && !["kvartira", "apartment"].includes(propType)) return false;
        if (propTypeFilter === "uy_hovli" && !["uy_hovli", "hovli", "house"].includes(propType)) return false;
        if (propTypeFilter === "dala_hovli" && !["dala_hovli", "dacha"].includes(propType)) return false;
        if (propTypeFilter === "tijorat" && !["tijorat", "commercial"].includes(propType)) return false;
        if (propTypeFilter === "yer_uchastkasi" && !["yer_uchastkasi", "land", "yer"].includes(propType)) return false;
        if (propTypeFilter === "boshqa" && !["boshqa", "other"].includes(propType)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = item.client_name?.toLowerCase().includes(q) || false;
        const matchesPhone = item.client_phone?.toLowerCase().includes(q) || false;
        const matchesLoc = location.toLowerCase().includes(q) || false;
        const matchesDesc = desc.toLowerCase().includes(q) || false;
        const matchesNotes = item.notes?.toLowerCase().includes(q) || false;
        return matchesClient || matchesPhone || matchesLoc || matchesDesc || matchesNotes;
      }

      return true;
    });
  }, [requests, statusFilter, dealFilter, propTypeFilter, searchQuery]);

  // Format date helper
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900 text-white px-5 py-3.5 shadow-2xl border border-slate-700 text-sm font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-[#0d3431] border border-emerald-100">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {locale === "uz" ? "Arizalar — E'lon berish so‘rovlari" : "Заявки на размещение объявлений"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {locale === "uz"
                  ? "Mijozlar tomonidan saytdan yuborilgan ko‘chmas mulk joylashtirish arizalari"
                  : "Заявки от пользователей на публикацию объектов недвижимости"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRequests(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50"
            title="Yangilash"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{locale === "uz" ? "Yangilash" : "Обновить"}</span>
          </button>

          <Link
            href="/admin/properties/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0d3431] hover:bg-[#19453c] text-white text-xs font-bold shadow-sm hover:shadow transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>{locale === "uz" ? "Obyekt qo‘shish" : "Создать объект"}</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setStatusFilter("all")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-800 border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold opacity-75">{locale === "uz" ? "Jami arizalar" : "Всего заявок"}</div>
          <div className="text-2xl font-black mt-1">{stats.total}</div>
        </div>

        <div
          onClick={() => setStatusFilter("new")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "new"
              ? "bg-amber-600 text-white border-amber-600 shadow-sm"
              : "bg-amber-50/50 text-amber-900 border-amber-200/70 hover:border-amber-300"
          }`}
        >
          <div className="text-xs font-semibold opacity-80 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{locale === "uz" ? "Yangi" : "Новые"}</span>
          </div>
          <div className="text-2xl font-black mt-1 text-amber-600">{stats.new}</div>
        </div>

        <div
          onClick={() => setStatusFilter("in_progress")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "in_progress"
              ? "bg-sky-600 text-white border-sky-600 shadow-sm"
              : "bg-sky-50/50 text-sky-900 border-sky-200/70 hover:border-sky-300"
          }`}
        >
          <div className="text-xs font-semibold opacity-80 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span>{locale === "uz" ? "Ko‘rib chiqilmoqda" : "В работе"}</span>
          </div>
          <div className="text-2xl font-black mt-1 text-sky-600">{stats.in_progress}</div>
        </div>

        <div
          onClick={() => setStatusFilter("contacted")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "contacted"
              ? "bg-teal-700 text-white border-teal-700 shadow-sm"
              : "bg-teal-50/50 text-teal-900 border-teal-200/70 hover:border-teal-300"
          }`}
        >
          <div className="text-xs font-semibold opacity-80 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            <span>{locale === "uz" ? "Bog‘lanildi" : "Связались"}</span>
          </div>
          <div className="text-2xl font-black mt-1 text-teal-700">{stats.contacted}</div>
        </div>

        <div
          onClick={() => setStatusFilter("completed")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "completed"
              ? "bg-[#0d3431] text-white border-[#0d3431] shadow-sm"
              : "bg-emerald-50/50 text-emerald-900 border-emerald-200/70 hover:border-emerald-300"
          }`}
        >
          <div className="text-xs font-semibold opacity-80 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span>{locale === "uz" ? "E'lon yaratildi" : "Создан объект"}</span>
          </div>
          <div className="text-2xl font-black mt-1 text-emerald-700">{stats.completed}</div>
        </div>

        <div
          onClick={() => setStatusFilter("cancelled")}
          className={`cursor-pointer rounded-2xl p-4 border transition-all ${
            statusFilter === "cancelled"
              ? "bg-rose-700 text-white border-rose-700 shadow-sm"
              : "bg-rose-50/50 text-rose-900 border-rose-200/70 hover:border-rose-300"
          }`}
        >
          <div className="text-xs font-semibold opacity-80 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>{locale === "uz" ? "Rad etildi" : "Отклонено"}</span>
          </div>
          <div className="text-2xl font-black mt-1 text-rose-700">{stats.cancelled}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {locale === "uz" ? "Barcha arizalar" : "Все заявки"} ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter("new")}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === "new"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{locale === "uz" ? "Yangi" : "Новые"}</span>
            <span className="ml-1 opacity-80">({stats.new})</span>
          </button>
          <button
            onClick={() => setStatusFilter("in_progress")}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === "in_progress"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-sky-50 text-sky-800 hover:bg-sky-100"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span>{locale === "uz" ? "Ko‘rib chiqilmoqda" : "В работе"}</span>
            <span className="ml-1 opacity-80">({stats.in_progress})</span>
          </button>
          <button
            onClick={() => setStatusFilter("contacted")}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === "contacted"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-teal-50 text-teal-800 hover:bg-teal-100"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            <span>{locale === "uz" ? "Bog‘lanildi" : "Связались"}</span>
            <span className="ml-1 opacity-80">({stats.contacted})</span>
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === "completed"
                ? "bg-[#0d3431] text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span>{locale === "uz" ? "E'lon yaratildi" : "Создан объект"}</span>
            <span className="ml-1 opacity-80">({stats.completed})</span>
          </button>
          <button
            onClick={() => setStatusFilter("cancelled")}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              statusFilter === "cancelled"
                ? "bg-rose-700 text-white shadow-xs"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>{locale === "uz" ? "Rad etildi" : "Отклонено"}</span>
            <span className="ml-1 opacity-80">({stats.cancelled})</span>
          </button>
        </div>

        {/* Search & Sub-filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          {/* Search */}
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                locale === "uz"
                  ? "Mijoz ismi, telefon, lokatsiya yoki matn bo‘yicha qidirish..."
                  : "Поиск по имени, телефону, локации или описанию..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-[#0d3431] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Deal type filter */}
          <div className="md:col-span-3">
            <select
              value={dealFilter}
              onChange={(e) => setDealFilter(e.target.value as DealFilter)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#0d3431] focus:bg-white transition-all"
            >
              <option value="all">{locale === "uz" ? "Barcha bitimlar (Sotuv / Ijara)" : "Все сделки (Продажа / Аренда)"}</option>
              <option value="sale">{locale === "uz" ? "Sotuv" : "Продажа"}</option>
              <option value="rent">{locale === "uz" ? "Ijara" : "Аренда"}</option>
            </select>
          </div>

          {/* Property type filter */}
          <div className="md:col-span-3">
            <select
              value={propTypeFilter}
              onChange={(e) => setPropTypeFilter(e.target.value as PropTypeFilter)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#0d3431] focus:bg-white transition-all"
            >
              <option value="all">{locale === "uz" ? "Barcha mulk turlari" : "Все типы объектов"}</option>
              <option value="kvartira">{locale === "uz" ? "Kvartira" : "Квартира"}</option>
              <option value="uy_hovli">{locale === "uz" ? "Hovli uy" : "Дом / Участок"}</option>
              <option value="dala_hovli">{locale === "uz" ? "Dala hovli" : "Дача"}</option>
              <option value="tijorat">{locale === "uz" ? "Tijorat mulki" : "Коммерческая недвижимость"}</option>
              <option value="yer_uchastkasi">{locale === "uz" ? "Yer uchastkasi" : "Земельный участок"}</option>
              <option value="boshqa">{locale === "uz" ? "Boshqa" : "Другое"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Listing Requests Table / Cards */}
      {isLoading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#0d3431] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">
            {locale === "uz" ? "Arizalar yuklanmoqda..." : "Загрузка заявок..."}
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-3xl p-8 border border-red-200 text-center space-y-3 text-red-700">
          <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
          <div className="text-sm font-bold">{error}</div>
          <button
            onClick={() => fetchRequests(true)}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700"
          >
            {locale === "uz" ? "Qayta urinish" : "Повторить"}
          </button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3 max-w-md mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-[#0d3431] flex items-center justify-center mx-auto">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {locale === "uz" ? "Arizalar topilmadi" : "Заявок не найдено"}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {locale === "uz"
              ? "Tanlangan filtr yoki qidiruv bo‘yicha e'lon berish arizalari mavjud emas."
              : "По выбранным фильтрам или запросу заявок не обнаружено."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">{locale === "uz" ? "Mijoz (Ism & Tel)" : "Клиент"}</th>
                  <th className="py-3.5 px-4">{locale === "uz" ? "Bitim va mulk turi" : "Сделка и объект"}</th>
                  <th className="py-3.5 px-4">{locale === "uz" ? "Lokatsiya" : "Локация"}</th>
                  <th className="py-3.5 px-4">{locale === "uz" ? "Ob'ekt haqida" : "Описание"}</th>
                  <th className="py-3.5 px-4">{locale === "uz" ? "Sana" : "Дата"}</th>
                  <th className="py-3.5 px-4">{locale === "uz" ? "Status" : "Статус"}</th>
                  <th className="py-3.5 px-4">{locale === "uz" ? "Izoh" : "Заметка"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "uz" ? "Harakatlar" : "Действия"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredRequests.map((item) => {
                  const meta = item.metadata || {};
                  const dealType = meta.deal_type || "sale";
                  const propType = meta.property_type || "kvartira";
                  const location = meta.location || item.property_title || "-";
                  const description = item.message || meta.description || "-";
                  const channel = meta.preferred_channel || "phone";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedRequest(item)}
                    >
                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.client_name || (locale === "uz" ? "Nomsiz mijoz" : "Без имени")}
                          </span>
                          <a
                            href={`tel:${item.client_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{item.client_phone || "-"}</span>
                          </a>
                          {channel === "telegram" && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-sky-600 mt-0.5">
                              <Send className="h-2.5 w-2.5" />
                              <span>Telegram</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Deal & Prop Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                              dealType === "rent"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {dealType === "rent"
                              ? locale === "uz" ? "Ijara" : "Аренда"
                              : locale === "uz" ? "Sotuv" : "Продажа"}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-600">
                            {formatPropertyType(propType, locale)}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 max-w-[180px]">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-semibold text-[11px]" title={location}>
                            {location}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <p className="line-clamp-2 text-[11px] text-slate-600 leading-relaxed" title={description}>
                          {description}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {formatDate(item.created_at)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <StatusDropdown
                          status={item.status}
                          locale={locale}
                          onSelect={(newSt) => handleUpdateStatus(item.id, newSt)}
                        />
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-[160px]">
                        {item.notes ? (
                          <span className="text-[11px] text-slate-600 line-clamp-1 italic font-normal" title={item.notes}>
                            {item.notes}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-normal">
                            {locale === "uz" ? "— Izoh yo‘q" : "— Нет заметки"}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setSelectedRequest(item)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title={locale === "uz" ? "Batafsil ko‘rish" : "Подробнее"}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <a
                            href={`tel:${item.client_phone}`}
                            className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                            title={locale === "uz" ? "Qo‘ng‘iroq qilish" : "Позвонить"}
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          {item.status === "cancelled" ? (
                            <button
                              onClick={() => handleUpdateStatus(item.id, "new")}
                              className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                              title={locale === "uz" ? "Qayta ko'rib chiqish (Tiklash)" : "Восстановить заявку"}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setArchiveConfirmRequest(item)}
                              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                              title={locale === "uz" ? "Rad etish / Arxivlash" : "Отклонить / В архив"}
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPermanentDeleteConfirmText("");
                              setPermanentDeleteRequest(item);
                            }}
                            className="p-1.5 rounded-xl bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-700 transition-colors"
                            title={locale === "uz" ? "To'liq o'chirish (qaytarib bo'lmaydi)" : "Удалить навсегда (необратимо)"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="lg:hidden space-y-3">
            {filteredRequests.map((item) => {
              const meta = item.metadata || {};
              const dealType = meta.deal_type || "sale";
              const propType = meta.property_type || "kvartira";
              const location = meta.location || item.property_title || "-";
              const description = item.message || meta.description || "-";

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedRequest(item)}
                  className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3 active:scale-99 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-sm text-slate-900">
                        {item.client_name || (locale === "uz" ? "Nomsiz mijoz" : "Без имени")}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(item.created_at)}</div>
                    </div>
                    <StatusBadge status={item.status} locale={locale} />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                        dealType === "rent"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {dealType === "rent"
                        ? locale === "uz" ? "Ijara" : "Аренда"
                        : locale === "uz" ? "Sotuv" : "Продажа"}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {formatPropertyType(propType, locale)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{location}</span>
                  </div>

                  {description && description !== "-" && (
                    <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      {description}
                    </p>
                  )}

                  {item.notes && (
                    <div className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-xl border border-amber-200/50">
                      <span className="font-bold">{locale === "uz" ? "Izoh: " : "Заметка: "}</span>
                      {item.notes}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:${item.client_phone}`}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{item.client_phone || (locale === "uz" ? "Qo‘ng‘iroq" : "Позвонить")}</span>
                    </a>
                    {item.status === "cancelled" ? (
                      <button
                        onClick={() => handleUpdateStatus(item.id, "new")}
                        className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        title={locale === "uz" ? "Tiklash" : "Восстановить"}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setArchiveConfirmRequest(item)}
                        className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                        title={locale === "uz" ? "Rad etish" : "Отклонить"}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedRequest(item)}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                    >
                      {locale === "uz" ? "Ko‘rish" : "Открыть"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Modal / Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    {selectedRequest.client_name || (locale === "uz" ? "Nomsiz mijoz" : "Без имени")}
                  </h3>
                  <StatusBadge status={selectedRequest.status} locale={locale} />
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {locale === "uz" ? "Yuborilgan sana: " : "Дата отправки: "}
                  {formatDate(selectedRequest.created_at)}
                </div>
              </div>

              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 rounded-2xl bg-white hover:bg-slate-200 text-slate-500 transition-colors border border-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Section 1: Client & Contact */}
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {locale === "uz" ? "Mijoz ma'lumotlari" : "Данные клиента"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-slate-500">{locale === "uz" ? "Ism" : "Имя"}:</span>
                    <div className="text-sm font-bold text-slate-900">{selectedRequest.client_name || "-"}</div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{locale === "uz" ? "Telefon" : "Телефон"}:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <a
                        href={`tel:${selectedRequest.client_phone}`}
                        className="text-sm font-bold text-emerald-700 hover:underline flex items-center gap-1.5"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>{selectedRequest.client_phone || "-"}</span>
                      </a>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{locale === "uz" ? "Qulay aloqa usuli" : "Способ связи"}:</span>
                    <div className="text-xs font-bold text-slate-800 capitalize">
                      {selectedRequest.metadata?.preferred_channel === "telegram" ? "Telegram" : "Telefon"}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{locale === "uz" ? "Qurilma va manba" : "Устройство и источник"}:</span>
                    <div className="text-xs font-semibold text-slate-700">
                      {selectedRequest.device || "Desktop"} ({selectedRequest.traffic_source || "Listing Request"})
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <a
                    href={`tel:${selectedRequest.client_phone}`}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    <span>{locale === "uz" ? "Qo‘ng‘iroq qilish" : "Позвонить клиенту"}</span>
                  </a>
                  {selectedRequest.metadata?.preferred_channel === "telegram" && (
                    <a
                      href={`https://t.me/${selectedRequest.client_phone?.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Send className="h-4 w-4" />
                      <span>Telegram</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Section 2: Property Information */}
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {locale === "uz" ? "Ko‘chmas mulk ma'lumotlari" : "Информация об объекте"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-slate-500">{locale === "uz" ? "Bitim turi" : "Тип сделки"}:</span>
                    <div className="mt-0.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black border ${
                          selectedRequest.metadata?.deal_type === "rent"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {selectedRequest.metadata?.deal_type === "rent"
                          ? locale === "uz" ? "Ijara" : "Аренда"
                          : locale === "uz" ? "Sotuv" : "Продажа"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500">{locale === "uz" ? "Ob'ekt turi" : "Тип объекта"}:</span>
                    <div className="text-xs font-bold text-slate-800 mt-1">
                      {formatPropertyType(selectedRequest.metadata?.property_type, locale)}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-xs text-slate-500">{locale === "uz" ? "Manzil va hudud" : "Адрес и локация"}:</span>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-4 w-4 text-[#0d3431] shrink-0" />
                      <span>{selectedRequest.metadata?.location || selectedRequest.property_title || "-"}</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-xs text-slate-500">{locale === "uz" ? "Mijoz tavsifi" : "Описание от клиента"}:</span>
                    <div className="mt-1.5 p-3 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {selectedRequest.message || selectedRequest.metadata?.description || "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Status Management */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  {locale === "uz" ? "Ariza statusini o‘zgartirish" : "Изменить статус заявки"}:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus(selectedRequest.id, "new")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      selectedRequest.status === "new"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-amber-50/60 text-amber-800 border-amber-200 hover:bg-amber-100"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>{locale === "uz" ? "Yangi" : "Новая"}</span>
                  </button>

                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus(selectedRequest.id, "in_progress")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      selectedRequest.status === "in_progress"
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-sky-50/60 text-sky-800 border-sky-200 hover:bg-sky-100"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <span>{locale === "uz" ? "Ko‘rib chiqilmoqda" : "В работе"}</span>
                  </button>

                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus(selectedRequest.id, "contacted")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      selectedRequest.status === "contacted"
                        ? "bg-teal-700 text-white border-teal-700 shadow-xs"
                        : "bg-teal-50/60 text-teal-800 border-teal-200 hover:bg-teal-100"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    <span>{locale === "uz" ? "Bog‘lanildi" : "Связались"}</span>
                  </button>

                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus(selectedRequest.id, "completed")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      selectedRequest.status === "completed" || selectedRequest.status === "closed"
                        ? "bg-[#0d3431] text-white border-[#0d3431] shadow-xs"
                        : "bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{locale === "uz" ? "E'lon yaratildi" : "Создан объект"}</span>
                  </button>

                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => setArchiveConfirmRequest(selectedRequest)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      selectedRequest.status === "cancelled"
                        ? "bg-rose-700 text-white border-rose-700 shadow-xs"
                        : "bg-rose-50/60 text-rose-800 border-rose-200 hover:bg-rose-100"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>{locale === "uz" ? "Rad etildi" : "Отклонено"}</span>
                  </button>
                </div>
              </div>

              {/* Section 4: Admin Notes / Izoh */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>{locale === "uz" ? "Admin izohi (eslatma)" : "Заметка администратора"}:</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {locale === "uz" ? "Faqat adminlar uchun ko‘rinadi" : "Видно только администраторам"}
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder={
                    locale === "uz"
                      ? "Mijoz bilan suhbat natijasi, kelishilgan narx yoki qo‘shimcha izohni yozing..."
                      : "Результат звонка, согласованная цена или примечание..."
                  }
                  className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#0d3431] focus:bg-white transition-all"
                />
                <button
                  disabled={isSavingNotes}
                  onClick={handleSaveNotes}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {isSavingNotes
                      ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
                      : locale === "uz" ? "Izohni saqlash" : "Сохранить заметку"}
                  </span>
                </button>
              </div>

              {/* Section 5: Transition to Property Creation */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#0d3431]">
                    {locale === "uz" ? "E'lon yaratishga tayyormisiz?" : "Готовы создать объявление?"}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {locale === "uz"
                      ? "Mijoz ma'lumotlari bilan to‘ldirilgan holda yangi obyekt qo‘shish sahifasiga o‘tish"
                      : "Перейти к созданию объекта с предзаполненными данными"}
                  </div>
                </div>

                <Link
                  href={`/admin/properties/new?deal_type=${selectedRequest.metadata?.deal_type || "sale"}&property_type=${selectedRequest.metadata?.property_type || "kvartira"}&location=${encodeURIComponent(selectedRequest.metadata?.location || "")}&title=${encodeURIComponent(selectedRequest.client_name ? `${selectedRequest.client_name} - ${selectedRequest.metadata?.location || ""}` : "")}&description=${encodeURIComponent(selectedRequest.message || selectedRequest.metadata?.description || "")}`}
                  className="py-2.5 px-4 rounded-xl bg-[#0d3431] hover:bg-[#19453c] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                >
                  <span>{locale === "uz" ? "Obyekt yaratish" : "Создать объект"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Section 6: Archive / Re-activate Management Zone */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {selectedRequest.status === "cancelled"
                      ? (locale === "uz" ? "Ariza rad etilgan / arxivda" : "Заявка отклонена")
                      : (locale === "uz" ? "Arizani arxivga olish / Rad etish" : "Архивация / Отклонение заявки")}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {selectedRequest.status === "cancelled"
                      ? (locale === "uz" ? "Ushbu arizani qayta ko‘rib chiqishga qaytarishingiz mumkin" : "Вы можете вернуть заявку в работу")
                      : (locale === "uz" ? "Arizani bekor qilib, audit tarixi bilan arxivga saqlash" : "Отклонить заявку с сохранением аудита")}
                  </div>
                </div>

                {selectedRequest.status === "cancelled" ? (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedRequest.id, "in_progress")}
                    className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{locale === "uz" ? "Qayta ko‘rib chiqish" : "Вернуть в работу"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setArchiveConfirmRequest(selectedRequest)}
                    className="py-2 px-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>{locale === "uz" ? "Rad etish / Arxivlash" : "Отклонить"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safe Ariza Archive Confirmation Modal */}
      {archiveConfirmRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Archive className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {locale === "uz" ? "Arizani rad etish / arxivlash" : "Отклонить / архивировать заявку"}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">
                  {archiveConfirmRequest.client_name || (locale === "uz" ? "Mijoz" : "Клиент")} ({archiveConfirmRequest.client_phone})
                </p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-rose-900">
                {locale === "uz"
                  ? "Ariza holati «Rad etildi» qilib belgilanadi"
                  : "Статус заявки будет изменен на «Отклонено»"}
              </p>
              <p className="text-[11px] text-rose-800/90 leading-relaxed font-medium">
                {locale === "uz"
                  ? "Arizaning barcha ma'lumotlari, muloqot tarixi va kiritilgan izohlar bazada to‘liq saqlanadi. Istalgan vaqtda uni «Rad etildi» bo‘limidan yana qayta ko‘rib chiqishga tiklashingiz mumkin."
                  : "Все данные заявки, контакты и заметки сохранятся в базе данных для истории. Вы сможете восстановить её в любое время из вкладки «Отклонено»."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isArchivingRequest}
                onClick={() => setArchiveConfirmRequest(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                {locale === "uz" ? "Bekor qilish" : "Отмена"}
              </button>
              <button
                type="button"
                disabled={isArchivingRequest}
                onClick={async () => {
                  setIsArchivingRequest(true);
                  try {
                    await handleUpdateStatus(archiveConfirmRequest.id, "cancelled");
                    setArchiveConfirmRequest(null);
                  } finally {
                    setIsArchivingRequest(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>
                  {isArchivingRequest
                    ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
                    : locale === "uz" ? "Ha, rad etish" : "Да, отклонить"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Ariza Confirmation Modal */}
      {permanentDeleteRequest && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-rose-900 text-base">
                  {locale === "uz" ? "Arizani to'liq o'chirish — qaytarib bo'lmaydi!" : "Удалить заявку навсегда — необратимо!"}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">
                  {permanentDeleteRequest.client_name || permanentDeleteRequest.client_phone}
                </p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-black text-rose-900">
                {locale === "uz" ? "⚠️ Bu amalni bekor qilib bo'lmaydi!" : "⚠️ Это действие необратимо!"}
              </p>
              <ul className="text-[11px] text-rose-800 space-y-1 font-medium">
                <li>✗ {locale === "uz" ? "Ariza bazadan butunlay o'chiriladi" : "Заявка будет полностью удалена из базы"}</li>
                <li>✗ {locale === "uz" ? "Ariza tarixi va izohlari yo'qoladi" : "История и заметки заявки исчезнут"}</li>
                <li>✗ {locale === "uz" ? "Bu amalni bekor qilish MUMKIN EMAS" : "Отмена действия НЕВОЗМОЖНА"}</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {locale === "uz"
                  ? "Tasdiqlash uchun «O'CHIRAMAN» yozing:"
                  : "Для подтверждения напишите «УДАЛИТЬ»:"}
              </label>
              <input
                type="text"
                value={permanentDeleteConfirmText}
                onChange={(e) => setPermanentDeleteConfirmText(e.target.value)}
                placeholder={locale === "uz" ? "O'CHIRAMAN" : "УДАЛИТЬ"}
                className="w-full px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50/30 text-xs font-bold text-rose-900 placeholder:text-rose-300 focus:outline-none focus:border-rose-500 transition-all"
                autoComplete="off"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isPermanentDeleting}
                onClick={() => {
                  setPermanentDeleteRequest(null);
                  setPermanentDeleteConfirmText("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                {locale === "uz" ? "Bekor qilish" : "Отмена"}
              </button>
              <button
                type="button"
                disabled={
                  isPermanentDeleting ||
                  (locale === "uz"
                    ? permanentDeleteConfirmText.trim() !== "O'CHIRAMAN"
                    : permanentDeleteConfirmText.trim().toUpperCase() !== "УДАЛИТЬ")
                }
                onClick={async () => {
                  if (!permanentDeleteRequest) return;
                  setIsPermanentDeleting(true);
                  try {
                    const res = await fetch(`/api/admin/leads/${permanentDeleteRequest.id}`, {
                      method: "DELETE",
                    });
                    const json = await res.json();
                    if (res.ok && json.success) {
                      showToast(
                        locale === "uz"
                          ? "Ariza to'liq o'chirildi"
                          : "Заявка удалена навсегда"
                      );
                      setPermanentDeleteRequest(null);
                      setPermanentDeleteConfirmText("");
                      // Refresh the list
                      setRequests((prev) => prev.filter((r) => r.id !== permanentDeleteRequest.id));
                    } else {
                      showToast(json.error || (locale === "uz" ? "O'chirishda xatolik" : "Ошибка удаления"));
                    }
                  } catch {
                    showToast(locale === "uz" ? "Tarmoq xatoligi" : "Ошибка сети");
                  } finally {
                    setIsPermanentDeleting(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {isPermanentDeleting
                    ? locale === "uz" ? "O'chirilmoqda..." : "Удаление..."
                    : locale === "uz" ? "To'liq o'chirish" : "Удалить навсегда"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function getStatusLabel(status: Lead["status"], locale: string) {
  const s = status === "closed" ? "completed" : status;
  switch (s) {
    case "new":
      return locale === "uz" ? "Yangi" : "Новая";
    case "in_progress":
      return locale === "uz" ? "Ko‘rib chiqilmoqda" : "В работе";
    case "contacted":
      return locale === "uz" ? "Bog‘lanildi" : "Связались";
    case "completed":
      return locale === "uz" ? "E'lon yaratildi" : "Создан объект";
    case "cancelled":
      return locale === "uz" ? "Rad etildi" : "Отклонено";
    default:
      return status;
  }
}

function StatusBadge({ status, locale }: { status: Lead["status"]; locale: string }) {
  const s = status === "closed" ? "completed" : status;
  switch (s) {
    case "new":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>{locale === "uz" ? "Yangi" : "Новая"}</span>
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          <span>{locale === "uz" ? "Ko‘rib chiqilmoqda" : "В работе"}</span>
        </span>
      );
    case "contacted":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          <span>{locale === "uz" ? "Bog‘lanildi" : "Связались"}</span>
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Check className="h-3 w-3 text-emerald-600" />
          <span>{locale === "uz" ? "E'lon yaratildi" : "Создан объект"}</span>
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
          <XCircle className="h-3 w-3 text-rose-600" />
          <span>{locale === "uz" ? "Rad etildi" : "Отклонено"}</span>
        </span>
      );
    default:
      return null;
  }
}

function StatusDropdown({
  status,
  locale,
  onSelect,
}: {
  status: Lead["status"];
  locale: string;
  onSelect: (newStatus: Lead["status"]) => void;
}) {
  const current = status === "closed" ? "completed" : status;

  return (
    <select
      value={current}
      onChange={(e) => onSelect(e.target.value as Lead["status"])}
      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all focus:outline-hidden cursor-pointer ${
        current === "new"
          ? "bg-amber-50 text-amber-800 border-amber-300"
          : current === "in_progress"
          ? "bg-sky-50 text-sky-800 border-sky-300"
          : current === "contacted"
          ? "bg-teal-50 text-teal-800 border-teal-300"
          : current === "completed"
          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
          : "bg-rose-50 text-rose-800 border-rose-300"
      }`}
    >
      <option value="new">{locale === "uz" ? "Yangi" : "Новая"}</option>
      <option value="in_progress">{locale === "uz" ? "Ko‘rib chiqilmoqda" : "В работе"}</option>
      <option value="contacted">{locale === "uz" ? "Bog‘lanildi" : "Связались"}</option>
      <option value="completed">{locale === "uz" ? "E'lon yaratildi" : "Создан объект"}</option>
      <option value="cancelled">{locale === "uz" ? "Rad etildi" : "Отклонено"}</option>
    </select>
  );
}

function formatPropertyType(type: string | undefined, locale: string) {
  if (!type) return locale === "uz" ? "Kvartira" : "Квартира";
  switch (type.toLowerCase()) {
    case "kvartira":
    case "apartment":
      return locale === "uz" ? "Kvartira" : "Квартира";
    case "uy_hovli":
    case "hovli":
    case "house":
      return locale === "uz" ? "Hovli uy" : "Дом / Участок";
    case "dala_hovli":
    case "dacha":
      return locale === "uz" ? "Dala hovli" : "Дача";
    case "tijorat":
    case "commercial":
      return locale === "uz" ? "Tijorat mulki" : "Коммерческая недв.";
    case "yer_uchastkasi":
    case "land":
    case "yer":
      return locale === "uz" ? "Yer uchastkasi" : "Земельный участок";
    default:
      return locale === "uz" ? "Boshqa" : "Другое";
  }
}
