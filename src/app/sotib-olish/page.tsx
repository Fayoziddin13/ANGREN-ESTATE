"use client";

import React, { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/Header";
import { FloatingSearchPanel } from "@/components/map/FloatingSearchPanel";
import { PropertyPreviewCard } from "@/components/map/PropertyPreviewCard";
import { PropertyDetailModal } from "@/components/property/PropertyDetailModal";
import { MobileBottomSheet } from "@/components/map/MobileBottomSheet";
import { CollapsiblePropertyList } from "@/components/map/CollapsiblePropertyList";
import { PopularSection } from "@/components/property/PopularSection";
import { TrustSection } from "@/components/home/TrustSection";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useProperties } from "@/lib/propertyStore";
import { trackEvent, trackSearchDebounced, trackFilterChange } from "@/lib/analytics";
import { PropertyType, Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { AdvancedFilterState, defaultAdvancedFilters } from "@/components/map/AdvancedFiltersModal";
import { List, ChevronDown, Map, Layers, Building2 } from "lucide-react";

// Dynamic import for WebGL map to disable SSR
const AngrenMap = dynamic(
  () => import("@/components/map/AngrenMap").then((mod) => mod.AngrenMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <div className="h-8 w-8 rounded-full border-2 border-[#16543C] border-t-transparent animate-spin mb-2" />
        <span className="text-xs font-semibold">Angren xaritasi yuklanmoqda...</span>
      </div>
    ),
  }
);

