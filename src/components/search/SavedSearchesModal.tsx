"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Bell,
  Trash2,
  ExternalLink,
  X,
  CheckCircle2,
  Building2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSavedSearches } from "@/lib/savedSearchStore";
import { SavedSearch, InAppNotification } from "@/lib/types";

interface SavedSearchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySearch?: (search: SavedSearch) => void;
  onViewProperty?: (propertyId: string) => void;
}

export function SavedSearchesModal({
  isOpen,
  onClose,
  onApplySearch,
  onViewProperty,
}: SavedSearchesModalProps) {
  const { locale } = useLanguage();
  const {
    savedSearches,
    removeSearch,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    clearAllNotifications,
  } = useSavedSearches();

  const [activeTab, setActiveTab] = useState<"searches" | "alerts">("searches");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d9eedb]/50 text-[#0d3431]">
                <Bookmark className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {locale === "uz" ? "Saqlangan qidiruvlar" : "Сохранённые поиски"}
                </h2>
                <p className="text-xs text-slate-500">
                  {locale === "uz"
                    ? "Mos yangi e’lonlar haqida in-app bildirishnomalar"
                    : "Уведомления о новых подходящих объектах"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label={locale === "uz" ? "Yopish" : "Закрыть"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center px-6 pt-3 border-b border-slate-100 gap-4">
            <button
              onClick={() => setActiveTab("searches")}
              className={`pb-3 text-xs sm:text-sm font-bold transition-all relative ${
                activeTab === "searches"
                  ? "text-[#0d3431]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span>{locale === "uz" ? "Qidiruvlar" : "Поиски"}</span>
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {savedSearches.length}
              </span>
              {activeTab === "searches" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d3431] rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("alerts")}
              className={`pb-3 text-xs sm:text-sm font-bold transition-all relative ${
                activeTab === "alerts"
                  ? "text-[#0d3431]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span>{locale === "uz" ? "Bildirishnomalar" : "Уведомления"}</span>
              {unreadNotificationsCount > 0 && (
                <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-[#19453c] text-white font-extrabold">
                  {unreadNotificationsCount}
                </span>
              )}
              {activeTab === "alerts" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d3431] rounded-full" />
              )}
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {activeTab === "searches" ? (
              savedSearches.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Bookmark className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">
                    {locale === "uz" ? "Saqlangan qidiruvlar yo‘q" : "Нет сохранённых поисков"}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {locale === "uz"
                      ? "Xarita yoki katalog filtrlarida o‘zingizga kerakli parametrlarni tanlab, 'Qidiruvni saqlash' tugmasini bosing."
                      : "Выберите нужные параметры в фильтрах и нажмите «Сохранить поиск»."}
                  </p>
                </div>
              ) : (
                savedSearches.map((search) => (
                  <div
                    key={search.id}
                    className="p-4 rounded-2xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-100 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 truncate">
                          {search.title}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                        {search.filters.transactionType && search.filters.transactionType !== "all" && (
                          <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold">
                            {search.filters.transactionType === "sale"
                              ? locale === "uz" ? "Sotib olish" : "Купить"
                              : locale === "uz" ? "Ijara" : "Аренда"}
                          </span>
                        )}
                        {search.filters.district && search.filters.district !== "all" && (
                          <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold">
                            {search.filters.district}
                          </span>
                        )}
                        {search.filters.rooms && (
                          <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold">
                            {search.filters.rooms} {locale === "uz" ? "xona" : "комн."}
                          </span>
                        )}
                        {search.filters.priceMax && (
                          <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold">
                            ≤ {search.filters.priceMax.toLocaleString("ru-RU")} {locale === "uz" ? "so‘m" : "сум"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onApplySearch && (
                        <button
                          onClick={() => {
                            onApplySearch(search);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#0d3431] text-white hover:bg-[#19453c] text-xs font-bold transition-all"
                        >
                          {locale === "uz" ? "Qo‘llash" : "Применить"}
                        </button>
                      )}
                      <button
                        onClick={() => removeSearch(search.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label={locale === "uz" ? "O‘chirish" : "Удалить"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Bell className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">
                  {locale === "uz" ? "Hozircha yangi bildirishnomalar yo‘q" : "Нет новых уведомлений"}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {locale === "uz"
                    ? "Saqlangan qidiruvlaringizga mos keluvchi yangi e’lonlar qo‘shilganda shu yerda ko‘rinadi."
                    : "Когда появятся новые объекты по сохраненным параметрам, они отобразятся здесь."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {locale === "uz" ? "Bildirishnomalar ro‘yxati" : "Список уведомлений"}
                  </span>
                  <button
                    onClick={clearAllNotifications}
                    className="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors"
                  >
                    {locale === "uz" ? "Tozalash" : "Очистить все"}
                  </button>
                </div>

                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      markNotificationRead(notif.id);
                      if (notif.propertyId && onViewProperty) {
                        onViewProperty(notif.propertyId);
                        onClose();
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      notif.read
                        ? "bg-white border-slate-100 text-slate-600"
                        : "bg-[#d9eedb]/40 border-[#8cb599]/30 text-slate-900 shadow-xs"
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {!notif.read && (
                          <span className="h-2 w-2 rounded-full bg-[#19453c] shrink-0" />
                        )}
                        <h4 className="text-xs font-black">
                          {locale === "uz" ? notif.titleUz : notif.titleRu}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {locale === "uz" ? notif.messageUz : notif.messageRu}
                      </p>
                      <span className="text-[10px] text-slate-400 block pt-1">
                        {new Date(notif.createdAt).toLocaleDateString(
                          locale === "uz" ? "uz-UZ" : "ru-RU",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>

                    <ExternalLink className="h-4 w-4 text-[#0d3431] shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
