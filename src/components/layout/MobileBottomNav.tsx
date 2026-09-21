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
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c2e1f]/90 backdrop-blur-2xl rounded-t-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.25)] border-t border-white/15">
        <nav className="flex items-center justify-around px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Tab 1: Home */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10.5px] text-white transition-all ${
              pathname === "/" ? "font-bold bg-white/10 opacity-100" : "font-medium opacity-75 hover:opacity-100"
            }`}
          >
            <Home className={`h-4.5 w-4.5 text-white ${pathname === "/" ? "stroke-[2.2]" : "stroke-[1.75]"}`} />
            <span className="text-white">{t.bottomNav.home}</span>
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
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10.5px] text-white font-medium opacity-75 hover:opacity-100 transition-all"
          >
            <Search className="h-4.5 w-4.5 stroke-[1.75] text-white" />
            <span className="text-white">{t.bottomNav.search}</span>
          </button>

          {/* Tab 3: Favorites */}
          <Link
            href="/favorites"
            className={`relative flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10.5px] text-white transition-all ${
              pathname === "/favorites" ? "font-bold bg-white/10 opacity-100" : "font-medium opacity-75 hover:opacity-100"
            }`}
          >
            <Heart className={`h-4.5 w-4.5 text-white ${pathname === "/favorites" ? "stroke-[2.2] fill-white/20" : "stroke-[1.75]"}`} />
            <span className="text-white">{t.bottomNav.favorites}</span>
            {favoritesCount > 0 && (
              <span className="absolute -top-0.5 right-1.5 flex h-3.5 min-w-3.5 px-1 items-center justify-center rounded-full bg-white text-[9px] font-black text-[#0c2e1f] shadow-sm">
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
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10.5px] text-white font-medium opacity-75 hover:opacity-100 transition-all"
          >
            <User className="h-4.5 w-4.5 stroke-[1.75] text-white" />
            <span className="text-white">{user ? user.full_name?.split(" ")[0] || (locale === "uz" ? "Profil" : "Профиль") : t.bottomNav.profile}</span>
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
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f9fbfa] border border-[#e2e9e6]">
              <div className="h-11 w-11 rounded-2xl bg-[#0c2e1f] text-white flex items-center justify-center font-bold text-base shadow-sm">
                {user.full_name?.charAt(0) || <User className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-brand-dark text-sm truncate">
                  {user.full_name || (locale === "uz" ? "Foydalanuvchi" : "Пользователь")}
                </h4>
                <p className="text-xs text-brand-muted truncate">{user.email}</p>
                <div className="flex items-center gap-1 text-[11px] text-[#19573c] font-semibold mt-0.5">
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
                  <Bookmark className="h-4 w-4 text-[#19573c]" />
                  <span>{locale === "uz" ? "Saqlangan qidiruvlar" : "Сохранённые поиски"}</span>
                </div>
                {unreadNotificationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#19573c] text-[10px] font-bold text-white">
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
                  <Scale className="h-4 w-4 text-[#19573c]" />
                  <span>{locale === "uz" ? "Obyektlarni solishtirish" : "Сравнение объектов"}</span>
                </div>
                {compareCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#19573c] text-[10px] font-bold text-white">
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
