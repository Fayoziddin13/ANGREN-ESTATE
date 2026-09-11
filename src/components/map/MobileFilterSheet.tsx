"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  MapPin,
  Home,
  Coins,
  ChevronDown,
  RotateCcw,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { TransactionType, PropertyType } from "@/lib/types";
import {
  AdvancedFiltersModal,
  AdvancedFilterState,
  defaultAdvancedFilters,
} from "./AdvancedFiltersModal";

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  transactionType: TransactionType | "all";
  onTransactionChange: (type: TransactionType | "all") => void;
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
  selectedType: PropertyType | "all";
  onTypeChange: (type: PropertyType | "all") => void;
  priceFilter: string;
  onPriceFilterChange: (price: string) => void;
  onReset: () => void;
  totalCount: number;
  advancedFilters: AdvancedFilterState;
  onAdvancedFiltersChange: (filters: AdvancedFilterState) => void;
  onResetAdvanced: () => void;
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  searchQuery,
  onSearchQueryChange,
  transactionType,
  onTransactionChange,
  selectedDistrict,
  onDistrictChange,
  selectedType,
  onTypeChange,
  priceFilter,
  onPriceFilterChange,
  onReset,
  totalCount,
  advancedFilters,
  onAdvancedFiltersChange,
  onResetAdvanced,
}: MobileFilterSheetProps) {
  const { locale, t } = useLanguage();
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);

  const [districtOpen, setDistrictOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const districts = [
    { key: "all", label: t.mapSection.allDistricts },
    { key: "Markaz", label: "Markaz" },
    { key: "5-mavze", label: "5-mavze" },
    { key: "6-mavze", label: "6-mavze" },
    { key: "7-mavze", label: "7-mavze" },
    { key: "Dukent", label: "Dukent" },
    { key: "Geolog", label: "Geolog" },
  ];

  const propertyTypes: Array<{ key: PropertyType | "all"; label: string }> = [
    { key: "all", label: t.searchBar.allTypes },
    { key: "apartment", label: t.searchBar.apartment },
    { key: "house_yard", label: t.searchBar.house },
    { key: "new_build", label: t.searchBar.newBuild },
    { key: "commercial", label: t.searchBar.commercial },
    { key: "land", label: t.searchBar.land },
  ];

  const priceOptions = [
    { key: "all", label: t.searchBar.priceAny },
    { key: "under300m", label: t.searchBar.priceUnder300m },
    { key: "300to600m", label: t.searchBar.price300to600m },
    { key: "over600m", label: t.searchBar.priceOver600m },
  ];

  const getDistrictLabel = () => {
    const found = districts.find((d) => d.key === selectedDistrict);
    return found ? found.label : t.mapSection.allDistricts;
  };

  const getTypeLabel = () => {
    const found = propertyTypes.find((pt) => pt.key === selectedType);
    return found ? found.label : t.searchBar.allTypes;
  };

  const getPriceLabel = () => {
    const found = priceOptions.find((po) => po.key === priceFilter);
    return found ? found.label : t.searchBar.priceAny;
  };

  const activeAdvancedCount = [
    advancedFilters.rooms !== "all",
    advancedFilters.minArea !== "" || advancedFilters.maxArea !== "",
    advancedFilters.minFloor !== "" || advancedFilters.maxFloor !== "",
    advancedFilters.renovation !== "all",
    advancedFilters.furniture !== "all",
    ...Object.values(advancedFilters.utilities || {}),
    ...Object.values(advancedFilters.amenities || {}),
  ].filter(Boolean).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Bottom Sheet Card */}
          <motion.div
            data-testid="mobile-filter-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-10 w-full bg-white rounded-t-[28px] shadow-2xl border-t border-slate-200/80 flex flex-col max-h-[85vh] overflow-hidden"
          >
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  {locale === "uz" ? "Qidiruv va filtrlar" : "Поиск и фильтры"}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[#16543C] text-xs font-bold">
                  {totalCount} {locale === "uz" ? "obyekt" : "объектов"}
                </span>
              </div>
              <button
                type="button"
                data-testid="mobile-filter-close-btn"
                onClick={onClose}
                aria-label="Yopish"
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Filters Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 1. Transaction Type Segmented Control */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {locale === "uz" ? "Bitim turi" : "Тип сделки"}
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/60">
                  <button
                    type="button"
                    data-testid="mobile-filter-tab-all"
                    onClick={() => onTransactionChange("all")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      transactionType === "all"
                        ? "bg-[#16543C] text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t.common.all}
                  </button>
                  <button
                    type="button"
                    data-testid="mobile-filter-tab-sale"
                    onClick={() => onTransactionChange("sale")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      transactionType === "sale"
                        ? "bg-[#16543C] text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t.popular.saleBadge}
                  </button>
                  <button
                    type="button"
                    data-testid="mobile-filter-tab-rent"
                    onClick={() => onTransactionChange("rent")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      transactionType === "rent"
                        ? "bg-[#16543C] text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t.popular.rentBadge}
                  </button>
                </div>
              </div>

              {/* 2. Text Search Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {locale === "uz" ? "Kalit so‘z bo‘yicha qidirish" : "Поиск по ключевым словам"}
                </label>
                <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus-within:border-[#16543C] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#16543C]/20 transition-all">
                  <Search className="h-4 w-4 text-[#16543C] shrink-0" />
                  <input
                    type="text"
                    data-testid="mobile-filter-search-input"
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    placeholder={
                      locale === "uz"
                        ? "Daha, ko‘cha yoki e’lon nomi..."
                        : "Массив, улица или название..."
                    }
                    className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => onSearchQueryChange("")}
                      className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 3. District Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {locale === "uz" ? "Hudud (Daha / Tuman)" : "Район / Массив"}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    data-testid="mobile-filter-district-trigger"
                    onClick={() => {
                      setDistrictOpen(!districtOpen);
                      setTypeOpen(false);
                      setPriceOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:border-[#16543C]/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="h-4 w-4 text-[#16543C] shrink-0" />
                      <span className="truncate">{getDistrictLabel()}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${
                        districtOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {districtOpen && (
                    <div className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg space-y-0.5 animate-in fade-in">
                      {districts.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            onDistrictChange(d.key);
                            setDistrictOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                            selectedDistrict === d.key
                              ? "bg-emerald-50 text-[#16543C] font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{d.label}</span>
                          {selectedDistrict === d.key && (
                            <Check className="h-4 w-4 text-[#16543C]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Property Type Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {locale === "uz" ? "Mulk turi" : "Тип недвижимости"}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    data-testid="mobile-filter-type-trigger"
                    onClick={() => {
                      setTypeOpen(!typeOpen);
                      setDistrictOpen(false);
                      setPriceOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:border-[#16543C]/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Home className="h-4 w-4 text-[#16543C] shrink-0" />
                      <span className="truncate">{getTypeLabel()}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${
                        typeOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {typeOpen && (
                    <div className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg space-y-0.5 animate-in fade-in">
                      {propertyTypes.map((pt) => (
                        <button
                          key={pt.key}
                          type="button"
                          onClick={() => {
                            onTypeChange(pt.key);
                            setTypeOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                            selectedType === pt.key
                              ? "bg-emerald-50 text-[#16543C] font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{pt.label}</span>
                          {selectedType === pt.key && (
                            <Check className="h-4 w-4 text-[#16543C]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Price Filter Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {locale === "uz" ? "Narx oralig‘i" : "Ценовой диапазон"}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    data-testid="mobile-filter-price-trigger"
                    onClick={() => {
                      setPriceOpen(!priceOpen);
                      setDistrictOpen(false);
                      setTypeOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:border-[#16543C]/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Coins className="h-4 w-4 text-[#16543C] shrink-0" />
                      <span className="truncate">{getPriceLabel()}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${
                        priceOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {priceOpen && (
                    <div className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg space-y-0.5 animate-in fade-in">
                      {priceOptions.map((po) => (
                        <button
                          key={po.key}
                          type="button"
                          onClick={() => {
                            onPriceFilterChange(po.key);
                            setPriceOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                            priceFilter === po.key
                              ? "bg-emerald-50 text-[#16543C] font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{po.label}</span>
                          {priceFilter === po.key && (
                            <Check className="h-4 w-4 text-[#16543C]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Advanced Filters Trigger */}
              <div className="pt-1">
                <button
                  type="button"
                  data-testid="mobile-filter-advanced-trigger"
                  onClick={() => setIsAdvancedModalOpen(true)}
                  className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold border transition-all ${
                    activeAdvancedCount > 0
                      ? "bg-emerald-50 border-emerald-300 text-[#16543C]"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-[#16543C]" />
                    <span>
                      {locale === "uz" ? "Kengaytirilgan filtrlar" : "Расширенные фильтры"}
                    </span>
                  </div>
                  {activeAdvancedCount > 0 ? (
                    <span className="flex h-5 px-2 items-center justify-center rounded-full bg-[#16543C] text-[10px] text-white font-extrabold">
                      {activeAdvancedCount}
                    </span>
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Sticky Sheet Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center gap-3 shrink-0">
              <button
                type="button"
                data-testid="mobile-filter-reset-btn"
                onClick={onReset}
                title={t.filters.reset}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors shadow-sm active:scale-95"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>{locale === "uz" ? "Tozalash" : "Сброс"}</span>
              </button>

              <button
                type="button"
                data-testid="mobile-filter-apply-btn"
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-[#16543C] hover:bg-[#0E3324] text-white text-xs font-extrabold shadow-md active:scale-[0.98] transition-all"
              >
                <span>
                  {locale === "uz" ? "Natijalarni ko‘rish" : "Показать результаты"}
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
                  {totalCount}
                </span>
              </button>
            </div>
          </motion.div>

          {/* Reused Advanced Filters Modal */}
          <AdvancedFiltersModal
            isOpen={isAdvancedModalOpen}
            onClose={() => setIsAdvancedModalOpen(false)}
            filters={advancedFilters}
            onChangeFilters={onAdvancedFiltersChange}
            onReset={onResetAdvanced || (() => onAdvancedFiltersChange(defaultAdvancedFilters))}
            totalFilteredCount={totalCount}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
