"use client";

import React from "react";
import { X, RotateCcw, Check, SlidersHorizontal, Bed, Maximize2, Layers, Sparkles, Flame, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { RenovationType } from "@/lib/types";

export interface AdvancedFilterState {
  rooms: number | "all";
  minArea: number | "";
  maxArea: number | "";
  minFloor: number | "";
  maxFloor: number | "";
  renovation: RenovationType | "all";
  furniture: boolean | "all";
  utilities: {
    gas?: boolean;
    water?: boolean;
    electricity?: boolean;
    sewerage?: boolean;
    heating?: boolean;
  };
  amenities: {
    parking?: boolean;
    elevator?: boolean;
    ac?: boolean;
    internet?: boolean;
    balcony?: boolean;
  };
}

export const defaultAdvancedFilters: AdvancedFilterState = {
  rooms: "all",
  minArea: "",
  maxArea: "",
  minFloor: "",
  maxFloor: "",
  renovation: "all",
  furniture: "all",
  utilities: {},
  amenities: {},
};

interface AdvancedFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedFilterState;
  onChangeFilters: (filters: AdvancedFilterState) => void;
  onReset: () => void;
  totalFilteredCount: number;
}

export function AdvancedFiltersModal({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  onReset,
  totalFilteredCount,
}: AdvancedFiltersModalProps) {
  const { locale, t } = useLanguage();

  if (!isOpen) return null;

  const handleUtilityToggle = (key: keyof AdvancedFilterState["utilities"]) => {
    onChangeFilters({
      ...filters,
      utilities: {
        ...filters.utilities,
        [key]: !filters.utilities[key],
      },
    });
  };

  const handleAmenityToggle = (key: keyof AdvancedFilterState["amenities"]) => {
    onChangeFilters({
      ...filters,
      amenities: {
        ...filters.amenities,
        [key]: !filters.amenities[key],
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-white/95 backdrop-blur-2xl shadow-float border border-white/80 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-light text-brand-primary">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h2 className="text-base font-extrabold text-brand-dark">
              {locale === "uz" ? "Kengaytirilgan filtrlar" : "Расширенные фильтры"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Filters Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs divide-y divide-gray-100">
          {/* 1. Xonalar soni (Rooms) */}
          <div className="space-y-2.5 pt-1">
            <label className="font-extrabold text-gray-900 flex items-center gap-1.5 text-xs">
              <Bed className="h-3.5 w-3.5 text-brand-primary" />
              <span>{locale === "uz" ? "Xonalar soni" : "Количество комнат"}</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {(["all", 1, 2, 3, 4, 5] as const).map((r) => (
                <button
                  key={String(r)}
                  type="button"
                  onClick={() => onChangeFilters({ ...filters, rooms: r })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    filters.rooms === r
                      ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {r === "all" ? (locale === "uz" ? "Barchasi" : "Все") : `${r}${r === 5 ? "+" : ""}`}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Maydon (m²) */}
          <div className="space-y-2.5 pt-4">
            <label className="font-extrabold text-gray-900 flex items-center gap-1.5 text-xs">
              <Maximize2 className="h-3.5 w-3.5 text-brand-primary" />
              <span>{locale === "uz" ? "Maydoni (m²)" : "Площадь (м²)"}</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder={locale === "uz" ? "Min m² (masalan: 40)" : "От м² (напр.: 40)"}
                value={filters.minArea}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    minArea: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
              <input
                type="number"
                placeholder={locale === "uz" ? "Max m² (masalan: 120)" : "До м² (напр.: 120)"}
                value={filters.maxArea}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    maxArea: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>

          {/* 3. Qavat (Floor) */}
          <div className="space-y-2.5 pt-4">
            <label className="font-extrabold text-gray-900 flex items-center gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5 text-brand-primary" />
              <span>{locale === "uz" ? "Qavat" : "Этаж"}</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder={locale === "uz" ? "Min qavat (masalan: 1)" : "От этажа (напр.: 1)"}
                value={filters.minFloor}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    minFloor: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
              <input
                type="number"
                placeholder={locale === "uz" ? "Max qavat (masalan: 5)" : "До этажа (напр.: 5)"}
                value={filters.maxFloor}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    maxFloor: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>

          {/* 4. Ta'mir holati (Renovation) */}
          <div className="space-y-2.5 pt-4">
            <label className="font-extrabold text-gray-900 flex items-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
              <span>{locale === "uz" ? "Ta’mir holati" : "Состояние ремонта"}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "all", label: locale === "uz" ? "Barchasi" : "Все" },
                { key: "euro", label: locale === "uz" ? "Yevro" : "Евроремонт" },
                { key: "standard", label: locale === "uz" ? "O‘rtacha" : "Стандарт" },
                { key: "none", label: locale === "uz" ? "Ta’mirsiz" : "Без ремонта" },
              ].map((renov) => (
                <button
                  key={renov.key}
                  type="button"
                  onClick={() => onChangeFilters({ ...filters, renovation: renov.key as any })}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all truncate ${
                    filters.renovation === renov.key
                      ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {renov.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Mebel (Furniture) */}
          <div className="space-y-2.5 pt-4">
            <label className="font-extrabold text-gray-900 text-xs">
              {locale === "uz" ? "Mebel bilan ta’minlanganligi" : "Меблировка"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, furniture: "all" })}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  filters.furniture === "all"
                    ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {locale === "uz" ? "Farqi yo‘q" : "Не имеет значения"}
              </button>
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, furniture: true })}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  filters.furniture === true
                    ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {locale === "uz" ? "Faqat mebel bilan" : "Только с мебелью"}
              </button>
            </div>
          </div>

          {/* 6. Kommunikatsiyalar (Utilities) */}
          <div className="space-y-2.5 pt-4">
            <label className="font-extrabold text-gray-900 flex items-center gap-1.5 text-xs">
              <Flame className="h-3.5 w-3.5 text-brand-primary" />
              <span>{locale === "uz" ? "Kommunikatsiyalar" : "Коммуникации"}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: "gas", label: locale === "uz" ? "Gaz" : "Газ" },
                { key: "water", label: locale === "uz" ? "Suv" : "Вода" },
                { key: "electricity", label: locale === "uz" ? "Elektr" : "Электричество" },
                { key: "sewerage", label: locale === "uz" ? "Kanalizatsiya" : "Канализация" },
                { key: "heating", label: locale === "uz" ? "Isitish tizimi" : "Отопление" },
              ].map((u) => {
                const active = !!filters.utilities[u.key as keyof typeof filters.utilities];
                return (
                  <button
                    key={u.key}
                    type="button"
                    onClick={() => handleUtilityToggle(u.key as any)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      active
                        ? "bg-brand-light border-brand-primary text-brand-primary"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span>{u.label}</span>
                    {active && <Check className="h-3.5 w-3.5 text-brand-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Qulayliklar (Amenities) */}
          <div className="space-y-2.5 pt-4">
            <label className="font-extrabold text-gray-900 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
              <span>{locale === "uz" ? "Qulayliklar" : "Удобства"}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: "parking", label: locale === "uz" ? "Avtoturargoh" : "Парковка" },
                { key: "elevator", label: locale === "uz" ? "Lift" : "Лифт" },
                { key: "ac", label: locale === "uz" ? "Konditsioner" : "Кондиционер" },
                { key: "internet", label: locale === "uz" ? "Internet" : "Интернет" },
                { key: "balcony", label: locale === "uz" ? "Balkon" : "Балкон" },
              ].map((a) => {
                const active = !!filters.amenities[a.key as keyof typeof filters.amenities];
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => handleAmenityToggle(a.key as any)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      active
                        ? "bg-brand-light border-brand-primary text-brand-primary"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span>{a.label}</span>
                    {active && <Check className="h-3.5 w-3.5 text-brand-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50/80 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{locale === "uz" ? "Barchasini tozalash" : "Сбросить все"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-extrabold shadow-card transition-all active:scale-95"
          >
            {locale === "uz"
              ? `Natijalarni ko‘rish (${totalFilteredCount} ta)`
              : `Показать результаты (${totalFilteredCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
