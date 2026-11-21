"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw, Check, SlidersHorizontal, Bed, Maximize2, Layers, Sparkles, Flame, ShieldCheck, Sofa } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { RenovationType } from "@/lib/types";

import { Coins } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";

export interface AdvancedFilterState {
  rooms: number | "all";
  minArea: number | "";
  maxArea: number | "";
  minPrice: number | "";
  maxPrice: number | "";
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
  minPrice: "",
  maxPrice: "",
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

// Shared look of the modal controls (compact, one height everywhere).
const INPUT_CLS =
  "w-full h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25";
const CHIP_BASE =
  "h-8 px-2 rounded-xl text-[11.5px] font-bold border transition-colors truncate";
const CHIP_ON = "bg-brand-primary text-white border-brand-primary shadow-sm";
const CHIP_OFF = "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";
const TOGGLE_BASE =
  "flex h-8 items-center justify-between gap-1 px-2.5 rounded-xl border text-[11.5px] font-bold transition-colors min-w-0";
const TOGGLE_ON = "bg-brand-light border-brand-primary text-brand-primary";
const TOGGLE_OFF = "bg-white text-gray-600 border-gray-200 hover:bg-gray-50";

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-gray-900">
      {icon}
      <span className="truncate">{children}</span>
    </div>
  );
}

