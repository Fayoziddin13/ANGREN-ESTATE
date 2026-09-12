"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/Header";
import { FloatingSearchPanel } from "@/components/map/FloatingSearchPanel";
import { PropertyPreviewCard } from "@/components/map/PropertyPreviewCard";
import { PropertyDetailModal } from "@/components/property/PropertyDetailModal";
import { MobileBottomSheet } from "@/components/map/MobileBottomSheet";
import { MobileFilterSheet } from "@/components/map/MobileFilterSheet";
import { MobileMapStyleSwitcher } from "@/components/map/MobileMapStyleSwitcher";
import { CollapsiblePropertyList } from "@/components/map/CollapsiblePropertyList";
import { PropertyCatalogModal } from "@/components/catalog/PropertyCatalogModal";
import { PopularSection } from "@/components/property/PopularSection";
import { TrustSection } from "@/components/home/TrustSection";
import { Footer } from "@/components/layout/Footer";
import { ScrollRailNav } from "@/components/layout/ScrollRailNav";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useProperties } from "@/lib/propertyStore";
import { trackEvent } from "@/lib/analytics";
import { TransactionType, PropertyType, Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useMapMode } from "@/lib/mapStore";
import { AdvancedFilterState, defaultAdvancedFilters } from "@/components/map/AdvancedFiltersModal";
import { List, ChevronDown, Map, Layers, Search, SlidersHorizontal, Building2 } from "lucide-react";

// Dynamic import for WebGL map to disable SSR
const AngrenMap = dynamic(
  () => import("@/components/map/AngrenMap").then((mod) => mod.AngrenMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <div className="h-8 w-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin mb-2" />
        <span className="text-xs font-semibold">Angren xaritasi yuklanmoqda...</span>
      </div>
    ),
  }
);

