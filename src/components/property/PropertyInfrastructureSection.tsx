"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  Cross,
  ShoppingCart,
  Trees,
  Bus,
  Stethoscope,
  CreditCard,
  MapPin,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getInfrastructureAround } from "@/lib/infrastructureService";
import { POICategory, InfrastructureSummary } from "@/lib/types";

interface PropertyInfrastructureSectionProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export function PropertyInfrastructureSection({
  latitude,
  longitude,
  className = "",
}: PropertyInfrastructureSectionProps) {
  const { locale } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<POICategory | null>(null);

  const summaries = getInfrastructureAround(latitude, longitude, 3000, locale);

  const getCategoryIcon = (category: POICategory) => {
    switch (category) {
      case "school":
        return <GraduationCap className="h-4 w-4 text-blue-600" />;
      case "kindergarten":
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      case "hospital":
        return <Stethoscope className="h-4 w-4 text-rose-600" />;
      case "pharmacy":
        return <Cross className="h-4 w-4 text-emerald-600" />;
      case "supermarket":
        return <ShoppingCart className="h-4 w-4 text-purple-600" />;
      case "bus_stop":
        return <Bus className="h-4 w-4 text-cyan-600" />;
      case "park":
        return <Trees className="h-4 w-4 text-emerald-700" />;
      case "atm":
        return <CreditCard className="h-4 w-4 text-slate-700" />;
      default:
        return <MapPin className="h-4 w-4 text-slate-500" />;
    }
  };

  if (summaries.length === 0) {
    return (
      <div className={`p-4 rounded-2xl bg-slate-50 border border-slate-100 ${className}`}>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <Info className="h-4 w-4 text-slate-400" />
          <span>
            {locale === "uz"
              ? "Ushbu hudud bo‘yicha infratuzilma ma’lumotlari yangilanmoqda"
              : "Данные об инфраструктуре данного района обновляются"}
          </span>
        </div>
      </div>
    );
  }

  const activeSummary = selectedCategory
    ? summaries.find((s) => s.category === selectedCategory)
    : null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
          <span>{locale === "uz" ? "Atrofida" : "Рядом"}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#16543C]">
            {summaries.length} {locale === "uz" ? "yo‘nalish" : "категорий"}
          </span>
        </h3>
        <span className="text-[11px] text-slate-400">
          {locale === "uz" ? "Haqiqiy geolokatsiya masofalari" : "Точные гео-расстояния"}
        </span>
      </div>

      {/* Grid of Infrastructure Category Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {summaries.map((s) => {
          const isSelected = selectedCategory === s.category;
          return (
            <button
              key={s.category}
              type="button"
              onClick={() => setSelectedCategory(isSelected ? null : s.category)}
              className={`p-2.5 sm:p-3 rounded-2xl text-left border transition-all active:scale-[0.98] min-w-0 ${
                isSelected
                  ? "bg-emerald-50 border-emerald-400/80 shadow-xs ring-1 ring-emerald-400/40"
                  : "bg-white hover:bg-slate-50 border-slate-100 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 min-w-0">
                <div className="p-1.5 rounded-xl bg-slate-100/80 shrink-0">{getCategoryIcon(s.category)}</div>
                <span className="text-[10px] font-extrabold text-[#16543C] bg-emerald-100/70 px-1.5 py-0.5 rounded-md shrink-0">
                  {s.closestDistance}
                </span>
              </div>
              <div className="text-xs font-black text-slate-900 truncate">
                {locale === "uz" ? s.labelUz : s.labelRu}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                {s.count} {locale === "uz" ? "ta maskan" : "объекта"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded Category Items Breakdown */}
      {activeSummary && (
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 mt-2">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-xs font-black text-slate-800">
              {locale === "uz" ? activeSummary.labelUz : activeSummary.labelRu} ({activeSummary.count})
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
            >
              {locale === "uz" ? "Yopish" : "Скрыть"}
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {activeSummary.items.map((item) => (
              <div key={item.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700 truncate">
                  {locale === "uz" ? item.nameUz : item.nameRu}
                </span>
                <span className="font-black text-[#16543C] shrink-0 text-[11px]">
                  {item.formattedDistance}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
