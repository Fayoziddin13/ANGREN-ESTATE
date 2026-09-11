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
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { RegisteredUser } from "@/lib/types";

export default function AdminUsersPage() {
  const { locale } = useLanguage();

  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
        showToast(errData.error || "Failed to load users", "error");
      }
    } catch (err: any) {
      showToast("Network error loading users", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, statusFilter, searchQuery]);

  const activeCount = useMemo(() => users.filter((u) => u.status === "active").length, [users]);
  const disabledCount = useMemo(() => users.filter((u) => u.status === "disabled").length, [users]);

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
        showToast(data.error || "Amalni bajarishda xatolik yuz berdi", "error");
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
      showToast("Tarmoq xatosi / Ошибка сети", "error");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-4 border ${
            toast.type === "success"
              ? "bg-emerald-900/90 border-emerald-500/50 text-white"
              : "bg-red-900/90 border-red-500/50 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-emerald-400" />
            {locale === "uz" ? "Foydalanuvchilar Boshqaruvi" : "Управление Пользователями"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {locale === "uz"
              ? "Platformada ro‘yxatdan o‘tgan foydalanuvchilar va ularning faolligi (Supabase DB)"
              : "Зарегистрированные пользователи платформы и их активность (Supabase DB)"}
          </p>
        </div>

        {/* Security badge & Refresh */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            title="Yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            <span>{locale === "uz" ? "Yangilash" : "Обновить"}</span>
          </button>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>{locale === "uz" ? "Google OAuth bilan himoyalangan" : "Защищено через Google OAuth"}</span>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {locale === "uz" ? "Jami Ro‘yxatdan O‘tganlar" : "Всего зарегистрировано"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">
            {loading ? "..." : users.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {locale === "uz" ? "Supabase canonical bazasi" : "Каноническая база Supabase"}
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              {locale === "uz" ? "Faol Foydalanuvchilar" : "Активные пользователи"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-300 mt-2">
            {loading ? "..." : activeCount}
          </div>
          <div className="text-xs text-emerald-500/80 mt-1">
            {locale === "uz" ? "Cheklovlarsiz to‘liq kirish" : "Полный доступ без ограничений"}
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-red-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              {locale === "uz" ? "Bloklanganlar" : "Заблокированные"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-red-300 mt-2">
            {loading ? "..." : disabledCount}
          </div>
          <div className="text-xs text-red-500/80 mt-1">
            {locale === "uz" ? "Spam yoki qoidabuzar hisoblar" : "Заблокированные аккаунты"}
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-slate-900/70 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              locale === "uz"
                ? "Ism yoki email bo‘yicha qidiruv..."
                : "Поиск по имени или email..."
            }
            className="w-full bg-slate-950/70 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "all"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {locale === "uz" ? "Barchasi" : "Все"} ({users.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {locale === "uz" ? "Faol" : "Активные"} ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("disabled")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "disabled"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {locale === "uz" ? "Bloklangan" : "Заблокированные"} ({disabledCount})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">{locale === "uz" ? "Foydalanuvchi" : "Пользователь"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Rol" : "Роль"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Ro‘yxatdan o‘tgan" : "Дата регистрации"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Oxirgi faollik" : "Последняя активность"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Sevimlilar" : "Избранное"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Ko‘rishlar" : "Просмотры"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "uz" ? "Holat" : "Статус"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin text-emerald-400 mb-2" />
                    {locale === "uz" ? "Yuklanmoqda..." : "Загрузка..."}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    {locale === "uz" ? "Foydalanuvchilar topilmadi" : "Пользователи не найдены"}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    {/* User info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt={user.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-emerald-400 font-bold text-sm bg-emerald-950/40">
                              {user.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                            <span>{user.name}</span>
                            {user.role === "admin" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      <span
                        className={`px-2 py-1 rounded-md text-[11px] ${
                          user.role === "admin"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    {/* Registration Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      <div>{new Date(user.registration_date).toLocaleDateString()}</div>
                      <div className="text-slate-500">
                        {new Date(user.registration_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      <div>{new Date(user.last_activity).toLocaleDateString()}</div>
                      <div className="text-slate-500">
                        {new Date(user.last_activity).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    {/* Favorites Count */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        <Heart className="w-3 h-3 fill-pink-400/20" />
                        {user.favorites_count}
                      </span>
                    </td>

                    {/* Views Count */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        <Eye className="w-3 h-3" />
                        {user.viewed_properties_count}
                      </span>
                    </td>

                    {/* Status Toggle Badge */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(user.id, user.status);
                        }}
                        disabled={togglingId === user.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 ${
                          user.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                        }`}
                      >
                        {user.status === "active" ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {locale === "uz" ? "Faol" : "Активен"}
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-red-400" />
                            {locale === "uz" ? "Bloklangan" : "Заблокирован"}
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Drawer / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-800 border-2 border-emerald-500/40">
                  {selectedUser.avatar_url ? (
                    <Image
                      src={selectedUser.avatar_url}
                      alt={selectedUser.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-emerald-400 font-bold bg-emerald-950">
                      {selectedUser.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedUser.name}</span>
                    {selectedUser.role === "admin" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300">
                        ADMIN
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-slate-400">{selectedUser.email}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                    {locale === "uz" ? "Sevimlilar" : "Избранное"}
                  </div>
                  <div className="text-lg font-bold text-white mt-1">{selectedUser.favorites_count}</div>
                  <div className="text-[10px] text-slate-500">saqlangan e’lonlar</div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    {locale === "uz" ? "Ko‘rishlar" : "Просмотры"}
                  </div>
                  <div className="text-lg font-bold text-white mt-1">{selectedUser.viewed_properties_count}</div>
                  <div className="text-[10px] text-slate-500">ko‘rilgan obyektlar</div>
                </div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{locale === "uz" ? "ID raqami:" : "ID пользователя:"}</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]">{selectedUser.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{locale === "uz" ? "Rol:" : "Роль:"}</span>
                  <span className="text-emerald-400 font-semibold uppercase">{selectedUser.role}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{locale === "uz" ? "Ro‘yxatdan o‘tgan:" : "Дата регистрации:"}</span>
                  <span className="text-slate-300">{new Date(selectedUser.registration_date).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{locale === "uz" ? "Oxirgi faollik:" : "Последняя активность:"}</span>
                  <span className="text-slate-300">{new Date(selectedUser.last_activity).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{locale === "uz" ? "Avtorizatsiya turi:" : "Тип авторизации:"}</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Google OAuth 2.0 / Supabase
                  </span>
                </div>
              </div>

              {/* Status Action */}
              <div className="pt-2">
                <button
                  onClick={() => handleToggleStatus(selectedUser.id, selectedUser.status)}
                  disabled={togglingId === selectedUser.id}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                    selectedUser.status === "active"
                      ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {selectedUser.status === "active" ? (
                    <>
                      <Ban className="w-4 h-4" />
                      {locale === "uz" ? "Foydalanuvchini bloklash" : "Заблокировать пользователя"}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {locale === "uz" ? "Foydalanuvchini faollashtirish" : "Активировать пользователя"}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-800 pt-4">
              <button
                onClick={() => setSelectedUser(null)}
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