export default function BuyPage() {
  const { locale, t } = useLanguage();
  const { publishedProperties } = useProperties();

  // Primary View: Map vs Catalog (Default: map)
  const [activeView, setActiveView] = useState<"map" | "catalog">("map");

  // Map Mode: Standard (Sxema) vs Satellite (Default: satellite, persistent)
  const [mapMode, setMapMode] = useMapMode();


  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [transactionType, setTransactionType] = useState<TransactionType | "all">("sale");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<PropertyType | "all">("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>(defaultAdvancedFilters);

  // Selection & Modal States
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Active pool of properties: strictly published properties from canonical data store
  const activePropertiesPool = useMemo(() => {
    return publishedProperties.filter(
      (p) => p.transaction_type === "sale" || p.deal_type === "sale"
    );
  }, [publishedProperties]);

  // Analytics on page load
  React.useEffect(() => {
    trackEvent("page_view", { metadata: { page: "sotib-olish", deal_type: "sale" } });
    trackEvent("map_view", { metadata: { mode: mapMode } });
  }, [mapMode]);

  // Sync initial URL search params for deep linking and testing
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const selId = params.get("selected");
      if (selId) {
        const found = activePropertiesPool.find((p) => p.id === selId);
        if (found) setSelectedProperty(found);
      }
      if (params.get("detail") === "1" && selId) {
        const found = activePropertiesPool.find((p) => p.id === selId);
        if (found) {
          setDetailProperty(found);
          setIsDetailOpen(true);
        }
      }
      if (params.get("list") === "1") {
        setIsListOpen(true);
      }
      if (params.get("mode") === "satellite" || params.get("mode") === "standard") {
        setMapMode(params.get("mode") as "standard" | "satellite");
      }
      if (params.get("type") === "sale" || params.get("type") === "rent") {
        setTransactionType(params.get("type") as TransactionType);
      }
      if (params.get("q")) {
        setSearchQuery(params.get("q") || "");
      }
    }
  }, [activePropertiesPool]);

  // Filter properties in real-time
  const filteredProperties = useMemo(() => {
    return activePropertiesPool.filter((p) => {
      // Search Query Filter (title, address, district, neighborhood, property type)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle =
          (p.title_uz || "").toLowerCase().includes(q) ||
          (p.title_ru || "").toLowerCase().includes(q);
        const matchesAddress =
          (p.address_uz || "").toLowerCase().includes(q) ||
          (p.address_ru || "").toLowerCase().includes(q);
        const matchesDistrict =
          (p.district_name_uz || "").toLowerCase().includes(q) ||
          (p.district_name_ru || "").toLowerCase().includes(q);
        const matchesNeighborhood = (p.neighborhood || "").toLowerCase().includes(q);
        const matchesType = (p.property_type || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesAddress && !matchesDistrict && !matchesNeighborhood && !matchesType) {
          return false;
        }
      }

      // Transaction Filter
      if (transactionType !== "all" && p.transaction_type !== transactionType) {
        return false;
      }
      // District Filter
      if (selectedDistrict !== "all" && p.district_name_uz !== selectedDistrict) {
        return false;
      }
      // Type Filter
      if (selectedType !== "all" && p.property_type !== selectedType) {
        return false;
      }
      // Price Filter
      if (priceFilter === "under300m" && p.price_uzs >= 300000000) {
        return false;
      }
      if (
        priceFilter === "300to600m" &&
        (p.price_uzs < 300000000 || p.price_uzs > 600000000)
      ) {
        return false;
      }
      if (priceFilter === "over600m" && p.price_uzs <= 600000000) {
        return false;
      }

      // Advanced Filters: Rooms
      if (advancedFilters.rooms !== "all") {
        if (advancedFilters.rooms === 5) {
          if (!p.rooms || p.rooms < 5) return false;
        } else {
          if (p.rooms !== advancedFilters.rooms) return false;
        }
      }

      // Advanced Filters: Area
      if (typeof advancedFilters.minArea === "number" && p.area_sqm < advancedFilters.minArea) {
        return false;
      }
      if (typeof advancedFilters.maxArea === "number" && p.area_sqm > advancedFilters.maxArea) {
        return false;
      }

      // Advanced Filters: Floor
      const pFloor = p.floor_number ?? p.floor;
      if (typeof advancedFilters.minFloor === "number") {
        if (pFloor === undefined || pFloor < advancedFilters.minFloor) return false;
      }
      if (typeof advancedFilters.maxFloor === "number") {
        if (pFloor === undefined || pFloor > advancedFilters.maxFloor) return false;
      }

      // Advanced Filters: Renovation
      if (advancedFilters.renovation !== "all" && p.renovation !== advancedFilters.renovation) {
        return false;
      }

      // Advanced Filters: Furniture
      if (advancedFilters.furniture !== "all") {
        const hasFurn = p.furniture ?? p.amenities?.furniture ?? false;
        if (hasFurn !== advancedFilters.furniture) return false;
      }

      // Advanced Filters: Utilities
      if (advancedFilters.utilities?.gas && !p.utilities?.gas) return false;
      if (advancedFilters.utilities?.water && !p.utilities?.water) return false;
      if (advancedFilters.utilities?.electricity && !p.utilities?.electricity) return false;
      if (advancedFilters.utilities?.sewerage && !p.utilities?.sewerage) return false;
      if (advancedFilters.utilities?.heating && !p.utilities?.heating) return false;

      // Advanced Filters: Amenities
      if (advancedFilters.amenities?.parking && !(p.amenities?.parking ?? p.parking)) return false;
      if (advancedFilters.amenities?.elevator && !p.amenities?.elevator) return false;
      if (advancedFilters.amenities?.ac && !p.amenities?.ac) return false;
      if (advancedFilters.amenities?.internet && !p.amenities?.internet) return false;
      if (advancedFilters.amenities?.balcony && !p.amenities?.balcony) return false;

      return true;
    });
  }, [activePropertiesPool, searchQuery, transactionType, selectedDistrict, selectedType, priceFilter, advancedFilters]);

  // Count of currently active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (transactionType !== "all") count++;
    if (selectedDistrict !== "all") count++;
    if (selectedType !== "all") count++;
    if (priceFilter !== "all") count++;
    if (advancedFilters.rooms !== "all") count++;
    if (advancedFilters.minArea !== "" || advancedFilters.maxArea !== "") count++;
    if (advancedFilters.minFloor !== "" || advancedFilters.maxFloor !== "") count++;
    if (advancedFilters.renovation !== "all") count++;
    if (advancedFilters.furniture !== "all") count++;
    if (Object.values(advancedFilters.utilities || {}).some(Boolean)) count++;
    if (Object.values(advancedFilters.amenities || {}).some(Boolean)) count++;
    return count;
  }, [searchQuery, transactionType, selectedDistrict, selectedType, priceFilter, advancedFilters]);

  // Summary of active filters for compact mobile button
  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (transactionType !== "all") {
      parts.push(transactionType === "sale" ? t.popular.saleBadge : t.popular.rentBadge);
    }
    if (selectedDistrict !== "all") {
      parts.push(selectedDistrict);
    }
    if (selectedType !== "all") {
      const typeMap: Record<string, string> = {
        apartment: t.searchBar.apartment,
        house_yard: t.searchBar.house,
        new_build: t.searchBar.newBuild,
        commercial: t.searchBar.commercial,
        land: t.searchBar.land,
      };
      if (typeMap[selectedType]) parts.push(typeMap[selectedType]);
    }
    if (priceFilter !== "all") {
      const priceMap: Record<string, string> = {
        under300m: "< 300 млн",
        "300to600m": "300 - 600 млн",
        over600m: "> 600 млн",
      };
      if (priceMap[priceFilter]) parts.push(priceMap[priceFilter]);
    }
    if (parts.length > 0) {
      return parts.join(" • ");
    }
    return "";
  }, [transactionType, selectedDistrict, selectedType, priceFilter, t]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setTransactionType("all");
    setSelectedDistrict("all");
    setSelectedType("all");
    setPriceFilter("all");
    setAdvancedFilters(defaultAdvancedFilters);
  };

  const handleOpenDetails = (prop: Property) => {
    trackEvent("property_view", { property_id: prop.id, metadata: { title: prop.title_uz } });
    setDetailProperty(prop);
    setIsDetailOpen(true);
  };

  const scrollToPopular = () => {
    const el = document.getElementById("popular-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
      {/* 1. Sticky Header */}
      <Header activeTransactionType={transactionType} onTransactionTypeChange={setTransactionType} />

      {/* Sub-Header Section Banner */}
      <div className="bg-[#134431] border-b border-emerald-800/40 py-2.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-300" />
            <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              {locale === "uz" ? "Angrenda ko‘chmas mulk sotib olish" : "Купить недвижимость в Ангрене"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-200">
              {filteredProperties.length} {locale === "uz" ? "ta sotuvdagi obyekt" : "объектов на продажу"}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Vertical Navigation Rail */}
      <ScrollRailNav />

      {/* 2. MAP-FIRST PRIMARY VIEWPORT */}
      <main id="map-section" className="relative w-full h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)] overflow-hidden bg-gray-100">
        {/* Full-Screen Angren Interactive Map */}
        <AngrenMap
          properties={filteredProperties}
          selectedProperty={selectedProperty}
          onSelectProperty={setSelectedProperty}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          focusDistrict={selectedDistrict}
        />

        {/* Mobile Primary View Switcher: [ ХАРИТА | КАТАЛОГ ] */}
        <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div
            data-testid="primary-view-switcher"
            className="flex items-center p-1 rounded-2xl bg-white/95 backdrop-blur-xl shadow-elevated border border-white/90 transition-all"
          >
            <button
              type="button"
              data-testid="view-mode-map"
              onClick={() => setActiveView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeView === "map"
                  ? "bg-[#16543C] text-white shadow-card"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
              }`}
            >
              <Map className="h-3.5 w-3.5" />
              <span>{locale === "uz" ? "ХАРИТА" : "КАРТА"}</span>
            </button>
            <button
              type="button"
              data-testid="view-mode-catalog"
              onClick={() => setActiveView("catalog")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeView === "catalog"
                  ? "bg-[#16543C] text-white shadow-card"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{locale === "uz" ? "КАТАЛОГ" : "КАТАЛОГ"}</span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  activeView === "catalog"
                    ? "bg-white text-[#16543C]"
                    : "bg-emerald-100 text-[#16543C]"
                }`}
              >
                {filteredProperties.length}
              </span>
            </button>
          </div>
        </div>

        {/* Desktop-Only Floating Search & Filter Panel (Top Left) */}
        <div data-testid="desktop-search-panel" className="hidden sm:block absolute sm:top-4 sm:left-6 sm:right-auto z-20 max-w-2xl pointer-events-none">
          <FloatingSearchPanel
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            transactionType={transactionType}
            onTransactionChange={(t) => {
              setTransactionType(t);
              trackEvent("filter_used", { metadata: { transaction_type: t } });
            }}
            selectedDistrict={selectedDistrict}
            onDistrictChange={(d) => {
              setSelectedDistrict(d);
              trackEvent("filter_used", { metadata: { district: d } });
            }}
            selectedType={selectedType}
            onTypeChange={(tp) => {
              setSelectedType(tp);
              trackEvent("filter_used", { metadata: { property_type: tp } });
            }}
            priceFilter={priceFilter}
            onPriceFilterChange={(pf) => {
              setPriceFilter(pf);
              trackEvent("filter_used", { metadata: { price: pf } });
            }}
            onReset={handleResetFilters}
            totalCount={filteredProperties.length}
            isMobileDrawerOpen={isMobileSearchOpen}
            onCloseMobileDrawer={() => setIsMobileSearchOpen(false)}
            advancedFilters={advancedFilters}
            onAdvancedFiltersChange={(af) => {
              setAdvancedFilters(af);
              trackEvent("filter_used", { metadata: { advanced_filters: true } });
            }}
            onResetAdvanced={() => setAdvancedFilters(defaultAdvancedFilters)}
          />
        </div>

        {/* Mobile-Only Compact Floating Search/Filter Control */}
        <div className="sm:hidden absolute top-14 left-3 right-3 z-20 pointer-events-auto">
          <button
            type="button"
            data-testid="compact-search-trigger"
            onClick={() => setIsMobileSearchOpen(true)}
            aria-label={locale === "uz" ? "Qidiruv va filtrlarni ochish" : "Открыть поиск и фильтры"}
            className="w-full flex items-center justify-between rounded-2xl bg-white/95 backdrop-blur-xl px-3.5 py-2.5 shadow-elevated border border-white/90 active:scale-[0.98] transition-all text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-[#16543C] flex items-center justify-center shrink-0 shadow-xs">
                <Search className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-900 truncate">
                  {searchQuery
                    ? searchQuery
                    : locale === "uz"
                    ? "Angrendan mulk izlash..."
                    : "Поиск недвижимости в Ангрене..."}
                </p>
                <p className="text-[10px] font-medium text-slate-500 truncate">
                  {activeFilterSummary
                    ? activeFilterSummary
                    : locale === "uz"
                    ? "Barcha turlar • Narx • Hudud"
                    : "Все типы • Цена • Район"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pl-2">
              {activeFiltersCount > 0 && (
                <span className="flex h-5 px-1.5 items-center justify-center rounded-full bg-[#16543C] text-[10px] text-white font-extrabold shadow-sm">
                  {activeFiltersCount}
                </span>
              )}
              <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
            </div>
          </button>
        </div>

        {/* Desktop-Only Floating Action Controls (Top Right: Primary View Switcher & Map Style Switcher) */}
        <div className="hidden sm:flex items-center gap-3 absolute sm:top-4 sm:right-6 z-20 pointer-events-auto">
          {/* Primary View Switcher: [ ХАРИТА | КАТАЛОГ ] */}
          <div
            data-testid="desktop-primary-view-switcher"
            className="flex items-center p-1 rounded-2xl bg-white/95 backdrop-blur-xl shadow-elevated border border-white/90 transition-all"
          >
            <button
              type="button"
              data-testid="view-mode-map-desktop"
              onClick={() => setActiveView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeView === "map"
                  ? "bg-[#16543C] text-white shadow-card"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
              }`}
            >
              <Map className="h-3.5 w-3.5" />
              <span>{locale === "uz" ? "ХАРИТА" : "КАРТА"}</span>
            </button>
            <button
              type="button"
              data-testid="view-mode-catalog-desktop"
              onClick={() => setActiveView("catalog")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeView === "catalog"
                  ? "bg-[#16543C] text-white shadow-card"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{locale === "uz" ? "КАТАЛОГ" : "КАТАЛОГ"}</span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  activeView === "catalog"
                    ? "bg-white text-[#16543C]"
                    : "bg-emerald-100 text-[#16543C]"
                }`}
              >
                {filteredProperties.length}
              </span>
            </button>
          </div>

          {/* Segmented Map Switcher: [ Sxema | Satellite ] */}
          <div data-testid="map-mode-switcher" className="flex items-center p-1 rounded-2xl bg-white/90 backdrop-blur-xl shadow-elevated border border-white/80 transition-all">
            <button
              data-testid="map-mode-standard"
              onClick={() => setMapMode("standard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mapMode === "standard"
                  ? "bg-[#16543C] text-white shadow-card"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              <Map className="h-3.5 w-3.5" />
              <span>{t.mapSection.standard}</span>
            </button>
            <button
              data-testid="map-mode-satellite"
              onClick={() => setMapMode("satellite")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mapMode === "satellite"
                  ? "bg-[#16543C] text-white shadow-card"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{t.mapSection.satellite}</span>
            </button>
          </div>
        </div>

        {/* Mobile-Only Compact Floating Map Style Switcher (Lower-Right Area) */}
        <MobileMapStyleSwitcher
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          className={`bottom-[140px] right-4 ${selectedProperty ? "hidden" : ""}`}
        />

        {/* Desktop Floating Property Preview Card (Bottom Left) */}
        {selectedProperty && (
          <div className="hidden sm:block absolute bottom-6 left-6 z-20">
            <PropertyPreviewCard
              property={selectedProperty}
              onClose={() => setSelectedProperty(null)}
              onViewDetails={handleOpenDetails}
            />
          </div>
        )}

        {/* Desktop Collapsible Property List Panel */}
        <CollapsiblePropertyList
          isOpen={isListOpen}
          onClose={() => setIsListOpen(false)}
          properties={filteredProperties}
          selectedProperty={selectedProperty}
          onSelectProperty={(p) => {
            setSelectedProperty(p);
          }}
          onViewDetails={handleOpenDetails}
        />

        {/* Mobile iOS-style Property Bottom Sheet */}
        <MobileBottomSheet
          property={selectedProperty}
          totalCount={filteredProperties.length}
          onClose={() => setSelectedProperty(null)}
          onViewDetails={handleOpenDetails}
          properties={filteredProperties}
          onSelectProperty={setSelectedProperty}
        />

        {/* Mobile-Only Search & Filter Bottom Sheet */}
        <MobileFilterSheet
          isOpen={isMobileSearchOpen}
          onClose={() => setIsMobileSearchOpen(false)}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          transactionType={transactionType}
          onTransactionChange={(t) => {
            setTransactionType(t);
            trackEvent("filter_used", { metadata: { transaction_type: t } });
          }}
          selectedDistrict={selectedDistrict}
          onDistrictChange={(d) => {
            setSelectedDistrict(d);
            trackEvent("filter_used", { metadata: { district: d } });
          }}
          selectedType={selectedType}
          onTypeChange={(tp) => {
            setSelectedType(tp);
            trackEvent("filter_used", { metadata: { property_type: tp } });
          }}
          priceFilter={priceFilter}
          onPriceFilterChange={(pf) => {
            setPriceFilter(pf);
            trackEvent("filter_used", { metadata: { price: pf } });
          }}
          onReset={handleResetFilters}
          totalCount={filteredProperties.length}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={(af) => {
            setAdvancedFilters(af);
            trackEvent("filter_used", { metadata: { advanced_filters: true } });
          }}
          onResetAdvanced={() => setAdvancedFilters(defaultAdvancedFilters)}
        />

        {/* Subtle Scroll Cue to Secondary Content */}
        <button
          onClick={scrollToPopular}
          className="hidden sm:flex items-center gap-1.5 absolute bottom-4 right-20 z-10 rounded-full bg-white/85 backdrop-blur-md px-3.5 py-1.5 text-[11px] font-bold text-gray-700 shadow-sm border border-white/80 hover:bg-white transition-all"
        >
          <span>{t.popular.title}</span>
          <ChevronDown className="h-3 w-3 text-gray-400" />
        </button>
      </main>

      {/* 3. SECONDARY DISCOVERY CONTENT (Below the Map Fold) */}
      <div id="popular-section">
        {/* Popular Offers */}
        <PopularSection
          properties={filteredProperties}
          viewAllHref={transactionType === "rent" ? "/ijara" : "/sotib-olish"}
          limit={4}
        />
      </div>

      <div id="trust-section">
        {/* Trust Badges */}
        <TrustSection />
      </div>

      <div id="footer-section">
        {/* Footer */}
        <Footer />
      </div>

      {/* 4. Fullscreen Property Catalog Overlay View */}
      <PropertyCatalogModal
        isOpen={activeView === "catalog"}
        onClose={() => setActiveView("map")}
        properties={filteredProperties}
        transactionType={transactionType}
        onTransactionChange={(t) => {
          setTransactionType(t);
          trackEvent("filter_used", { metadata: { transaction_type: t } });
        }}
        selectedType={selectedType}
        onTypeChange={(tp) => {
          setSelectedType(tp);
          trackEvent("filter_used", { metadata: { property_type: tp } });
        }}
        onViewDetails={handleOpenDetails}
        searchQuery={searchQuery}
        onClearFilters={handleResetFilters}
      />

      {/* 5. Property Detail Modal (Full view) */}
      <PropertyDetailModal
        property={detailProperty}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      {/* 5. Mobile Bottom Navigation (4 Tabs strictly) */}
      <MobileBottomNav
        onSearchClick={() => {
          setIsMobileSearchOpen(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
