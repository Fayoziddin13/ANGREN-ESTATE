"use client";

import React, { useState, useEffect } from "react";
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
  Bookmark,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useSavedSearches } from "@/lib/savedSearchStore";
import { TransactionType, PropertyType, HududItem } from "@/lib/types";
import { DEFAULT_ANGREN_HUDUDS } from "@/lib/hududService";
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
  const { currency, exchangeRate } = useCurrency();
  const { saveSearch } = useSavedSearches();
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [isSavingSearch, setIsSavingSearch] = useState(false);

  const [hududList, setHududList] = useState<HududItem[]>(DEFAULT_ANGREN_HUDUDS);

  useEffect(() => {
    fetch("/api/hududs")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.hududs) && d.hududs.length > 0) {
          setHududList(d.hududs);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveCurrentSearch = async () => {
    setIsSavingSearch(true);
    try {
      let minPrice: number | undefined;
      let maxPrice: number | undefined;
      if (priceFilter === "under-300m") maxPrice = 300000000;
      else if (priceFilter === "300m-600m") {
        minPrice = 300000000;
        maxPrice = 600000000;
      } else if (priceFilter === "above-600m") minPrice = 600000000;

      const res = await saveSearch({
        query: searchQuery || undefined,
        transactionType,
        propertyType: selectedType,
        district: selectedDistrict,
        priceMin: minPrice,
        priceMax: maxPrice,
        rooms:
          advancedFilters?.rooms && advancedFilters.rooms !== "all"
            ? Number(advancedFilters.rooms)
            : undefined,
      });

      if (res.success) {
        alert(
          locale === "uz"
            ? "Qidiruv muvaffaqiyatli saqlandi! Mos yangi e’lonlar haqida bildirishnoma olasiz."
            : "Поиск успешно сохранён! Вы получите уведомление о новых объектах."
        );
      }
    } finally {
      setIsSavingSearch(false);
    }
  };

  const [districtOpen, setDistrictOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const districts = [
    { key: "all", label: t.mapSection.allDistricts },
    ...hududList.map((h) => ({
      key: h.name_uz,
      label: locale === "uz" ? h.name_uz : h.name_ru,
    })),
  ];

  const propertyTypes: Array<{ key: PropertyType | "all"; label: string }> = [
    { key: "all", label: t.searchBar.allTypes },
    { key: "apartment", label: t.searchBar.apartment },
    { key: "house_yard", label: t.searchBar.house },
    { key: "new_build", label: t.searchBar.newBuild },
    { key: "commercial", label: t.searchBar.commercial },
    { key: "land", label: t.searchBar.land },
    { key: "other", label: locale === "uz" ? "Boshqa" : "Другое" },
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
    if (advancedFilters?.minPrice || advancedFilters?.maxPrice) {
      const min = advancedFilters.minPrice
        ? Math.round(Number(advancedFilters.minPrice) / (currency === "USD" ? exchangeRate : 1000000))
        : "";
      const max = advancedFilters.maxPrice
        ? Math.round(Number(advancedFilters.maxPrice) / (currency === "USD" ? exchangeRate : 1000000))
        : "";
      const unit = currency === "USD" ? "$" : locale === "uz" ? "mln" : "млн";
      if (min && max) return `${min} - ${max} ${unit}`;
      if (min) return `> ${min} ${unit}`;
      if (max) return `< ${max} ${unit}`;
    }
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
                <span className="px-2.5 py-0.5 rounded-full bg-[#eaf5f0]/50 border border-[#2db477]/40 text-[#167d4f] text-xs font-bold">
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
                        ? "bg-[#167d4f] text-white shadow-sm"
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
                        ? "bg-[#167d4f] text-white shadow-sm"
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
                        ? "bg-[#167d4f] text-white shadow-sm"
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
                <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus-within:border-[#167d4f] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#167d4f]/20 transition-all">
                  <Search className="h-4 w-4 text-[#167d4f] shrink-0" />
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
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:border-[#167d4f]/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="h-4 w-4 text-[#167d4f] shrink-0" />
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
                              ? "bg-[#eaf5f0]/50 text-[#167d4f] font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{d.label}</span>
                          {selectedDistrict === d.key && (
                            <Check className="h-4 w-4 text-[#167d4f]" />
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
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:border-[#167d4f]/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Home className="h-4 w-4 text-[#167d4f] shrink-0" />
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
                              ? "bg-[#eaf5f0]/50 text-[#167d4f] font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{pt.label}</span>
                          {selectedType === pt.key && (
                            <Check className="h-4 w-4 text-[#167d4f]" />
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
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:border-[#167d4f]/40 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Coins className="h-4 w-4 text-[#167d4f] shrink-0" />
                      <span className="truncate">{getPriceLabel()}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform ${
                        priceOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {priceOpen && (
                    <div className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg space-y-1.5 animate-in fade-in">
                      {priceOptions.map((po) => (
                        <button
                          key={po.key}
                          type="button"
                          onClick={() => {
                            onPriceFilterChange(po.key);
                            onAdvancedFiltersChange({ ...advancedFilters, minPrice: "", maxPrice: "" });
                            setPriceOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                            priceFilter === po.key && !advancedFilters.minPrice && !advancedFilters.maxPrice
                              ? "bg-[#eaf5f0]/50 text-[#167d4f] font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{po.label}</span>
                          {priceFilter === po.key && !advancedFilters.minPrice && !advancedFilters.maxPrice && (
                            <Check className="h-4 w-4 text-[#167d4f]" />
                          )}
                        </button>
                      ))}

                      <div className="pt-2 mt-1 border-t border-slate-100 px-1 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span>{locale === "uz" ? "Aniq narx kiritish" : "Точная цена"}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{currency === "USD" ? "$ USD" : (locale === "uz" ? "so‘m (UZS)" : "сум (UZS)")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder={currency === "USD" ? "Min $" : "Min so‘m"}
                            value={
                              advancedFilters.minPrice !== ""
                                ? currency === "USD"
                                  ? Math.round(Number(advancedFilters.minPrice) / exchangeRate)
                                  : advancedFilters.minPrice
                                : ""
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              const inUzs = val ? (currency === "USD" ? Math.round(Number(val) * exchangeRate) : Number(val)) : "";
                              onPriceFilterChange("custom");
                              onAdvancedFiltersChange({ ...advancedFilters, minPrice: inUzs });
                            }}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#167d4f]"
                          />
                          <input
                            type="number"
                            placeholder={currency === "USD" ? "Max $" : "Max so‘m"}
                            value={
                              advancedFilters.maxPrice !== ""
                                ? currency === "USD"
                                  ? Math.round(Number(advancedFilters.maxPrice) / exchangeRate)
                                  : advancedFilters.maxPrice
                                : ""
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              const inUzs = val ? (currency === "USD" ? Math.round(Number(val) * exchangeRate) : Number(val)) : "";
                              onPriceFilterChange("custom");
                              onAdvancedFiltersChange({ ...advancedFilters, maxPrice: inUzs });
                            }}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#167d4f]"
                          />
                        </div>
                      </div>
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
                      ? "bg-[#eaf5f0]/50 border-[#2db477] text-[#167d4f]"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-[#167d4f]" />
                    <span>
                      {locale === "uz" ? "Kengaytirilgan filtrlar" : "Расширенные фильтры"}
                    </span>
                  </div>
                  {activeAdvancedCount > 0 ? (
                    <span className="flex h-5 px-2 items-center justify-center rounded-full bg-[#167d4f] text-[10px] text-white font-extrabold">
                      {activeAdvancedCount}
                    </span>
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Save Search Button */}
            <div className="px-5 pb-3">
              <button
                type="button"
                onClick={handleSaveCurrentSearch}
                disabled={isSavingSearch}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl border border-[#2db477]/60 bg-[#eaf5f0]/40 text-[#167d4f] text-xs font-bold hover:bg-[#eaf5f0]/70 transition-all active:scale-[0.98]"
              >
                <Bookmark className="h-4 w-4" />
                <span>{locale === "uz" ? "Ushbu qidiruvni saqlash" : "Сохранить параметры поиска"}</span>
              </button>
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
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-[#167d4f] hover:bg-[#167d4f] text-white text-xs font-extrabold shadow-md active:scale-[0.98] transition-all"
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
