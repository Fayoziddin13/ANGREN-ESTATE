"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { PropertyCard } from "@/components/property/PropertyCard";
import { PropertyDetailModal } from "@/components/property/PropertyDetailModal";
import { useFavorites } from "@/lib/favoriteStore";
import { useProperties } from "@/lib/propertyStore";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { Property } from "@/lib/types";
import { Heart, ArrowRight, Building2, Lock, Sparkles } from "lucide-react";

export default function FavoritesPage() {
  const { locale, t } = useLanguage();
  const { user, openAuthModal } = useAuth();
  const { favoriteIds, isLoaded } = useFavorites();
  const { properties } = useProperties();

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filter properties that user favorited
  const favoriteProperties = properties.filter((p) => favoriteIds.includes(p.id));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 1. Main Header */}
      <Header />

      {/* 2. Top Banner */}
      <div className="bg-[#16543C] text-white py-8 sm:py-12 border-b border-emerald-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold tracking-wider uppercase">
                <Heart className="h-4 w-4 fill-red-400 text-red-400" />
                <span>{locale === "uz" ? "Saqlanganlar" : "Избранное"}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {locale === "uz" ? "Sizga ma’qul kelgan obyektlar" : "Сохранённые объекты недвижимости"}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80">
                {locale === "uz"
                  ? "Angrendagi o‘zingizga yoqqan ko‘chmas mulklarni qulay tarzda solishtiring"
                  : "Сравнивайте понравившиеся объекты недвижимости в Ангрене"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {user && (
                <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {favoriteProperties.length} {locale === "uz" ? "ta e'lon" : "объектов"}
                  </span>
                </div>
              )}
              <Link
                href="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white text-[#16543C] hover:bg-emerald-50 text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <span>{locale === "uz" ? "Xaritaga qaytish" : "На карту"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Content */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {!user ? (
          /* Unauthenticated State (Visitor Prompt) */
          <div className="max-w-md mx-auto text-center py-16 px-6 rounded-3xl bg-white border border-slate-100 shadow-card space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-[#16543C] shadow-inner">
              <Lock className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {locale === "uz"
                  ? "Saqlangan e’lonlarni ko‘rish uchun tizimga kiring"
                  : "Войдите, чтобы просмотреть сохраненные объекты"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {locale === "uz"
                  ? "Sevimli e’lonlaringiz har qanday qurilmadan qulay foydalanishingiz uchun xavfsiz saqlanadi."
                  : "Ваши избранные объекты будут надежно сохранены и доступны на любых ваших устройствах."}
              </p>
            </div>
            <div className="pt-3">
              <button
                onClick={openAuthModal}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-[#16543C] px-6 py-3.5 text-xs font-extrabold text-white shadow-elevated hover:bg-[#113F2D] active:scale-[0.99] transition-all"
              >
                {/* Google 4-Color SVG Icon */}
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
                <span>{locale === "uz" ? "Google orqali kirish" : "Войти через Google"}</span>
              </button>
            </div>
          </div>
        ) : favoriteProperties.length === 0 ? (
          /* Authenticated Empty State */
          <div className="max-w-md mx-auto text-center py-16 px-6 rounded-3xl bg-white border border-slate-100 shadow-card space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-[#16543C] shadow-inner">
              <Heart className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {locale === "uz" ? "Hozircha saqlangan e'lonlar yo‘q" : "Пока нет сохранённых объектов"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {locale === "uz"
                  ? "Angren shahri xaritasidan o‘zingizga ma’qul kelgan kvartira, uy yoki yer maydonini tanlang va yurakcha tugmasini bosing."
                  : "Выберите подходящую квартиру, дом или участок на карте Ангрена и нажмите на сердечко."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#16543C] px-6 py-3 text-xs font-extrabold text-white shadow-elevated hover:bg-[#113F2D] active:scale-95 transition-all"
              >
                <Building2 className="h-4 w-4" />
                <span>{locale === "uz" ? "Angren xaritasiga o‘tish" : "Перейти на карту Ангрена"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* Responsive Grid of Saved Properties */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {locale === "uz" ? "Barcha saqlanganlar" : "Все сохранённые"} ({favoriteProperties.length})
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {favoriteProperties.map((property) => (
                <div
                  key={property.id}
                  onClick={() => {
                    setSelectedProperty(property);
                    setIsDetailOpen(true);
                  }}
                  className="cursor-pointer"
                >
                  <PropertyCard property={property} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 4. Property Detail Modal */}
      <PropertyDetailModal
        property={selectedProperty}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      {/* 5. Footer */}
      <Footer />

      {/* 6. Mobile Navigation */}
      <MobileBottomNav />
    </div>
  );
}
