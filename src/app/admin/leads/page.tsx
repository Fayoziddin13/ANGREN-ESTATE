"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Send,
  Search,
  CheckCircle2,
  Clock,
  Smartphone,
  Monitor,
  ExternalLink,
  MessageSquare,
  Building2,
  Calendar,
  User,
  Download,
  AlertCircle,
  TrendingUp,
  FileText,
  Save,
  Check,
  RefreshCw,
  XCircle,
  UserCheck,
  MapPin,
  Tag,
  Home,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLeads } from "@/lib/leadStore";
import { Lead } from "@/lib/types";

type StatusTab = "all" | "new" | "contacted" | "in_progress" | "completed" | "cancelled";
type ChannelFilter = "all" | "phone" | "telegram" | "inquiry" | "property_listing_request";

export default function AdminLeadsPage() {
  const { locale } = useLanguage();
  const { leads, stats, isLoading, error, updateLeadStatus, updateLeadNotes, refresh } = useLeads();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [typeFilter, setTypeFilter] = useState<ChannelFilter>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadNotesDraft, setLeadNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync draft notes when a lead is selected
  useEffect(() => {
    if (selectedLead) {
      setLeadNotesDraft(selectedLead.notes || "");
    }
  }, [selectedLead]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isListingRequest = (lead: Lead) =>
    lead.type === "property_listing_request" ||
    lead.metadata?.lead_type === "property_listing_request" ||
    lead.metadata?.request_type === "property_listing_request";

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((item) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "completed" && (item.status === "completed" || item.status === "closed")) {
          // match completed/closed
        } else if (item.status !== statusFilter) {
          return false;
        }
      }
      // Type filter
      if (typeFilter !== "all") {
        if (typeFilter === "property_listing_request") {
          if (!isListingRequest(item)) return false;
        } else if (typeFilter === "inquiry") {
          if (item.type !== "inquiry" || isListingRequest(item)) return false;
        } else if (item.type !== typeFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = item.client_name?.toLowerCase().includes(q) || false;
        const matchesPhone = item.client_phone?.toLowerCase().includes(q) || false;
        const matchesProp = item.property_title?.toLowerCase().includes(q) || false;
        const matchesMsg = item.message?.toLowerCase().includes(q) || false;
        const matchesNotes = item.notes?.toLowerCase().includes(q) || false;
        const matchesLoc = item.metadata?.location?.toLowerCase().includes(q) || false;
        const matchesDesc = item.metadata?.description?.toLowerCase().includes(q) || false;
        return matchesClient || matchesPhone || matchesProp || matchesMsg || matchesNotes || matchesLoc || matchesDesc;
      }
      return true;
    });
  }, [leads, statusFilter, typeFilter, searchQuery]);

  const handleStatusChange = async (leadId: string, newStatus: Lead["status"]) => {
    const success = await updateLeadStatus(leadId, newStatus);
    if (success) {
      showToast(
        locale === "uz"
          ? `Lid holati "${getStatusLabel(newStatus, 'uz')}" ga o‘zgartirildi`
          : `Статус заявки изменен на "${getStatusLabel(newStatus, 'ru')}"`
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } else {
      showToast(locale === "uz" ? "Holatni o‘zgartirishda xatolik" : "Ошибка изменения статуса");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedLead) return;
    setIsSavingNotes(true);
    const success = await updateLeadNotes(selectedLead.id, leadNotesDraft);
    setIsSavingNotes(false);
    if (success) {
      setSelectedLead((prev) => (prev ? { ...prev, notes: leadNotesDraft } : null));
      showToast(locale === "uz" ? "Admin izohi muvaffaqiyatli saqlandi" : "Заметка администратора сохранена");
    } else {
      showToast(locale === "uz" ? "Izohni saqlashda xatolik" : "Ошибка сохранения заметки");
    }
  };

  function getStatusLabel(status: string, lang: "uz" | "ru"): string {
    switch (status) {
      case "new":
        return lang === "uz" ? "Yangi" : "Новый";
      case "contacted":
        return lang === "uz" ? "Bog‘lanildi" : "Связались";
      case "in_progress":
        return lang === "uz" ? "Jarayonda" : "В работе";
      case "completed":
      case "closed":
        return lang === "uz" ? "Yakunlandi" : "Завершено";
      case "cancelled":
        return lang === "uz" ? "Bekor qilindi" : "Отменено";
      default:
        return status;
    }
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case "new":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "contacted":
        return "bg-sky-100 text-sky-900 border-sky-300";
      case "in_progress":
        return "bg-blue-100 text-blue-900 border-blue-300";
      case "completed":
      case "closed":
        return "bg-emerald-100 text-emerald-900 border-emerald-300";
      case "cancelled":
        return "bg-slate-100 text-slate-800 border-slate-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  }

  const exportCSV = () => {
    const headers = "ID,Mijoz,Telefon,Mulk,Kanal,Manba,Qurilma,Holat,Admin_Izohi,Xabar,Sana\n";
    const rows = filteredLeads
      .map((l) =>
        [
          `"${l.id}"`,
          `"${(l.client_name || "").replace(/"/g, '""')}"`,
          `"${l.client_phone || ""}"`,
          `"${(l.property_title || "").replace(/"/g, '""')}"`,
          `"${l.type}"`,
          `"${l.traffic_source || "Direct"}"`,
          `"${l.device || "Desktop"}"`,
          `"${l.status}"`,
          `"${(l.notes || "").replace(/"/g, '""')}"`,
          `"${(l.message || "").replace(/"/g, '""')}"`,
          `"${l.created_at}"`,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angren_estate_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast(locale === "uz" ? "CSV fayl yuklandi" : "CSV файл экспортирован");
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0E3324] border border-emerald-500/50 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 font-bold text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#16543C]">
              <PhoneCall className="w-5 h-5" />
            </div>
            <span>{locale === "uz" ? "Murojaatlar va Lidlar" : "Заявки и Лиды"}</span>
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            {locale === "uz"
              ? "Ko‘chmas mulk bo‘yicha kelib tushgan qo‘ng‘iroqlar, Telegram murojaatlari va so‘rovlar (Supabase PostgreSQL)"
              : "Поступившие звонки, обращения в Telegram и запросы по объектам недвижимости (Supabase PostgreSQL)"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh()}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl border border-slate-200 text-xs font-bold transition-colors shadow-xs"
            title={locale === "uz" ? "Yangilash" : "Обновить"}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? "animate-spin text-[#16543C]" : ""}`} />
            <span>{locale === "uz" ? "Yangilash" : "Обновить"}</span>
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl border border-slate-200 text-xs font-bold transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#16543C]" />
            <span>{locale === "uz" ? "CSV eksport" : "Экспорт в CSV"}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {locale === "uz" ? "Jami Lidlar" : "Всего лидов"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-[#16543C]">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.total}</div>
          <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
            {locale === "uz" ? "Barcha murojaatlar" : "Всего обращений"}
          </div>
        </div>

        {/* New */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              {locale === "uz" ? "Yangi" : "Новые"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-800 mt-2">{stats.new}</div>
          <div className="text-[11px] text-amber-700 mt-0.5 font-semibold">
            {locale === "uz" ? "Kutilmoqda" : "Ожидают связи"}
          </div>
        </div>

        {/* Contacted */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">
              {locale === "uz" ? "Bog‘lanildi" : "Связались"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-800 mt-2">{stats.contacted}</div>
          <div className="text-[11px] text-sky-700 mt-0.5 font-semibold">
            {locale === "uz" ? "Aloqaga chiqildi" : "Первый контакт"}
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              {locale === "uz" ? "Jarayonda" : "В работе"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-800 mt-2">{stats.in_progress}</div>
          <div className="text-[11px] text-blue-700 mt-0.5 font-semibold">
            {locale === "uz" ? "Muzokaralar" : "Переговоры"}
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              {locale === "uz" ? "Yakunlandi" : "Завершено"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-2">{stats.completed}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5 font-semibold">
            {locale === "uz" ? "Muvaffaqiyatli" : "Успешные сделки"}
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {locale === "uz" ? "Bekor qilindi" : "Отменено"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">{stats.cancelled}</div>
          <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
            {locale === "uz" ? "Tarix saqlangan" : "Сохранено в архиве"}
          </div>
        </div>
      </div>

      {/* Banner for Arizalar */}
      <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16543C] text-white shrink-0">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#16543C]">
              {locale === "uz" ? "E'lon berish arizalari (Arizalar bo‘limi)" : "Заявки на размещение объявлений"}
            </div>
            <div className="text-[11px] text-slate-600">
              {locale === "uz"
                ? "Foydalanuvchilar tomonidan yuborilgan barcha ko‘chmas mulk arizalari alohida boshqaruv panelida"
                : "Все заявки пользователей на публикацию объектов в отдельном разделе"}
            </div>
          </div>
        </div>
        <Link
          href="/admin/arizalar"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#16543C] hover:bg-[#124230] text-white text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <span>{locale === "uz" ? "Arizalar bo‘limiga o‘tish" : "Перейти к заявкам"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              locale === "uz"
                ? "Mijoz, telefon, mulk yoki izoh bo‘yicha qidiruv..."
                : "Поиск по клиенту, телефону, объекту, заметке..."
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C] transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "all"
                  ? "bg-[#16543C] text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {locale === "uz" ? "Barchasi" : "Все"} ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter("new")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "new"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {locale === "uz" ? "Yangi" : "Новые"} ({stats.new})
            </button>
            <button
              onClick={() => setStatusFilter("contacted")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "contacted"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {locale === "uz" ? "Bog‘lanildi" : "Связались"} ({stats.contacted})
            </button>
            <button
              onClick={() => setStatusFilter("in_progress")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "in_progress"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {locale === "uz" ? "Jarayonda" : "В работе"} ({stats.in_progress})
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "completed"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {locale === "uz" ? "Yakunlandi" : "Завершено"} ({stats.completed})
            </button>
            <button
              onClick={() => setStatusFilter("cancelled")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === "cancelled"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {locale === "uz" ? "Bekor qilindi" : "Отменено"} ({stats.cancelled})
            </button>
          </div>

          {/* Channel selector */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ChannelFilter)}
            className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-[#16543C]"
          >
            <option value="all">{locale === "uz" ? "Barcha kanallar" : "Все каналы"}</option>
            <option value="property_listing_request">
              {locale === "uz" ? "Эълон бериш аризалари" : "Заявки на размещение"}
            </option>
            <option value="phone">{locale === "uz" ? "Telefon qo‘ng‘iroq" : "Телефонный звонок"}</option>
            <option value="telegram">Telegram</option>
            <option value="inquiry">{locale === "uz" ? "Onlayn so‘rov" : "Онлайн-запрос"}</option>
          </select>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => refresh()}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-200 transition-colors"
          >
            {locale === "uz" ? "Qayta urinish" : "Повторить"}
          </button>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">{locale === "uz" ? "Mijoz / Aloqa" : "Клиент / Контакт"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Qiziqayotgan Mulk" : "Интересующий объект"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Kanal & Qurilma" : "Канал и устройство"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Sana & Vaqt" : "Дата и время"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Holat" : "Статус"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "uz" ? "Amallar" : "Действия"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <div className="w-8 h-8 rounded-full border-2 border-[#16543C] border-t-transparent animate-spin mx-auto mb-3" />
                    <span className="text-sm font-semibold">
                      {locale === "uz" ? "Lidlar yuklanmoqda..." : "Загрузка заявок..."}
                    </span>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-600">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <div className="text-sm font-bold text-slate-800">
                      {locale === "uz" ? "Murojaatlar topilmadi" : "Заявок по заданным критериям не найдено"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {locale === "uz"
                        ? "Foydalanuvchilar mulk sahifalarida Qo‘ng‘iroq yoki Telegram tugmasini bosganda lidlar bu yerda aks etadi."
                        : "Когда пользователи нажимают «Звонок» или «Telegram» на объекте, заявки появляются здесь."}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    {/* Client info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                          {lead.client_name ? lead.client_name.slice(0, 2).toUpperCase() : "KL"}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                            {lead.client_name || (locale === "uz" ? "Noma’lum mijoz" : "Неизвестный клиент")}
                          </div>
                          {lead.client_phone ? (
                            <a
                              href={`tel:${lead.client_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-slate-600 hover:text-emerald-800 transition-colors flex items-center gap-1 mt-0.5 font-mono font-medium"
                            >
                              <PhoneCall className="w-3 h-3 text-emerald-700" />
                              <span>{lead.client_phone}</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              {lead.type === "telegram" ? "Telegram visitor" : "Telefon bosildi"}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Property title & notes preview */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 truncate">
                        {lead.property_title || (locale === "uz" ? "Umumiy so‘rov" : "Общий запрос")}
                      </div>
                      {lead.notes ? (
                        <div className="text-xs text-emerald-800 truncate flex items-center gap-1 mt-0.5">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="italic">"{lead.notes}"</span>
                        </div>
                      ) : lead.message ? (
                        <div className="text-xs text-slate-600 truncate italic mt-0.5">
                          "{lead.message}"
                        </div>
                      ) : null}
                    </td>

                    {/* Channel & Device */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isListingRequest(lead) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <Home className="w-3 h-3 text-[#16543C]" />
                            <span>{locale === "uz" ? "Эълон бериш" : "Размещение"}</span>
                          </span>
                        ) : lead.type === "phone" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                            <PhoneCall className="w-3 h-3" />
                            <span>{locale === "uz" ? "Telefon" : "Звонок"}</span>
                          </span>
                        ) : lead.type === "telegram" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-200">
                            <Send className="w-3 h-3" />
                            <span>Telegram</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                            <MessageSquare className="w-3 h-3" />
                            <span>{locale === "uz" ? "So‘rov" : "Запрос"}</span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {lead.device === "iPhone" || lead.device === "Android" ? (
                            <Smartphone className="w-3 h-3" />
                          ) : (
                            <Monitor className="w-3 h-3" />
                          )}
                          <span>{lead.device || "Desktop"}</span>
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      <div className="font-semibold">{new Date(lead.created_at).toLocaleDateString()}</div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        {new Date(lead.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    {/* Status badge & selector */}
                    <td className="py-3.5 px-4">
                      <div onClick={(e) => e.stopPropagation()} className="inline-block">
                        <select
                          value={lead.status === "closed" ? "completed" : lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead["status"])}
                          className={`text-xs font-bold px-2.5 py-1 rounded-xl border focus:outline-none transition-colors ${getStatusBadgeClass(
                            lead.status
                          )}`}
                        >
                          <option value="new" className="bg-white text-slate-900">
                            {locale === "uz" ? "Yangi" : "Новый"}
                          </option>
                          <option value="contacted" className="bg-white text-slate-900">
                            {locale === "uz" ? "Bog‘lanildi" : "Связались"}
                          </option>
                          <option value="in_progress" className="bg-white text-slate-900">
                            {locale === "uz" ? "Jarayonda" : "В работе"}
                          </option>
                          <option value="completed" className="bg-white text-slate-900">
                            {locale === "uz" ? "Yakunlandi" : "Завершено"}
                          </option>
                          <option value="cancelled" className="bg-white text-slate-900">
                            {locale === "uz" ? "Bekor qilindi" : "Отменено"}
                          </option>
                        </select>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="p-1.5 text-slate-600 hover:text-[#16543C] rounded-lg hover:bg-slate-100 transition-colors"
                          title={locale === "uz" ? "Batafsil ko‘rish" : "Подробнее"}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Slide-Over / Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto text-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#16543C]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {selectedLead.client_name || (locale === "uz" ? "Mijoz murojaati" : "Обращение клиента")}
                  </h3>
                  <div className="text-xs text-slate-500 font-mono">
                    ID: {selectedLead.id.slice(0, 18)}... • {new Date(selectedLead.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Client Contact Phone */}
              {selectedLead.client_phone && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-600">{locale === "uz" ? "Telefon raqam" : "Номер телефона"}</div>
                    <div className="text-base font-black text-slate-900 mt-0.5 font-mono">{selectedLead.client_phone}</div>
                  </div>
                  <a
                    href={`tel:${selectedLead.client_phone}`}
                    className="px-3.5 py-1.5 bg-[#16543C] hover:bg-[#0E3324] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{locale === "uz" ? "Qo‘ng‘iroq qilish" : "Позвонить"}</span>
                  </a>
                </div>
              )}

              {/* Listing Request Specific Details */}
              {isListingRequest(selectedLead) && (
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                      <Home className="w-4 h-4 text-[#16543C]" />
                      <span>{locale === "uz" ? "Эълон бериш аризаси маълумотлари" : "Данные заявки на размещение"}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {locale === "uz" ? "Янги ариза" : "Новая заявка"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{locale === "uz" ? "Битим тури" : "Тип сделки"}</div>
                      <div className="text-xs font-black text-slate-900 mt-0.5">
                        {selectedLead.metadata?.deal_type === "rent" || (selectedLead.metadata?.deal_type as string) === "ijara" ? (locale === "uz" ? "Ижара" : "Аренда") : (locale === "uz" ? "Сотув" : "Продажа")}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{locale === "uz" ? "Мулк тури" : "Тип недвижимости"}</div>
                      <div className="text-xs font-black text-slate-900 mt-0.5">
                        {(() => {
                          const pt = selectedLead.metadata?.property_type;
                          const map: Record<string, string> = {
                            kvartira: "Квартира",
                            apartment: "Квартира",
                            hovli: "Ҳовли уй",
                            house: "Ҳовли уй",
                            yer: "Ер участкаси",
                            land: "Ер участкаси",
                            yangi_qurilish: "Янги қурилиш",
                            new_building: "Янги қурилиш",
                            tijorat: "Тижорат",
                            commercial: "Тижорат",
                            boshqa: "Бошқа",
                            other: "Бошқа",
                          };
                          return (pt && map[pt]) || pt || (locale === "uz" ? "Квартира" : "Квартира");
                        })()}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-emerald-100 col-span-2 sm:col-span-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{locale === "uz" ? "Алоқа усули" : "Способ связи"}</div>
                      <div className="text-xs font-black text-slate-900 mt-0.5">
                        {selectedLead.metadata?.preferred_channel === "telegram" ? "Telegram" : (locale === "uz" ? "Телефон" : "Телефон")}
                      </div>
                    </div>
                  </div>

                  {selectedLead.metadata?.location && (
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">{locale === "uz" ? "Локация / Манзил" : "Локация / Адрес"}</div>
                        <div className="text-xs font-bold text-slate-900 mt-0.5">{selectedLead.metadata.location}</div>
                      </div>
                    </div>
                  )}

                  {(selectedLead.metadata?.description || selectedLead.message) && (
                    <div className="bg-white p-3 rounded-xl border border-emerald-100 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">{locale === "uz" ? "Объект ҳақида қисқача" : "Кратко об объекте"}</div>
                      <div className="text-xs font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {selectedLead.metadata?.description || selectedLead.message}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Property Card & Deep Links */}
              {!isListingRequest(selectedLead) && selectedLead.property_title && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#16543C]" />
                    <span>{locale === "uz" ? "Qiziqayotgan mulki" : "Интересующий объект"}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {selectedLead.property_title}
                  </div>
                  {selectedLead.property_id && (
                    <div className="flex items-center gap-3 pt-1 text-xs font-bold">
                      <Link
                        href={`/properties/${selectedLead.property_id}`}
                        target="_blank"
                        className="text-[#16543C] hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{locale === "uz" ? "Saytda ko‘rish" : "Открыть на сайте"}</span>
                      </Link>
                      <span className="text-slate-300">•</span>
                      <Link
                        href={`/admin/properties/${selectedLead.property_id}`}
                        target="_blank"
                        className="text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        <span>{locale === "uz" ? "Admin tahrirlash" : "Редактировать в админке"}</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Assigned Realtor */}
              {selectedLead.realtor && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 text-[#16543C] flex items-center justify-center font-bold text-xs">
                      {selectedLead.realtor.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{selectedLead.realtor.name}</div>
                      <div className="text-[11px] text-slate-600 font-mono">{selectedLead.realtor.phone}</div>
                    </div>
                  </div>
                  {selectedLead.realtor.telegram && (
                    <a
                      href={`https://t.me/${selectedLead.realtor.telegram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>{selectedLead.realtor.telegram}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Visitor Original Message */}
              {!isListingRequest(selectedLead) && selectedLead.message && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                    <span>{locale === "uz" ? "Mijozning dastlabki xabari" : "Сообщение клиента"}</span>
                  </div>
                  <div className="text-sm text-slate-800 mt-1 italic">
                    "{selectedLead.message}"
                  </div>
                </div>
              )}

              {/* Internal Admin Notes */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#16543C] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{locale === "uz" ? "Admin izohi / Ichki eslatma" : "Заметка администратора"}</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {locale === "uz" ? "Faqat adminlar ko‘radi" : "Видно только админам"}
                  </span>
                </div>
                <textarea
                  value={leadNotesDraft}
                  onChange={(e) => setLeadNotesDraft(e.target.value)}
                  rows={3}
                  placeholder={
                    locale === "uz"
                      ? "Mijoz bilan kelishuvlar, qayta qo‘ng‘iroq vaqti yoki bekor qilish sababini yozing..."
                      : "Запишите результаты звонка, договоренности с клиентом или причину отмены..."
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C] transition-all"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="px-3.5 py-1.5 bg-[#16543C] hover:bg-[#0E3324] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {isSavingNotes
                        ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
                        : locale === "uz" ? "Izohni saqlash" : "Сохранить заметку"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Context Metadata */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">{locale === "uz" ? "Kanal" : "Канал"}</div>
                  <div className="text-xs font-bold text-slate-900 mt-1 capitalize">{selectedLead.type}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">{locale === "uz" ? "Qurilma" : "Устройство"}</div>
                  <div className="text-xs font-bold text-slate-900 mt-1">{selectedLead.device || "Desktop"}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">{locale === "uz" ? "Trafik" : "Трафик"}</div>
                  <div className="text-xs font-bold text-slate-900 mt-1">{selectedLead.traffic_source || "Direct"}</div>
                </div>
              </div>

              {/* Status Selector in Modal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {locale === "uz" ? "Holatni o‘zgartirish:" : "Изменить статус:"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "new")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedLead.status === "new"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {locale === "uz" ? "Yangi" : "Новый"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "contacted")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedLead.status === "contacted"
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {locale === "uz" ? "Bog‘lanildi" : "Связались"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "in_progress")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedLead.status === "in_progress"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {locale === "uz" ? "Jarayonda" : "В работе"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "completed")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedLead.status === "completed" || selectedLead.status === "closed"
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {locale === "uz" ? "Yakunlandi" : "Завершено"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "cancelled")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedLead.status === "cancelled"
                        ? "bg-slate-700 text-white border-slate-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {locale === "uz" ? "Bekor qilindi" : "Отменено"}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-[11px] text-slate-500 italic">
                {locale === "uz"
                  ? "Tarixiy hisobot uchun lidlar tizimda saqlanadi"
                  : "Заявки сохраняются в системе для аудита"}
              </span>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
              >
                {locale === "uz" ? "Yopish" : "Закрыть"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
