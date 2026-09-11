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
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useLeads } from "@/lib/leadStore";
import { Lead } from "@/lib/types";

type StatusTab = "all" | "new" | "contacted" | "in_progress" | "completed" | "cancelled";
type ChannelFilter = "all" | "phone" | "telegram" | "inquiry";

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
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = item.client_name?.toLowerCase().includes(q) || false;
        const matchesPhone = item.client_phone?.toLowerCase().includes(q) || false;
        const matchesProp = item.property_title?.toLowerCase().includes(q) || false;
        const matchesMsg = item.message?.toLowerCase().includes(q) || false;
        const matchesNotes = item.notes?.toLowerCase().includes(q) || false;
        return matchesClient || matchesPhone || matchesProp || matchesMsg || matchesNotes;
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
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "contacted":
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
      case "in_progress":
        return "bg-blue-500/15 text-blue-300 border-blue-500/30";
      case "completed":
      case "closed":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "cancelled":
        return "bg-slate-700/40 text-slate-400 border-slate-700/60";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
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
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#113F2D] border border-emerald-500/50 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <PhoneCall className="w-5 h-5" />
            </div>
            <span>{locale === "uz" ? "Murojaatlar va Lidlar" : "Заявки и Лиды"}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {locale === "uz"
              ? "Ko‘chmas mulk bo‘yicha kelib tushgan qo‘ng‘iroqlar, Telegram murojaatlari va so‘rovlar (Supabase PostgreSQL)"
              : "Поступившие звонки, обращения в Telegram и запросы по объектам недвижимости (Supabase PostgreSQL)"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh()}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 text-sm font-medium transition-colors"
            title={locale === "uz" ? "Yangilash" : "Обновить"}
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
            <span>{locale === "uz" ? "Yangilash" : "Обновить"}</span>
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{locale === "uz" ? "CSV eksport" : "Экспорт в CSV"}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {locale === "uz" ? "Jami Lidlar" : "Всего лидов"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {locale === "uz" ? "Barcha murojaatlar" : "Всего обращений"}
          </div>
        </div>

        {/* New */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-amber-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              {locale === "uz" ? "Yangi" : "Новые"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-300 mt-2">{stats.new}</div>
          <div className="text-[11px] text-amber-500/80 mt-0.5">
            {locale === "uz" ? "Kutilmoqda" : "Ожидают связи"}
          </div>
        </div>

        {/* Contacted */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-sky-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
              {locale === "uz" ? "Bog‘lanildi" : "Связались"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-300 mt-2">{stats.contacted}</div>
          <div className="text-[11px] text-sky-400/80 mt-0.5">
            {locale === "uz" ? "Aloqaga chiqildi" : "Первый контакт"}
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-blue-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
              {locale === "uz" ? "Jarayonda" : "В работе"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-300 mt-2">{stats.in_progress}</div>
          <div className="text-[11px] text-blue-400/80 mt-0.5">
            {locale === "uz" ? "Muzokaralar" : "Переговоры"}
          </div>
        </div>

        {/* Completed */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              {locale === "uz" ? "Yakunlandi" : "Завершено"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-300 mt-2">{stats.completed}</div>
          <div className="text-[11px] text-emerald-400/80 mt-0.5">
            {locale === "uz" ? "Muvaffaqiyatli" : "Успешные сделки"}
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-700/60 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {locale === "uz" ? "Bekor qilindi" : "Отменено"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-300 mt-2">{stats.cancelled}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {locale === "uz" ? "Tarix saqlangan" : "Сохранено в архиве"}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/70 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
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
            className="w-full bg-slate-950/70 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Tabs */}
          <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                statusFilter === "all"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {locale === "uz" ? "Barchasi" : "Все"} ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter("new")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                statusFilter === "new"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {locale === "uz" ? "Yangi" : "Новые"} ({stats.new})
            </button>
            <button
              onClick={() => setStatusFilter("contacted")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                statusFilter === "contacted"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {locale === "uz" ? "Bog‘lanildi" : "Связались"} ({stats.contacted})
            </button>
            <button
              onClick={() => setStatusFilter("in_progress")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                statusFilter === "in_progress"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {locale === "uz" ? "Jarayonda" : "В работе"} ({stats.in_progress})
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                statusFilter === "completed"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {locale === "uz" ? "Yakunlandi" : "Завершено"} ({stats.completed})
            </button>
            <button
              onClick={() => setStatusFilter("cancelled")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                statusFilter === "cancelled"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {locale === "uz" ? "Bekor qilindi" : "Отменено"} ({stats.cancelled})
            </button>
          </div>

          {/* Channel selector */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ChannelFilter)}
            className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">{locale === "uz" ? "Barcha kanallar" : "Все каналы"}</option>
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
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">{locale === "uz" ? "Mijoz / Aloqa" : "Клиент / Контакт"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Qiziqayotgan Mulk" : "Интересующий объект"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Kanal & Qurilma" : "Канал и устройство"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Sana & Vaqt" : "Дата и время"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Holat" : "Статус"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "uz" ? "Amallar" : "Действия"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading && leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mx-auto mb-3" />
                    <span className="text-sm font-medium">
                      {locale === "uz" ? "Lidlar yuklanmoqda..." : "Загрузка заявок..."}
                    </span>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <div className="text-sm font-medium">
                      {locale === "uz" ? "Murojaatlar topilmadi" : "Заявок по заданным критериям не найдено"}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
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
                    className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    {/* Client info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs shrink-0">
                          {lead.client_name ? lead.client_name.slice(0, 2).toUpperCase() : "KL"}
                        </div>
                        <div>
                          <div className="font-medium text-white group-hover:text-emerald-300 transition-colors">
                            {lead.client_name || (locale === "uz" ? "Noma’lum mijoz" : "Неизвестный клиент")}
                          </div>
                          {lead.client_phone ? (
                            <a
                              href={`tel:${lead.client_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 mt-0.5 font-mono"
                            >
                              <PhoneCall className="w-3 h-3 text-emerald-400" />
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
                      <div className="font-medium text-slate-200 truncate">
                        {lead.property_title || (locale === "uz" ? "Umumiy so‘rov" : "Общий запрос")}
                      </div>
                      {lead.notes ? (
                        <div className="text-xs text-emerald-400 truncate flex items-center gap-1 mt-0.5">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="italic">"{lead.notes}"</span>
                        </div>
                      ) : lead.message ? (
                        <div className="text-xs text-slate-400 truncate italic mt-0.5">
                          "{lead.message}"
                        </div>
                      ) : null}
                    </td>

                    {/* Channel & Device */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {lead.type === "phone" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <PhoneCall className="w-3 h-3" />
                            <span>{locale === "uz" ? "Telefon" : "Звонок"}</span>
                          </span>
                        ) : lead.type === "telegram" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <Send className="w-3 h-3" />
                            <span>Telegram</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <MessageSquare className="w-3 h-3" />
                            <span>{locale === "uz" ? "So‘rov" : "Запрос"}</span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400 border border-slate-700">
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
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      <div>{new Date(lead.created_at).toLocaleDateString()}</div>
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
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors ${getStatusBadgeClass(
                            lead.status
                          )}`}
                        >
                          <option value="new" className="bg-slate-900 text-amber-300">
                            {locale === "uz" ? "Yangi" : "Новый"}
                          </option>
                          <option value="contacted" className="bg-slate-900 text-sky-300">
                            {locale === "uz" ? "Bog‘lanildi" : "Связались"}
                          </option>
                          <option value="in_progress" className="bg-slate-900 text-blue-300">
                            {locale === "uz" ? "Jarayonda" : "В работе"}
                          </option>
                          <option value="completed" className="bg-slate-900 text-emerald-300">
                            {locale === "uz" ? "Yakunlandi" : "Завершено"}
                          </option>
                          <option value="cancelled" className="bg-slate-900 text-slate-400">
                            {locale === "uz" ? "Bekor qilindi" : "Отменено"}
                          </option>
                        </select>
                      </div>
                    </td>

                    {/* Actions: ONLY View Detail, Zero Delete */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors"
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

      {/* Detail Slide-Over / Modal (Zero Delete, Has Admin Notes & Cancel Option) */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedLead.client_name || (locale === "uz" ? "Mijoz murojaati" : "Обращение клиента")}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    ID: {selectedLead.id.slice(0, 18)}... • {new Date(selectedLead.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Client Contact Phone */}
              {selectedLead.client_phone && (
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">{locale === "uz" ? "Telefon raqam" : "Номер телефона"}</div>
                    <div className="text-base font-semibold text-white mt-0.5 font-mono">{selectedLead.client_phone}</div>
                  </div>
                  <a
                    href={`tel:${selectedLead.client_phone}`}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{locale === "uz" ? "Qo‘ng‘iroq qilish" : "Позвонить"}</span>
                  </a>
                </div>
              )}

              {/* Property Card & Deep Links */}
              {selectedLead.property_title && (
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{locale === "uz" ? "Qiziqayotgan mulki" : "Интересующий объект"}</span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {selectedLead.property_title}
                  </div>
                  {selectedLead.property_id && (
                    <div className="flex items-center gap-3 pt-1 text-xs">
                      <Link
                        href={`/properties/${selectedLead.property_id}`}
                        target="_blank"
                        className="text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{locale === "uz" ? "Saytda ko‘rish" : "Открыть на сайте"}</span>
                      </Link>
                      <span className="text-slate-600">•</span>
                      <Link
                        href={`/admin/properties/${selectedLead.property_id}`}
                        target="_blank"
                        className="text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <span>{locale === "uz" ? "Admin tahrirlash" : "Редактировать в админке"}</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Assigned Realtor */}
              {selectedLead.realtor && (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-600/40 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      {selectedLead.realtor.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{selectedLead.realtor.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{selectedLead.realtor.phone}</div>
                    </div>
                  </div>
                  {selectedLead.realtor.telegram && (
                    <a
                      href={`https://t.me/${selectedLead.realtor.telegram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>{selectedLead.realtor.telegram}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Visitor Original Message */}
              {selectedLead.message && (
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>{locale === "uz" ? "Mijozning dastlabki xabari" : "Сообщение клиента"}</span>
                  </div>
                  <div className="text-sm text-slate-200 mt-1 italic">
                    "{selectedLead.message}"
                  </div>
                </div>
              )}

              {/* Internal Admin Notes (CORRECTION 1: Separated Notes from Visitor Message) */}
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{locale === "uz" ? "Admin izohi / Ichki eslatma" : "Заметка администратора"}</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
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
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
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
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase text-slate-400">{locale === "uz" ? "Kanal" : "Канал"}</div>
                  <div className="text-xs font-semibold text-white mt-1 capitalize">{selectedLead.type}</div>
                </div>
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase text-slate-400">{locale === "uz" ? "Qurilma" : "Устройство"}</div>
                  <div className="text-xs font-semibold text-white mt-1">{selectedLead.device || "Desktop"}</div>
                </div>
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] uppercase text-slate-400">{locale === "uz" ? "Trafik" : "Трафик"}</div>
                  <div className="text-xs font-semibold text-white mt-1">{selectedLead.traffic_source || "Direct"}</div>
                </div>
              </div>

              {/* Status Selector in Modal (Approved Statuses: new, contacted, in_progress, completed, cancelled) */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  {locale === "uz" ? "Holatni o‘zgartirish:" : "Изменить статус:"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "new")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      selectedLead.status === "new"
                        ? "bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-900/30"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {locale === "uz" ? "Yangi" : "Новый"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "contacted")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      selectedLead.status === "contacted"
                        ? "bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-900/30"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {locale === "uz" ? "Bog‘lanildi" : "Связались"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "in_progress")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      selectedLead.status === "in_progress"
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {locale === "uz" ? "Jarayonda" : "В работе"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "completed")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      selectedLead.status === "completed" || selectedLead.status === "closed"
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {locale === "uz" ? "Yakunlandi" : "Завершено"}
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedLead.id, "cancelled")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      selectedLead.status === "cancelled"
                        ? "bg-slate-600 text-white border-slate-500 shadow-md"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {locale === "uz" ? "Bekor qilindi" : "Отменено"}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer (CORRECTION 2: Zero Delete Buttons, Audit History Preserved) */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-[11px] text-slate-500 italic">
                {locale === "uz"
                  ? "Tarixiy hisobot uchun lidlar tizimda saqlanadi"
                  : "Заявки сохраняются в системе для аудита"}
              </span>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl transition-colors"
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
