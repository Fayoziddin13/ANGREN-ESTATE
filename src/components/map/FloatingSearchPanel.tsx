"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Home, Coins, ChevronDown, RotateCcw, Check, Search, X, SlidersHorizontal, Bookmark } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useSavedSearches } from "@/lib/savedSearchStore";
import { TransactionType, PropertyType, HududItem } from "@/lib/types";
import { DEFAULT_ANGREN_HUDUDS } from "@/lib/hududService";
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

  return (
    <div
      className={`pointer-events-auto w-fit max-w-full rounded-2xl bg-white/90 backdrop-blur-xl p-1.5 sm:p-2 shadow-elevated border border-white/80 transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 xl:gap-2">
        {/* Transaction Pill Switcher: [ Barchasi | Sotuv | Ijara ] */}
        <div className="flex items-center h-9 rounded-xl bg-gray-100/90 p-1 shrink-0 border border-gray-200/60">
          <button
            onClick={() => onTransactionChange("all")}
            className={`h-7 rounded-lg px-2.5 xl:px-3 text-[11.5px] font-bold transition-all ${
              transactionType === "all"
                ? "bg-[#0d3431] text-white shadow-card"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.common.all}
          </button>
          <button
            onClick={() => onTransactionChange("sale")}
            className={`h-7 rounded-lg px-2.5 xl:px-3 text-[11.5px] font-bold transition-all ${
              transactionType === "sale"
                ? "bg-[#0d3431] text-white shadow-card"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.popular.saleBadge}
          </button>
          <button
            onClick={() => onTransactionChange("rent")}
            className={`h-7 rounded-lg px-2.5 xl:px-3 text-[11.5px] font-bold transition-all ${
              transactionType === "rent"
                ? "bg-[#0d3431] text-white shadow-card"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.popular.rentBadge}
          </button>
        </div>

        {/* Separator on desktop */}
        <div className="hidden sm:block h-6 w-[1px] bg-gray-200 shrink-0" />

        {/* Text Search Input */}
        {onSearchQueryChange && (
          <div className="relative flex-1 min-w-[85px] sm:min-w-[100px] xl:min-w-[120px] 2xl:min-w-[140px] max-w-[160px]">
            <div className="flex h-9 w-full items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 px-2.5 xl:px-3 text-xs font-semibold text-gray-800 focus-within:border-[#19453c] focus-within:ring-2 focus-within:ring-[#19453c]/20 transition-all">
              <Search className="h-3.5 w-3.5 text-[#0d3431] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder={locale === "uz" ? "Daha, ko‘cha..." : "Массив, улица..."}
                className="w-full bg-transparent text-[11.5px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
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
        <div className="relative flex-1 min-w-[80px] sm:min-w-[90px] xl:min-w-[105px] 2xl:min-w-[125px] max-w-[140px]">
          <button
            onClick={() => {
              setDistrictOpen(!districtOpen);
              setTypeOpen(false);
              setPriceOpen(false);
            }}
            className="flex h-9 w-full items-center justify-between gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 px-2 xl:px-2.5 text-[11.5px] font-semibold text-gray-800 hover:border-[#19453c]/40 hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate min-w-0">
              <MapPin className="h-3.5 w-3.5 text-[#0d3431] shrink-0" />
              <span className="truncate">{getDistrictLabel()}</span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-gray-400 transition-transform shrink-0 ${
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
        <div className="relative flex-1 min-w-[80px] sm:min-w-[90px] xl:min-w-[105px] 2xl:min-w-[125px] max-w-[140px]">
          <button
            onClick={() => {
              setTypeOpen(!typeOpen);
              setDistrictOpen(false);
              setPriceOpen(false);
            }}
            className="flex h-9 w-full items-center justify-between gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 px-2 xl:px-2.5 text-[11.5px] font-semibold text-gray-800 hover:border-[#19453c]/40 hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate min-w-0">
              <Home className="h-3.5 w-3.5 text-[#0d3431] shrink-0" />
              <span className="truncate">{getTypeLabel()}</span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-gray-400 transition-transform shrink-0 ${
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
        <div className="relative flex-1 min-w-[75px] sm:min-w-[85px] xl:min-w-[95px] 2xl:min-w-[115px] max-w-[130px]">
          <button
            onClick={() => {
              setPriceOpen(!priceOpen);
              setDistrictOpen(false);
              setTypeOpen(false);
            }}
            className="flex h-9 w-full items-center justify-between gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 px-2 xl:px-2.5 text-[11.5px] font-semibold text-gray-800 hover:border-[#19453c]/40 hover:bg-white transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate min-w-0">
              <Coins className="h-3.5 w-3.5 text-[#0d3431] shrink-0" />
              <span className="truncate">{getPriceLabel()}</span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-gray-400 transition-transform shrink-0 ${
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
                    if (advancedFilters && onAdvancedFiltersChange) {
                      onAdvancedFiltersChange({ ...advancedFilters, minPrice: "", maxPrice: "" });
                    }
                    setPriceOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                    priceFilter === po.key && !advancedFilters?.minPrice && !advancedFilters?.maxPrice
                      ? "bg-brand-light text-brand-primary"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{po.label}</span>
                  {priceFilter === po.key && !advancedFilters?.minPrice && !advancedFilters?.maxPrice && (
                    <Check className="h-3.5 w-3.5 text-brand-primary" />
                  )}
                </button>
              ))}

              {advancedFilters && onAdvancedFiltersChange && (
                <div className="pt-2 mt-1 border-t border-gray-100 px-2 pb-1 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                    <span>{locale === "uz" ? "Aniq narx" : "Точная цена"}</span>
                    <span className="text-[10px] text-gray-400 font-semibold">{currency === "USD" ? "$ USD" : (locale === "uz" ? "so‘m (UZS)" : "сум (UZS)")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
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
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-primary"
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
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action / Reset Button & Live Count Badge */}
        <div className="flex items-center justify-between sm:justify-start gap-1.5 xl:gap-2 shrink-0 pt-1 sm:pt-0">
          {/* Redundant on laptop screens since catalog switcher shows totalCount */}
          <div className="flex sm:hidden 2xl:flex items-center gap-1.5 rounded-xl bg-[#d9eedb] px-3 h-9 text-xs font-bold text-[#0d3431]">
            <span className="h-2 w-2 rounded-full bg-[#0d3431] animate-pulse" />
            <span>{totalCount} {locale === "uz" ? "obyekt" : "объектов"}</span>
          </div>

          {advancedFilters && onAdvancedFiltersChange && (
            <button
              onClick={() => setIsAdvancedModalOpen(true)}
              title={locale === "uz" ? "Kengaytirilgan filtrlar" : "Расширенные фильтры"}
              className={`relative flex items-center gap-1 xl:gap-1.5 h-9 px-2.5 rounded-xl border transition-colors shadow-sm text-xs font-bold ${
                (advancedFilters.rooms !== "all" ||
                  advancedFilters.minArea !== "" ||
                  advancedFilters.maxArea !== "" ||
                  advancedFilters.minFloor !== "" ||
                  advancedFilters.maxFloor !== "" ||
                  advancedFilters.renovation !== "all" ||
                  advancedFilters.furniture !== "all" ||
                  Object.values(advancedFilters.utilities || {}).some(Boolean) ||
                  Object.values(advancedFilters.amenities || {}).some(Boolean))
                  ? "border-[#19453c] bg-[#d9eedb] text-[#0d3431]"
                  : "border-gray-200/80 bg-white/90 text-gray-700 hover:text-[#19453c] hover:border-[#19453c]/40 hover:bg-white"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline">{locale === "uz" ? "Filtrlar" : "Фильтры"}</span>
              {(advancedFilters.rooms !== "all" ||
                advancedFilters.minArea !== "" ||
                advancedFilters.maxArea !== "" ||
                advancedFilters.minFloor !== "" ||
                advancedFilters.maxFloor !== "" ||
                advancedFilters.renovation !== "all" ||
                advancedFilters.furniture !== "all" ||
                Object.values(advancedFilters.utilities || {}).some(Boolean) ||
                Object.values(advancedFilters.amenities || {}).some(Boolean)) && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0d3431] px-1 text-[10px] font-extrabold text-white">
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
            className="flex h-9 px-2.5 items-center gap-1 xl:gap-1.5 rounded-xl border border-gray-200/80 bg-white/90 text-gray-700 hover:text-[#19453c] hover:border-[#19453c]/40 hover:bg-white transition-colors shadow-sm text-xs font-bold"
          >
            <Bookmark className="h-3.5 w-3.5 text-[#0d3431] shrink-0" />
            <span className="hidden 2xl:inline">{locale === "uz" ? "Saqlash" : "Сохранить"}</span>
          </button>

          <button
            onClick={onReset}
            title={t.filters.reset}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200/80 bg-white/90 text-gray-600 hover:text-[#19453c] hover:border-[#19453c]/40 hover:bg-white transition-colors shadow-sm shrink-0"
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
