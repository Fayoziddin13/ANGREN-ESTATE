"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, User, LogOut, Sparkles, Bookmark, Scale } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { useCompare } from "@/lib/compareStore";
import { useSavedSearches } from "@/lib/savedSearchStore";
import { Modal } from "@/components/ui/Modal";

interface MobileBottomNavProps {
  onSearchClick?: () => void;
}

export function MobileBottomNav({ onSearchClick }: MobileBottomNavProps) {
  const { locale, t } = useLanguage();
  const { user, openAuthModal, handleLogout } = useAuth();
  const { favoritesCount } = useFavorites();
  const { count: compareCount } = useCompare();
  const { unreadNotificationsCount } = useSavedSearches();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-float">
        <nav className="flex items-center justify-around px-4 pt-2.5 pb-6">
          {/* Tab 1: Home */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${
              pathname === "/" ? "text-brand-primary font-bold" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <Home className={`h-5 w-5 ${pathname === "/" ? "stroke-[2.5]" : "stroke-2"}`} />
            <span>{t.bottomNav.home}</span>
          </Link>

          {/* Tab 2: Qidiruv */}
          <button
            onClick={() => {
              if (onSearchClick) {
                onSearchClick();
              } else {
                window.location.href = "/";
              }
            }}
            className="flex flex-col items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Search className="h-5 w-5 stroke-2" />
            <span>{t.bottomNav.search}</span>
          </button>

          {/* Tab 3: Favorites */}
          <Link
            href="/favorites"
            className={`relative flex flex-col items-center gap-1 text-[11px] font-semibold transition-colors ${
              pathname === "/favorites" ? "text-brand-primary font-bold" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            <Heart className={`h-5 w-5 ${pathname === "/favorites" ? "stroke-[2.5] fill-brand-primary/10 text-brand-primary" : "stroke-2"}`} />
            <span>{t.bottomNav.favorites}</span>
            {favoritesCount > 0 && (
              <span className="absolute -top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white">
                {favoritesCount}
              </span>
            )}
          </Link>

          {/* Tab 4: Profile */}
          <button
            onClick={() => {
              if (!user) {
                openAuthModal();
              } else {
                setIsProfileOpen(true);
              }
            }}
            className="flex flex-col items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
          >
            <User className="h-5 w-5 stroke-2" />
            <span>{user ? user.full_name?.split(" ")[0] || (locale === "uz" ? "Profil" : "Профиль") : t.bottomNav.profile}</span>
          </button>
        </nav>
      </div>

      {/* Mobile Profile Modal */}
      {user && (
        <Modal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          title={locale === "uz" ? "Foydalanuvchi Profili" : "Профиль пользователя"}
        >
          <div className="space-y-5 pt-2">
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-brand-canvas/60 border border-brand-border/60">
              <div className="h-12 w-12 rounded-2xl bg-[#16543C] text-white flex items-center justify-center font-black text-lg shadow-sm">
                {user.full_name?.charAt(0) || <User className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-brand-dark text-sm truncate">
                  {user.full_name || (locale === "uz" ? "Foydalanuvchi" : "Пользователь")}
                </h4>
                <p className="text-xs text-brand-muted truncate">{user.email}</p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold mt-0.5">
                  <Sparkles className="h-3 w-3" />
                  <span>{locale === "uz" ? "Google bilan tasdiqlangan" : "Подтверждено через Google"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href="/favorites"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-800">
                  <Heart className="h-4 w-4 text-red-500 fill-red-500/20" />
                  <span>{locale === "uz" ? "Saqlangan e'lonlar" : "Сохранённые объекты"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {favoritesCount}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  window.dispatchEvent(new Event("angren_open_saved_searches"));
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-800">
                  <Bookmark className="h-4 w-4 text-emerald-600" />
                  <span>{locale === "uz" ? "Saqlangan qidiruvlar" : "Сохранённые поиски"}</span>
                </div>
                {unreadNotificationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  window.dispatchEvent(new Event("angren_open_compare"));
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5 text-xs font-bold text-gray-800">
                  <Scale className="h-4 w-4 text-emerald-600" />
                  <span>{locale === "uz" ? "Obyektlarni solishtirish" : "Сравнение объектов"}</span>
                </div>
                {compareCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    {compareCount}
                  </span>
                )}
              </button>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  handleLogout();
                  setIsProfileOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4" />
                <span>{t.navigation.signOut}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