export function AdvancedFiltersModal({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  onReset,
  totalFilteredCount,
}: AdvancedFiltersModalProps) {
  const { locale } = useLanguage();
  const { currency, exchangeRate } = useCurrency();
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  // While open: lock page scroll behind the dialog and close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

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

  const titleId = "advanced-filters-title";

  // Rendered into <body>: the search panels use backdrop-filter / transforms,
  // which would otherwise become the containing block of this fixed overlay
  // and squeeze it into the toolbar.
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[min(88dvh,760px)] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white border border-white/80 shadow-[0_24px_60px_-12px_rgba(15,60,40,0.35)] overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand-primary">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <h2 id={titleId} className="truncate text-base font-extrabold text-brand-dark">
              {locale === "uz" ? "Kengaytirilgan filtrlar" : "Расширенные фильтры"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={locale === "uz" ? "Yopish" : "Закрыть"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters body: two columns from md, scrolls only when the screen is too short */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs">
          {/* Narx oralig'i (Min / Max Custom Price) */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-900 min-w-0">
                <Coins className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                <span className="truncate">{locale === "uz" ? `Narx oralig‘i (${currency})` : `Диапазон цен (${currency})`}</span>
              </div>
              <span className="shrink-0 text-[10px] text-gray-400 font-medium">
                {currency === "USD" ? "$ USD" : (locale === "uz" ? "so‘m (UZS)" : "сум (UZS)")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="numeric"
                aria-label={locale === "uz" ? "Minimal narx" : "Минимальная цена"}
                placeholder={
                  currency === "USD"
                    ? locale === "uz" ? "Min $ (masalan: 20000)" : "От $ (напр.: 20000)"
                    : locale === "uz" ? "Min so‘m (masalan: 250000000)" : "От сум (напр.: 250000000)"
                }
                value={
                  filters.minPrice !== ""
                    ? currency === "USD"
                      ? Math.round(Number(filters.minPrice) / exchangeRate)
                      : filters.minPrice
                    : ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    onChangeFilters({ ...filters, minPrice: "" });
                  } else {
                    const num = Number(val);
                    const inUzs = currency === "USD" ? Math.round(num * exchangeRate) : num;
                    onChangeFilters({ ...filters, minPrice: inUzs });
                  }
                }}
                className={INPUT_CLS}
              />
              <input
                type="number"
                inputMode="numeric"
                aria-label={locale === "uz" ? "Maksimal narx" : "Максимальная цена"}
                placeholder={
                  currency === "USD"
                    ? locale === "uz" ? "Max $ (masalan: 60000)" : "До $ (напр.: 60000)"
                    : locale === "uz" ? "Max so‘m (masalan: 700000000)" : "До сум (напр.: 700000000)"
                }
                value={
                  filters.maxPrice !== ""
                    ? currency === "USD"
                      ? Math.round(Number(filters.maxPrice) / exchangeRate)
                      : filters.maxPrice
                    : ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    onChangeFilters({ ...filters, maxPrice: "" });
                  } else {
                    const num = Number(val);
                    const inUzs = currency === "USD" ? Math.round(num * exchangeRate) : num;
                    onChangeFilters({ ...filters, maxPrice: inUzs });
                  }
                }}
                className={INPUT_CLS}
              />
            </div>
          </section>

          {/* 1. Xonalar soni (Rooms) */}
          <section>
            <SectionLabel icon={<Bed className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}>
              {locale === "uz" ? "Xonalar soni" : "Количество комнат"}
            </SectionLabel>
            <div className="grid grid-cols-6 gap-1.5">
              {(["all", 1, 2, 3, 4, 5] as const).map((r) => (
                <button
                  key={String(r)}
                  type="button"
                  onClick={() => onChangeFilters({ ...filters, rooms: r })}
                  className={`${CHIP_BASE} ${filters.rooms === r ? CHIP_ON : CHIP_OFF}`}
                >
                  {r === "all" ? (locale === "uz" ? "Barchasi" : "Все") : `${r}${r === 5 ? "+" : ""}`}
                </button>
              ))}
            </div>
          </section>

          {/* 2. Maydon (m²) */}
          <section>
            <SectionLabel icon={<Maximize2 className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}>
              {locale === "uz" ? "Maydoni (m²)" : "Площадь (м²)"}
            </SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="numeric"
                aria-label={locale === "uz" ? "Minimal maydon" : "Минимальная площадь"}
                placeholder={locale === "uz" ? "Min m² (masalan: 40)" : "От м² (напр.: 40)"}
                value={filters.minArea}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    minArea: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className={INPUT_CLS}
              />
              <input
                type="number"
                inputMode="numeric"
                aria-label={locale === "uz" ? "Maksimal maydon" : "Максимальная площадь"}
                placeholder={locale === "uz" ? "Max m² (masalan: 120)" : "До м² (напр.: 120)"}
                value={filters.maxArea}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    maxArea: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className={INPUT_CLS}
              />
            </div>
          </section>

          {/* 3. Qavat (Floor) */}
          <section>
            <SectionLabel icon={<Layers className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}>
              {locale === "uz" ? "Qavat" : "Этаж"}
            </SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="numeric"
                aria-label={locale === "uz" ? "Minimal qavat" : "Минимальный этаж"}
                placeholder={locale === "uz" ? "Min qavat (masalan: 1)" : "От этажа (напр.: 1)"}
                value={filters.minFloor}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    minFloor: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className={INPUT_CLS}
              />
              <input
                type="number"
                inputMode="numeric"
                aria-label={locale === "uz" ? "Maksimal qavat" : "Максимальный этаж"}
                placeholder={locale === "uz" ? "Max qavat (masalan: 5)" : "До этажа (напр.: 5)"}
                value={filters.maxFloor}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    maxFloor: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className={INPUT_CLS}
              />
            </div>
          </section>

          {/* 4. Ta'mir holati (Renovation) */}
          <section>
            <SectionLabel icon={<Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}>
              {locale === "uz" ? "Ta’mir holati" : "Состояние ремонта"}
            </SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: "all", label: locale === "uz" ? "Barchasi" : "Все" },
                { key: "euro", label: locale === "uz" ? "Yevro" : "Евроремонт" },
                { key: "standard", label: locale === "uz" ? "O‘rtacha" : "Стандарт" },
                { key: "none", label: locale === "uz" ? "Ta’mirsiz" : "Без ремонта" },
              ].map((renov) => (
                <button
                  key={renov.key}
                  type="button"
                  title={renov.label}
                  onClick={() => onChangeFilters({ ...filters, renovation: renov.key as any })}
                  className={`${CHIP_BASE} ${filters.renovation === renov.key ? CHIP_ON : CHIP_OFF}`}
                >
                  {renov.label}
                </button>
              ))}
            </div>
          </section>

          {/* 5. Mebel (Furniture) */}
          <section>
            <SectionLabel icon={<Sofa className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}>
              {locale === "uz" ? "Mebel bilan ta’minlanganligi" : "Меблировка"}
            </SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, furniture: "all" })}
                className={`${CHIP_BASE} ${filters.furniture === "all" ? CHIP_ON : CHIP_OFF}`}
              >
                {locale === "uz" ? "Farqi yo‘q" : "Не имеет значения"}
              </button>
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, furniture: true })}
                className={`${CHIP_BASE} ${filters.furniture === true ? CHIP_ON : CHIP_OFF}`}
              >
                {locale === "uz" ? "Faqat mebel bilan" : "Только с мебелью"}
              </button>
            </div>
          </section>

          {/* 6. Kommunikatsiyalar (Utilities) */}
          <section>
            <SectionLabel icon={<Flame className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}>
              {locale === "uz" ? "Kommunikatsiyalar" : "Коммуникации"}
            </SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
                    title={u.label}
                    aria-pressed={active}
                    onClick={() => handleUtilityToggle(u.key as any)}
                    className={`${TOGGLE_BASE} ${active ? TOGGLE_ON : TOGGLE_OFF}`}
                  >
                    <span className="truncate">{u.label}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 7. Qulayliklar (Amenities) */}
          <section>
            <SectionLabel icon={<ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}>
              {locale === "uz" ? "Qulayliklar" : "Удобства"}
            </SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
                    title={a.label}
                    aria-pressed={active}
                    onClick={() => handleAmenityToggle(a.key as any)}
                    className={`${TOGGLE_BASE} ${active ? TOGGLE_ON : TOGGLE_OFF}`}
                  >
                    <span className="truncate">{a.label}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer Actions: always visible, outside the scroll area */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gray-50/90 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{locale === "uz" ? "Barchasini tozalash" : "Сбросить все"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-w-0 truncate px-5 sm:px-6 h-10 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-extrabold shadow-card transition-all active:scale-95"
          >
            {locale === "uz"
              ? `Natijalarni ko‘rish (${totalFilteredCount} ta)`
              : `Показать результаты (${totalFilteredCount})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
