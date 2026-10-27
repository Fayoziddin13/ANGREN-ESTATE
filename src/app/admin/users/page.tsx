"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Heart,
  Eye,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Ban,
  Send,
  Phone,
  MessageSquare,
  ClipboardList,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { RegisteredUser, Lead } from "@/lib/types";

export default function AdminUsersPage() {
  const { locale } = useLanguage();

  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "google" | "telegram">("all");
  const [applicationFilter, setApplicationFilter] = useState<"all" | "has_application" | "no_application">("all");

  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Direct Telegram Message Modal State
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<{ success: boolean; text: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(
          errData.error ||
            (locale === "uz" ? "Foydalanuvchilarni yuklashda xatolik" : "Ошибка при загрузке пользователей"),
          "error"
        );
      }
    } catch (err: any) {
      showToast(
        locale === "uz" ? "Foydalanuvchilarni yuklashda tarmoq xatosi" : "Сетевая ошибка при загрузке пользователей",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (sourceFilter !== "all" && u.registration_source !== sourceFilter) return false;
      if (applicationFilter === "has_application" && !u.has_submitted_application) return false;
      if (applicationFilter === "no_application" && u.has_submitted_application) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          (u.telegram_username && u.telegram_username.toLowerCase().includes(q)) ||
          (u.telegram_user_id && String(u.telegram_user_id).includes(q)) ||
          (u.google_id && u.google_id.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [users, statusFilter, sourceFilter, applicationFilter, searchQuery]);

  const totalCount = users.length;
  const activeCount = useMemo(() => users.filter((u) => u.status === "active").length, [users]);
  const disabledCount = useMemo(() => users.filter((u) => u.status === "disabled").length, [users]);
  const googleCount = useMemo(() => users.filter((u) => u.registration_source === "google").length, [users]);
  const telegramCount = useMemo(() => users.filter((u) => u.registration_source === "telegram").length, [users]);
  const withAppCount = useMemo(() => users.filter((u) => u.has_submitted_application).length, [users]);

  const handleToggleStatus = async (userId: string, currentStatus: "active" | "disabled") => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    setTogglingId(userId);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(
          data.error ||
            (locale === "uz" ? "Amalni bajarishda xatolik yuz berdi" : "Произошла ошибка при выполнении операции"),
          "error"
        );
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );

      if (selectedUser?.id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      showToast(
        locale === "uz"
          ? `Foydalanuvchi holati "${newStatus === "active" ? "Faol" : "Bloklangan"}" ga o‘zgartirildi`
          : `Статус пользователя изменен на "${newStatus === "active" ? "Активен" : "Заблокирован"}"`,
        "success"
      );
    } catch (err) {
      showToast(locale === "uz" ? "Tarmoq xatosi yuz berdi" : "Произошла ошибка сети", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSendTelegramMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!messageText.trim()) return;

    setIsSendingMessage(true);
    setMessageFeedback(null);

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageText.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessageFeedback({
          success: true,
          text: locale === "uz" ? "Xabar Telegram orqali muvaffaqiyatli yetkazildi!" : "Сообщение успешно доставлено через Telegram!",
        });
        setMessageText("");
      } else {
        setMessageFeedback({
          success: false,
          text: data.message || data.error || (locale === "uz" ? "Xabarni yetkazishda xatolik yuz berdi" : "Ошибка при отправке сообщения"),
        });
      }
    } catch (err: any) {
      setMessageFeedback({
        success: false,
        text: err?.message || (locale === "uz" ? "Tarmoq xatosi" : "Ошибка сети"),
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-4 border ${
            toast.type === "success"
              ? "bg-[#167d4f] border-[#167d4f]/50 text-white font-bold text-xs"
              : "bg-red-900/90 border-red-500/50 text-white font-bold text-xs"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-[#2db477] shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eaf5f0] border border-[#bdd1c8] flex items-center justify-center text-[#167d4f]">
              <Users className="w-5 h-5" />
            </div>
            <span>{locale === "uz" ? "Foydalanuvchilar Boshqaruvi" : "Управление Пользователями"}</span>
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">
            {locale === "uz"
              ? "Google va Telegram orqali ro‘yxatdan o‘tgan foydalanuvchilar, arizalar tarixi va bevosita Telegram aloqa"
              : "Пользователи Google и Telegram, история заявок и прямая связь через Telegram"}
          </p>
        </div>

        {/* Security badge & Refresh */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl border border-slate-200 transition-all shadow-xs disabled:opacity-50"
            title="Yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin text-[#167d4f]" : ""}`} />
            <span>{locale === "uz" ? "Yangilash" : "Обновить"}</span>
          </button>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#eaf5f0]/60 border border-[#bdd1c8] text-[#167d4f] text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-[#167d4f]" />
            <span>{locale === "uz" ? "Google & Telegram xavfsiz tizimi" : "Google & Telegram защита"}</span>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {locale === "uz" ? "Jami Foydalanuvchilar" : "Всего"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#eaf5f0] flex items-center justify-center text-[#167d4f]">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {loading ? "..." : totalCount}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {locale === "uz" ? "Ro‘yxatdan o‘tganlar" : "Зарегистрировано"}
          </div>
        </div>

        {/* Google Users */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              Google
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>
          </div>
          <div className="text-2xl font-black text-blue-700 mt-1">
            {loading ? "..." : googleCount}
          </div>
          <div className="text-[10px] text-blue-600 font-semibold">
            {locale === "uz" ? "Google OAuth orqali" : "Через Google"}
          </div>
        </div>

        {/* Telegram Users */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">
              Telegram
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
              <Send className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-700 mt-1">
            {loading ? "..." : telegramCount}
          </div>
          <div className="text-[10px] text-sky-600 font-semibold">
            {locale === "uz" ? "Bot & Mini App orqali" : "Через Telegram"}
          </div>
        </div>

        {/* Submitted Application */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#167d4f] uppercase tracking-wider">
              {locale === "uz" ? "Ariza Qoldirgan" : "С заявками"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-[#167d4f]">
              <ClipboardList className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#167d4f] mt-1">
            {loading ? "..." : withAppCount}
          </div>
          <div className="text-[10px] text-[#167d4f] font-semibold">
            {locale === "uz" ? "E'lon berish arizasi bor" : "Подали заявку"}
          </div>
        </div>

        {/* Active vs Disabled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              {locale === "uz" ? "Faol / Blok" : "Актив / Блок"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {loading ? "..." : `${activeCount} / ${disabledCount}`}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold">
            {locale === "uz" ? `${activeCount} faol, ${disabledCount} blok` : `${activeCount} акт, ${disabledCount} блок`}
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                locale === "uz"
                  ? "Ism, telefon, email, username yoki ID..."
                  : "Имя, телефон, email, username или ID..."
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#167d4f] focus:ring-1 focus:ring-[#167d4f] transition-all"
            />
          </div>

          {/* Registration Source Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                sourceFilter === "all"
                  ? "bg-[#167d4f] text-white shadow-xs"
                  : "text-slate-700 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {locale === "uz" ? "Barcha manbalar" : "Все источники"}
            </button>
            <button
              onClick={() => setSourceFilter("google")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                sourceFilter === "google"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-700 hover:text-blue-700 hover:bg-white"
              }`}
            >
              <span>Google</span>
            </button>
            <button
              onClick={() => setSourceFilter("telegram")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                sourceFilter === "telegram"
                  ? "bg-[#229ED9] text-white shadow-xs"
                  : "text-slate-700 hover:text-[#229ED9] hover:bg-white"
              }`}
            >
              <Send className="w-3 h-3" />
              <span>Telegram</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter Row: Application Status & Account Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Application Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 mr-1">
              {locale === "uz" ? "Ariza:" : "Заявки:"}
            </span>
            <button
              onClick={() => setApplicationFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                applicationFilter === "all"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {locale === "uz" ? "Hammasi" : "Все"}
            </button>
            <button
              onClick={() => setApplicationFilter("has_application")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                applicationFilter === "has_application"
                  ? "bg-[#167d4f] text-white"
                  : "bg-emerald-50 text-[#167d4f] hover:bg-emerald-100"
              }`}
            >
              {locale === "uz" ? "Ariza qoldirgan" : "С заявками"} ({withAppCount})
            </button>
            <button
              onClick={() => setApplicationFilter("no_application")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                applicationFilter === "no_application"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {locale === "uz" ? "Ariza qoldirmagan" : "Без заявок"}
            </button>
          </div>

          {/* Account Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 mr-1">
              {locale === "uz" ? "Holat:" : "Статус:"}
            </span>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                statusFilter === "all"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {locale === "uz" ? "Barchasi" : "Все"}
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                statusFilter === "active"
                  ? "bg-[#167d4f] text-white"
                  : "bg-[#eaf5f0] text-[#167d4f] hover:bg-[#d8ece2]"
              }`}
            >
              {locale === "uz" ? "Faol" : "Актив"} ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter("disabled")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                statusFilter === "disabled"
                  ? "bg-red-700 text-white"
                  : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              {locale === "uz" ? "Bloklangan" : "Блок"} ({disabledCount})
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">{locale === "uz" ? "Foydalanuvchi" : "Пользователь"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Manba" : "Источник"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Ariza Holati" : "Статус Заявки"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Ro‘yxatdan o‘tgan" : "Дата регистрации"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Oxirgi faollik" : "Последняя активность"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "uz" ? "Holat / Aloqa" : "Статус / Связь"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#167d4f] mb-2" />
                    <span className="text-xs font-bold">{locale === "uz" ? "Yuklanmoqda..." : "Загрузка..."}</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-600">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <div className="text-sm font-bold text-slate-800">
                      {locale === "uz" ? "Foydalanuvchilar topilmadi" : "Пользователи не найдены"}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isTg = user.registration_source === "telegram";
                  const isGoogle = user.registration_source === "google";

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer border-b border-slate-100"
                      onClick={() => {
                        setSelectedUser(user);
                        setMessageFeedback(null);
                      }}
                    >
                      {/* User info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                            {user.avatar_url ? (
                              <Image
                                src={user.avatar_url}
                                alt={user.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div
                                className={`w-full h-full flex items-center justify-center font-black text-sm ${
                                  isTg
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-[#eaf5f0] text-[#167d4f]"
                                }`}
                              >
                                {isTg ? "TG" : user.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-[#167d4f] transition-colors flex items-center gap-2">
                              <span>{user.name}</span>
                              {user.role === "admin" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                              {user.phone ? (
                                <a
                                  href={`tel:${user.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[#167d4f] font-bold hover:underline inline-flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{user.phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">Telefon kiritilmagan</span>
                              )}
                              {user.email && !user.email.startsWith("tg_") && (
                                <span className="text-slate-400 truncate max-w-[150px]">
                                  • {user.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Registration Source */}
                      <td className="py-3.5 px-4 text-xs">
                        {isGoogle ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            <span>Google</span>
                          </span>
                        ) : isTg ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              <Send className="w-3 h-3 text-sky-600" />
                              <span>Telegram</span>
                            </span>
                            {user.telegram_username && (
                              <a
                                href={`https://t.me/${user.telegram_username.replace(/^@/, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] text-sky-600 font-bold hover:underline ml-1"
                              >
                                @{user.telegram_username.replace(/^@/, "")}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Sayt
                          </span>
                        )}
                      </td>

                      {/* Application Status */}
                      <td className="py-3.5 px-4 text-xs">
                        {user.has_submitted_application ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold bg-emerald-50 text-[#167d4f] border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#167d4f]" />
                              <span>{locale === "uz" ? "Ariza qoldirgan" : "Оставил заявку"}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold ml-1">
                              {user.applications_count} ta ariza
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <span>{locale === "uz" ? "Ariza qoldirmagan" : "Без заявок"}</span>
                          </span>
                        )}
                      </td>

                      {/* Registration Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <div className="font-semibold">{new Date(user.registration_date).toLocaleDateString()}</div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {new Date(user.registration_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <div className="font-semibold">{new Date(user.last_activity).toLocaleDateString()}</div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {new Date(user.last_activity).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Status & Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.can_message_telegram && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(user);
                                setIsMessageModalOpen(true);
                                setMessageFeedback(null);
                              }}
                              className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors"
                              title="Telegram orqali xabar yuborish"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(user.id, user.status);
                            }}
                            disabled={togglingId === user.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all shadow-xs disabled:opacity-50 ${
                              user.status === "active"
                                ? "bg-[#eaf5f0]/60 text-[#167d4f] border-[#bdd1c8] hover:bg-[#eaf5f0]"
                                : "bg-red-50 text-red-800 border-red-300 hover:bg-red-100"
                            }`}
                          >
                            {user.status === "active" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-[#167d4f]" />
                                {locale === "uz" ? "Faol" : "Активен"}
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-red-700" />
                                {locale === "uz" ? "Bloklangan" : "Заблокирован"}
                              </>
                            )}
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

      {/* User Details Drawer / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-5 shadow-2xl animate-in zoom-in-95 text-slate-900 my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-[#167d4f] shrink-0">
                  {selectedUser.avatar_url ? (
                    <Image
                      src={selectedUser.avatar_url}
                      alt={selectedUser.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#167d4f] font-black bg-[#eaf5f0]">
                      {selectedUser.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>{selectedUser.name}</span>
                    {selectedUser.role === "admin" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                        ADMIN
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-slate-600 font-medium">{selectedUser.email}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* User Meta Information Grid */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-bold">{locale === "uz" ? "Telefon raqami:" : "Телефон:"}</span>
                {selectedUser.phone ? (
                  <a
                    href={`tel:${selectedUser.phone}`}
                    className="text-[#167d4f] font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{selectedUser.phone}</span>
                  </a>
                ) : (
                  <span className="text-slate-400 font-medium">{locale === "uz" ? "Kiritilmagan" : "Не указан"}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-bold">{locale === "uz" ? "Ro‘yxatdan o‘tish manbasi:" : "Источник:"}</span>
                <span className="font-bold flex items-center gap-1.5">
                  {selectedUser.registration_source === "google" ? (
                    <span className="text-blue-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Google OAuth
                    </span>
                  ) : selectedUser.registration_source === "telegram" ? (
                    <span className="text-sky-600 flex items-center gap-1">
                      <Send className="w-3 h-3" /> Telegram
                    </span>
                  ) : (
                    <span className="text-slate-700">Veb-sayt</span>
                  )}
                </span>
              </div>

              {selectedUser.telegram_user_id && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">Telegram ID:</span>
                  <span className="font-mono text-slate-900 font-semibold">{selectedUser.telegram_user_id}</span>
                </div>
              )}

              {selectedUser.telegram_username && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">Telegram username:</span>
                  <a
                    href={`https://t.me/${selectedUser.telegram_username.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    @{selectedUser.telegram_username.replace(/^@/, "")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {selectedUser.google_id && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold">Google Sub ID:</span>
                  <span className="font-mono text-slate-500 text-[11px] truncate max-w-[200px]">{selectedUser.google_id}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-bold">{locale === "uz" ? "Ro‘yxatdan o‘tgan:" : "Дата регистрации:"}</span>
                <span className="text-slate-900 font-medium">{new Date(selectedUser.registration_date).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-bold">{locale === "uz" ? "Oxirgi faollik:" : "Последняя активность:"}</span>
                <span className="text-slate-900 font-medium">{new Date(selectedUser.last_activity).toLocaleString()}</span>
              </div>
            </div>

            {/* Applications History Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-[#167d4f]" />
                  <span>{locale === "uz" ? "E'lon berish arizalari tarixi" : "История заявок на размещение"}</span>
                </h4>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {selectedUser.applications_count || 0} ta
                </span>
              </div>

              {selectedUser.applications && selectedUser.applications.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedUser.applications.map((app) => (
                    <div
                      key={app.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-1 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 line-clamp-1">
                          {app.property_title || app.metadata?.location || "E'lon berish arizasi"}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            app.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : app.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : app.status === "cancelled"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {app.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          {app.metadata?.deal_type === "rent" ? "Ijara" : "Sotuv"} • {app.metadata?.property_type || "Kvartira"}
                        </span>
                        <span>{new Date(app.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  {locale === "uz"
                    ? "Foydalanuvchi hali e'lon berish arizasini topshirmagan."
                    : "Пользователь пока не подавал заявку на размещение объявления."}
                </div>
              )}
            </div>

            {/* Telegram Direct Message Action */}
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                  <span>Telegram orqali to‘g‘ridan-to‘g‘ri xabar</span>
                </span>
                {selectedUser.can_message_telegram ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/70 text-sky-800">
                    Bot ulangan
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                    Bot ulanmagan
                  </span>
                )}
              </div>

              {selectedUser.can_message_telegram ? (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-sky-800 leading-relaxed">
                    {locale === "uz"
                      ? "Foydalanuvchi botni ishga tushirgan. Admin paneldan uning shaxsiy Telegramiga xabar yuborishingiz mumkin."
                      : "Пользователь запустил бота. Вы можете отправить сообщение прямо в его Telegram."}
                  </p>
                  <button
                    onClick={() => {
                      setIsMessageModalOpen(true);
                      setMessageFeedback(null);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#229ED9] hover:bg-[#1e8ec3] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{locale === "uz" ? "Telegramga xabar yozish" : "Написать в Telegram"}</span>
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-slate-600 leading-relaxed pt-1">
                  ⚠️ {locale === "uz"
                    ? "Foydalanuvchi Telegram botni ishga tushirmagan. Telegram qoidalariga ko‘ra, bot foydalanuvchiga birinchi bo‘lib yozolmaydi."
                    : "Пользователь не запускал бота. По правилам Telegram, бот не может написать первым."}
                </div>
              )}
            </div>

            {/* Status Toggle Action */}
            <div className="pt-1">
              <button
                onClick={() => handleToggleStatus(selectedUser.id, selectedUser.status)}
                disabled={togglingId === selectedUser.id}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs ${
                  selectedUser.status === "active"
                    ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                    : "bg-[#167d4f] hover:bg-[#145d3c] text-white"
                }`}
              >
                {selectedUser.status === "active" ? (
                  <>
                    <Ban className="w-4 h-4 text-red-600" />
                    {locale === "uz" ? "Foydalanuvchini bloklash" : "Заблокировать пользователя"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    {locale === "uz" ? "Foydalanuvchini faollashtirish" : "Активировать пользователя"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Telegram Message Modal */}
      {isMessageModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Telegram orqali xabar yuborish</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Qabul qiluvchi: {selectedUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsMessageModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTelegramMessage} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Xabar matni:
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  required
                  placeholder="Hurmatli mijoz, e'loningiz bo‘yicha..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#229ED9] focus:ring-1 focus:ring-[#229ED9] transition-all"
                />
              </div>

              {messageFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                    messageFeedback.success
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {messageFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{messageFeedback.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMessageModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSendingMessage || !messageText.trim()}
                  className="px-5 py-2 rounded-xl bg-[#229ED9] hover:bg-[#1e8ec3] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSendingMessage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Yuborilmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Yuborish</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
