"use client";

import React from "react";
import { Search, Map, Layers, SlidersHorizontal, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface MobileMapControlsProps {
  searchQuery: string;
  onOpenSearch: () => void;
  onClearSearch?: () => void;
  activeFiltersCount: number;
  activeView: "map" | "catalog";
  onViewChange: (view: "map" | "catalog") => void;
  totalCount: number;
  className?: string;
}

export function MobileMapControls({
  searchQuery,
  onOpenSearch,
  onClearSearch,
  activeFiltersCount,
  activeView,
  onViewChange,
  totalCount,
  className = "",
}: MobileMapControlsProps) {
  const { locale } = useLanguage();

  return (
    <div
      data-testid="mobile-map-controls"
      className={`sm:hidden absolute top-3 left-3 right-3 z-20 flex flex-col items-center gap-2 pointer-events-auto ${className}`}
    >
      {/* 1. Compact Elongated Search Pill [ 🔍 Mavze, ko‘cha yoki obyekt qidirish ] */}
      <div
        onClick={onOpenSearch}
        data-testid="mobile-search-pill"
        role="button"
        tabIndex={0}
        aria-label={locale === "uz" ? "Qidiruv va filtrlarni ochish" : "Открыть поиск и фильтры"}
        className="w-full flex items-center justify-between h-11 px-3.5 rounded-2xl bg-white/95 backdrop-blur-xl shadow-elevated border border-white/90 cursor-pointer active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Search className="h-4 w-4 text-[#16543C] shrink-0" />
          {searchQuery ? (
            <span className="text-xs font-bold text-slate-900 truncate">
              {searchQuery}
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-400 truncate">
              {locale === "uz"
                ? "Mavze, ko‘cha yoki obyekt qidirish..."
                : "Массив, улица или объект..."}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {searchQuery && onClearSearch && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearSearch();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label={locale === "uz" ? "Qidiruvni tozalash" : "Очистить поиск"}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {activeFiltersCount > 0 ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#16543C] text-white text-[10px] font-extrabold shadow-xs">
              <span>{activeFiltersCount}</span>
              <SlidersHorizontal className="h-2.5 w-2.5" />
            </span>
          ) : (
            <span className="p-1.5 rounded-xl bg-slate-100 text-slate-500">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>

      {/* 2. Permanent Segmented Control [ XARITA ] [ KATALOG ] */}
      <div
        data-testid="mobile-primary-view-switcher"
        className="flex items-center p-1 rounded-2xl bg-white/95 backdrop-blur-xl shadow-elevated border border-white/90 w-full max-w-[280px]"
      >
        <button
          type="button"
          data-testid="mobile-view-map"
          onClick={() => onViewChange("map")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all ${
            activeView === "map"
              ? "bg-[#16543C] text-white shadow-card"
              : "text-slate-600 hover:text-slate-900 active:bg-slate-100/60"
          }`}
        >
          <Map className="h-3.5 w-3.5" />
          <span>{locale === "uz" ? "XARITA" : "КАРТА"}</span>
        </button>

        <button
          type="button"
          data-testid="mobile-view-catalog"
          onClick={() => onViewChange("catalog")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all ${
            activeView === "catalog"
              ? "bg-[#16543C] text-white shadow-card"
              : "text-slate-600 hover:text-slate-900 active:bg-slate-100/60"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>{locale === "uz" ? "KATALOG" : "КАТАЛОГ"}</span>
          <span
            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
              activeView === "catalog"
                ? "bg-white text-[#16543C]"
                : "bg-emerald-100 text-[#16543C]"
            }`}
          >
            {totalCount}
          </span>
        </button>
      </div>
    </div>
  );
}