export default function BuyPage() {
  const { locale, t } = useLanguage();
  const { publishedProperties } = useProperties();

  // Map Mode: Standard (Sxema) vs Satellite
  const [mapMode, setMapMode] = useState<"standard" | "satellite">("standard");

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>("");
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

  // Active pool of sale properties: strictly canonical published properties with transaction_type === "sale"
  const salePropertiesPool = useMemo(() => {
    return publishedProperties.filter(
      (p) => p.transaction_type === "sale" || p.deal_type === "sale"
    );
  }, [publishedProperties]);

  // Analytics on page load
  useEffect(() => {
    trackEvent("page_view", { metadata: { page: "sotib-olish", deal_type: "sale" } });
    trackEvent("map_view", { metadata: { page: "sotib-olish", mode: "standard" } });
  }, []);

  // Debounced search analytics
  useEffect(() => {
    if (searchQuery.trim().length >= 3) {
      trackSearchDebounced(searchQuery);
    }
  }, [searchQuery]);

  // Deduplicated filter analytics
  useEffect(() => {
    if (selectedDistrict !== "all" || selectedType !== "all" || priceFilter !== "all") {
      trackFilterChange({
        deal_type: "sale",
        district: selectedDistrict,
        property_type: selectedType,
        price_filter: priceFilter,
      });
    }
  }, [selectedDistrict, selectedType, priceFilter]);

  // Filter properties in real-time
  const filteredProperties = useMemo(() => {
    return salePropertiesPool.filter((p) => {
      // Search Query Filter
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
  }, [salePropertiesPool, searchQuery, selectedDistrict, selectedType, priceFilter, advancedFilters]);

  const handleResetFilters = () => {
    setSearchQuery("");
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
    const el = document.getElementById("sale-offers-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
      {/* 1. Header */}
      <Header />

      {/* 2. Sub-Header Banner */}
      <div className="bg-[#134431] border-b border-emerald-800/40 px-4 py-2.5 sm:px-6">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-300" />
            <h1 className="text-xs sm:text-sm font-extrabold text-white">
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

      {/* 3. MAP-FIRST PRIMARY VIEWPORT */}
      <main className="relative w-full h-[calc(100vh-104px)] sm:h-[calc(100vh-120px)] overflow-hidden bg-gray-100">
        {/* Full-Screen Angren Interactive Map */}
        <AngrenMap
          properties={filteredProperties}
          selectedProperty={selectedProperty}
          onSelectProperty={setSelectedProperty}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          focusDistrict={selectedDistrict}
        />

        {/* Floating Search & Filter Panel (Top) */}
        <div className="absolute top-3 sm:top-4 left-3 right-3 sm:left-6 sm:right-auto z-20 max-w-4xl pointer-events-none">
          <FloatingSearchPanel
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            transactionType="sale"
            onTransactionChange={() => {}}
            selectedDistrict={selectedDistrict}
            onDistrictChange={(d) => {
              setSelectedDistrict(d);
              trackEvent("filter_used", { metadata: { district: d, page: "sotib-olish" } });
            }}
            selectedType={selectedType}
            onTypeChange={(tp) => {
              setSelectedType(tp);
              trackEvent("filter_used", { metadata: { property_type: tp, page: "sotib-olish" } });
            }}
            priceFilter={priceFilter}
            onPriceFilterChange={(pf) => {
              setPriceFilter(pf);
              trackEvent("filter_used", { metadata: { price: pf, page: "sotib-olish" } });
            }}
            onReset={handleResetFilters}
            totalCount={filteredProperties.length}
            isMobileDrawerOpen={isMobileSearchOpen}
            onCloseMobileDrawer={() => setIsMobileSearchOpen(false)}
            advancedFilters={advancedFilters}
            onAdvancedFiltersChange={(af) => {
              setAdvancedFilters(af);
              trackEvent("filter_used", { metadata: { advanced_filters: true, page: "sotib-olish" } });
            }}
            onResetAdvanced={() => setAdvancedFilters(defaultAdvancedFilters)}
          />
        </div>

        {/* Floating Action Controls (Top Right: Map Style Switcher & List View Toggle) */}
        <div className="flex items-center gap-2 sm:gap-3 absolute top-[290px] right-3 sm:top-4 sm:right-6 z-20 pointer-events-auto">
          {/* Segmented Map Switcher: [ Sxema | Satellite ] */}
          <div className="flex items-center p-1 rounded-2xl bg-white/90 backdrop-blur-xl shadow-elevated border border-white/80 transition-all">
            <button
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

          {/* List View Toggle (MAP > LIST) */}
          <button
            onClick={() => setIsListOpen(!isListOpen)}
            className={`hidden sm:flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-xl px-4 py-2 text-xs font-bold shadow-elevated border border-white/80 transition-all active:scale-95 ${
              isListOpen
                ? "bg-[#16543C] text-white border-[#16543C]"
                : "text-brand-dark hover:bg-white"
            }`}
          >
            <List className="h-4 w-4" />
            <span>{t.mapSection.listToggle}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                isListOpen
                  ? "bg-white text-[#16543C]"
                  : "bg-brand-light text-brand-primary"
              }`}
            >
              {filteredProperties.length}
            </span>
          </button>
        </div>

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
          onSelectProperty={(p) => setSelectedProperty(p)}
          onViewDetails={handleOpenDetails}
        />

        {/* Mobile iOS-style Bottom Sheet */}
        <MobileBottomSheet
          property={selectedProperty}
          totalCount={filteredProperties.length}
          onClose={() => setSelectedProperty(null)}
          onViewDetails={handleOpenDetails}
          properties={filteredProperties}
          onSelectProperty={setSelectedProperty}
        />

        {/* Subtle Scroll Cue */}
        <button
          onClick={scrollToPopular}
          className="hidden sm:flex items-center gap-1.5 absolute bottom-4 right-20 z-10 rounded-full bg-white/85 backdrop-blur-md px-3.5 py-1.5 text-[11px] font-bold text-gray-700 shadow-sm border border-white/80 hover:bg-white transition-all"
        >
          <span>{locale === "uz" ? "Sotuvdagi takliflar ro‘yxati" : "Предложения на продажу"}</span>
          <ChevronDown className="h-3 w-3 text-gray-400" />
        </button>
      </main>

      {/* 4. SECONDARY DISCOVERY CONTENT */}
      <div id="sale-offers-section">
        <PopularSection
          properties={filteredProperties}
          title={locale === "uz" ? "Sotuvdagi barcha takliflar" : "Все предложения на продажу"}
          subtitle={
            locale === "uz"
              ? `${filteredProperties.length} ta saralangan ko‘chmas mulk obyekti`
              : `${filteredProperties.length} проверенных объектов недвижимости`
          }
          id="sale-catalog"
          viewAllHref=""
        />
        <TrustSection />
        <Footer />
      </div>

      {/* 5. Property Detail Modal */}
      <PropertyDetailModal
        property={detailProperty}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      {/* 6. Mobile Bottom Navigation */}
      <MobileBottomNav
        onSearchClick={() => {
          setIsMobileSearchOpen(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
