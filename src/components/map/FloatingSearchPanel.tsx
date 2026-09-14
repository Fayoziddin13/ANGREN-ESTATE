"use client";

import React, { useState } from "react";
import { MapPin, Home, Coins, ChevronDown, RotateCcw, Check, Search, X, SlidersHorizontal, Bookmark } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useSavedSearches } from "@/lib/savedSearchStore";
import { TransactionType, PropertyType } from "@/lib/types";
import { AdvancedFiltersModal, AdvancedFilterState, defaultAdvancedFilters } from "./AdvancedFiltersModal";

interface FloatingSearchPanelProps {
  transactionType: TransactionType | "all";
  onTransactionChange: (type: TransactionType | "all") => void;
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
  selectedType: PropertyType | "all";
  onTypeChange: (type: PropertyType | "all") => void;
  priceFilter: string;
  onPriceFilterChange: (filter: string) => void;
  onReset: () => void;
  totalCount: number;
  className?: string;
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  advancedFilters?: AdvancedFilterState;
  onAdvancedFiltersChange?: (filters: AdvancedFilterState) => void;
  onResetAdvanced?: () => void;
}

export function FloatingSearchPanel({
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
  className = "",
  isMobileDrawerOpen = false,
  onCloseMobileDrawer,
  searchQuery = "",
  onSearchQueryChange,
  advancedFilters,
  onAdvancedFiltersChange,
  onResetAdvanced,
}: FloatingSearchPanelProps) {
  const { locale, t } = useLanguage();
  const { currency } = useCurrency();
  const { saveSearch } = useSavedSearches();

  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [isSavingSearch, setIsSavingSearch] = useState(false);

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

  return (
    <div
      className={`pointer-events-auto rounded-2xl bg-white/85 backdrop-blur-xl p-2.5 sm:p-3 shadow-elevated border border-white/80 transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Transaction Pill Switcher: [ Barchasi | Sotuv | Ijara ] */}
        <div className="flex items-center rounded-xl bg-gray-100/90 p-1 shrink-0 border border-gray-200/50">
          <button
            onClick={() => onTransactionChange("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              transactionType === "all"
                ? "bg-brand-primary text-white shadow-card"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.common.all}
          </button>
          <button
            onClick={() => onTransactionChange("sale")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              transactionType === "sale"
                ? "bg-brand-primary text-white shadow-card"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.popular.saleBadge}
          </button>
          <button
            onClick={() => onTransactionChange("rent")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              transactionType === "rent"
                ? "bg-brand-primary text-white shadow-card"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.popular.rentBadge}
          </button>
        </div>

        {/* Separator on desktop */}
        <div className="hidden sm:block h-6 w-[1px] bg-gray-200" />

        {/* Text Search Input */}
        {onSearchQueryChange && (
          <div className="relative flex-1 min-w-[120px] max-w-[170px]">
            <div className="flex w-full items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-800 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition-all">
              <Search className="h-3.5 w-3.5 text-brand-primary shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder={locale === "uz" ? "Daha, ko‘cha yoki nom..." : "Массив, улица или название..."}
                className="w-full bg-transparent text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange("")}
                  className="p-0.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Dropdown 1: District */}
        <div className="relative flex-1 min-w-[100px] max-w-[140px]">
          <button
            onClick={() => {
              setDistrictOpen(!districtOpen);
              setTypeOpen(false);
              setPriceOpen(false);
            }}
            className="flex w-full items-center justify-between gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-800 hover:border-brand-primary/40 hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-brand-primary shrink-0" />
              <span className="truncate">{getDistrictLabel()}</span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                districtOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {districtOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-48 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl p-1.5 shadow-elevated z-50 animate-in fade-in">
              {districts.map((d) => (
                <button
                  key={d.key}
                  onClick={() => {
                    onDistrictChange(d.key);
                    setDistrictOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                    selectedDistrict === d.key
                      ? "bg-brand-light text-brand-primary"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{d.label}</span>
                  {selectedDistrict === d.key && (
                    <Check className="h-3.5 w-3.5 text-brand-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dropdown 2: Property Type */}
        <div className="relative flex-1 min-w-[100px] max-w-[140px]">
          <button
            onClick={() => {
              setTypeOpen(!typeOpen);
              setDistrictOpen(false);
              setPriceOpen(false);
            }}
            className="flex w-full items-center justify-between gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-800 hover:border-brand-primary/40 hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Home className="h-3.5 w-3.5 text-brand-primary shrink-0" />
              <span className="truncate">{getTypeLabel()}</span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                typeOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {typeOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-52 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl p-1.5 shadow-elevated z-50 animate-in fade-in">
              {propertyTypes.map((pt) => (
                <button
                  key={pt.key}
                  onClick={() => {
                    onTypeChange(pt.key);
                    setTypeOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                    selectedType === pt.key
                      ? "bg-brand-light text-brand-primary"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{pt.label}</span>
                  {selectedType === pt.key && (
                    <Check className="h-3.5 w-3.5 text-brand-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dropdown 3: Price */}
        <div className="relative flex-1 min-w-[100px] max-w-[130px]">
          <button
            onClick={() => {
              setPriceOpen(!priceOpen);
              setDistrictOpen(false);
              setTypeOpen(false);
            }}
            className="flex w-full items-center justify-between gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-800 hover:border-brand-primary/40 hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Coins className="h-3.5 w-3.5 text-brand-primary shrink-0" />
              <span className="truncate">{getPriceLabel()}</span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                priceOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {priceOpen && (
            <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 w-56 rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl p-1.5 shadow-elevated z-50 animate-in fade-in">
              {priceOptions.map((po) => (
                <button
                  key={po.key}
                  onClick={() => {
                    onPriceFilterChange(po.key);
                    setPriceOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                    priceFilter === po.key
                      ? "bg-brand-light text-brand-primary"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{po.label}</span>
                  {priceFilter === po.key && (
                    <Check className="h-3.5 w-3.5 text-brand-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action / Reset Button & Live Count Badge */}
        <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0 pt-1 sm:pt-0">
          {/* Redundant on laptop screens since catalog switcher shows totalCount */}
          <div className="flex sm:hidden 2xl:flex items-center gap-1.5 rounded-xl bg-brand-light px-3 py-2 text-xs font-bold text-brand-primary">
            <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" />
            <span>{totalCount} {locale === "uz" ? "obyekt" : "объектов"}</span>
          </div>

          {advancedFilters && onAdvancedFiltersChange && (
            <button
              onClick={() => setIsAdvancedModalOpen(true)}
              title={locale === "uz" ? "Kengaytirilgan filtrlar" : "Расширенные фильтры"}
              className={`relative flex items-center gap-1.5 h-8 px-2.5 rounded-xl border transition-colors shadow-sm text-xs font-bold ${
                (advancedFilters.rooms !== "all" ||
                  advancedFilters.minArea !== "" ||
                  advancedFilters.maxArea !== "" ||
                  advancedFilters.minFloor !== "" ||
                  advancedFilters.maxFloor !== "" ||
                  advancedFilters.renovation !== "all" ||
                  advancedFilters.furniture !== "all" ||
                  Object.values(advancedFilters.utilities || {}).some(Boolean) ||
                  Object.values(advancedFilters.amenities || {}).some(Boolean))
                  ? "border-brand-primary bg-brand-light text-brand-primary"
                  : "border-gray-200/80 bg-white/90 text-gray-700 hover:text-brand-primary hover:border-brand-primary/40 hover:bg-white"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{locale === "uz" ? "Filtrlar" : "Фильтры"}</span>
              {(advancedFilters.rooms !== "all" ||
                advancedFilters.minArea !== "" ||
                advancedFilters.maxArea !== "" ||
                advancedFilters.minFloor !== "" ||
                advancedFilters.maxFloor !== "" ||
                advancedFilters.renovation !== "all" ||
                advancedFilters.furniture !== "all" ||
                Object.values(advancedFilters.utilities || {}).some(Boolean) ||
                Object.values(advancedFilters.amenities || {}).some(Boolean)) && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-extrabold text-white">
                  {[
                    advancedFilters.rooms !== "all",
                    advancedFilters.minArea !== "" || advancedFilters.maxArea !== "",
                    advancedFilters.minFloor !== "" || advancedFilters.maxFloor !== "",
                    advancedFilters.renovation !== "all",
                    advancedFilters.furniture !== "all",
                    ...Object.values(advancedFilters.utilities || {}),
                    ...Object.values(advancedFilters.amenities || {}),
                  ].filter(Boolean).length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveCurrentSearch}
            disabled={isSavingSearch}
            title={locale === "uz" ? "Qidiruvni saqlash" : "Сохранить поиск"}
            className="flex h-8 px-2.5 items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 text-gray-700 hover:text-brand-primary hover:border-brand-primary/40 hover:bg-white transition-colors shadow-sm text-xs font-bold"
          >
            <Bookmark className="h-3.5 w-3.5 text-[#16543C]" />
            <span className="hidden lg:inline">{locale === "uz" ? "Saqlash" : "Сохранить"}</span>
          </button>

          <button
            onClick={onReset}
            title={t.filters.reset}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200/80 bg-white/90 text-gray-600 hover:text-brand-primary hover:border-brand-primary/40 hover:bg-white transition-colors shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {advancedFilters && onAdvancedFiltersChange && (
        <AdvancedFiltersModal
          isOpen={isAdvancedModalOpen}
          onClose={() => setIsAdvancedModalOpen(false)}
          filters={advancedFilters}
          onChangeFilters={onAdvancedFiltersChange}
          onReset={onResetAdvanced || (() => onAdvancedFiltersChange(defaultAdvancedFilters))}
          totalFilteredCount={totalCount}
        />
      )}
    </div>
  );
}
