"use client";

import React, { useState } from "react";
import Image from "next/image";
import { MapPin, Home, Coins, Search, ChevronDown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useCMS } from "@/lib/cmsStore";
import { TransactionType, PropertyType } from "@/lib/types";

interface HeroSectionProps {
  transactionType: TransactionType;
  onTransactionChange: (type: TransactionType) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  selectedType: PropertyType | "all";
  onTypeChange: (type: PropertyType | "all") => void;
  priceFilter: string;
  onPriceFilterChange: (price: string) => void;
  onSearch: () => void;
}

export function HeroSection({
  transactionType,
  onTransactionChange,
  selectedCity,
  onCityChange,
  selectedType,
  onTypeChange,
  priceFilter,
  onPriceFilterChange,
  onSearch,
}: HeroSectionProps) {
  const { locale, t } = useLanguage();
  const { currency } = useCurrency();
  const { hero } = useCMS();

  const heroBadge = (locale === "uz" ? hero?.badge_uz : hero?.badge_ru) || t.hero.badge;
  const heroTitle = (locale === "uz" ? hero?.title_uz : hero?.title_ru);
  const heroSubtitle = (locale === "uz" ? hero?.subtitle_uz : hero?.subtitle_ru) || t.hero.subtitle;

  const [cityOpen, setCityOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const cityOptions = ["Angren", "5-mavze", "Dukent", "Geolog", "Markaz"];
  const typeOptions: Array<{ key: PropertyType | "all"; label: string }> = [
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

  const getSelectedTypeLabel = () => {
    const found = typeOptions.find((o) => o.key === selectedType);
    return found ? found.label : t.searchBar.propertyType;
  };

  const getSelectedPriceLabel = () => {
    const found = priceOptions.find((o) => o.key === priceFilter);
    return found ? found.label : `${t.searchBar.price} (${currency})`;
  };

  return (
    <section className="relative w-full overflow-hidden bg-white pt-4 sm:pt-8 pb-10 sm:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Main Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Hero Content Column */}
          <div className="lg:col-span-6 z-10 space-y-5 sm:space-y-6">
            
            {/* Category Subhead */}
            <div className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase">
              {heroBadge}
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-brand-dark leading-[1.15]">
              {heroTitle ? (
                <span>{heroTitle}</span>
              ) : (
                <>
                  <span>{t.hero.headlineStart}</span>{" "}
                  <span className="text-brand-primary block sm:inline">
                    {t.hero.headlineAccent}
                  </span>{" "}
                  {t.hero.headlineEnd && <span>{t.hero.headlineEnd}</span>}
                </>
              )}
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-gray-500 max-w-lg leading-relaxed">
              {heroSubtitle}
            </p>

            {/* Buy / Rent Switcher Pills */}
            <div className="inline-flex items-center rounded-full bg-gray-100 p-1 border border-gray-200/60 shadow-inner">
              <button
                onClick={() => onTransactionChange("sale")}
                className={`rounded-full px-6 sm:px-8 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  transactionType === "sale"
                    ? "bg-brand-primary text-white shadow-card"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t.hero.buy}
              </button>
              <button
                onClick={() => onTransactionChange("rent")}
                className={`rounded-full px-6 sm:px-8 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  transactionType === "rent"
                    ? "bg-brand-primary text-white shadow-card"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t.hero.rent}
              </button>
            </div>

          </div>

          {/* Right Hero Image Column */}
          <div className="lg:col-span-6 relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-3xl overflow-hidden shadow-elevated border border-gray-100">
            <Image
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85"
              alt="ANGREN ESTATE Luxury Living"
              fill
              className="object-cover"
              priority
            />

            {/* Soft Left Gradient Overlay for seamless blending */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-black/20" />

            {/* Floating Top-Right Quote Badge (as in Desktop Reference) */}
            <div className="absolute top-6 right-6 hidden sm:flex flex-col items-start bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-white max-w-[210px] shadow-card">
              <span className="text-xs font-medium italic leading-snug">
                “{t.common.quoteText}”
              </span>
              <div className="w-10 h-0.5 bg-white/40 my-2 rounded-full" />
              <span className="text-[10px] tracking-wider font-extrabold uppercase text-white/90">
                ANGREN ESTATE
              </span>
            </div>
          </div>

        </div>

        {/* Floating Search & Filter Block (Overlapping Desktop & Vertical Mobile) */}
        <div className="mt-8 lg:-mt-10 relative z-20 mx-auto w-full max-w-5xl rounded-3xl bg-white p-3 sm:p-4 shadow-elevated border border-gray-200/80">
          
          {/* Desktop 4-Column Layout */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-3 items-center">
            
            {/* Column 1: Location */}
            <div className="sm:col-span-3 relative">
              <button
                onClick={() => {
                  setCityOpen(!cityOpen);
                  setTypeOpen(false);
                  setPriceOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm font-semibold text-gray-800 hover:border-brand-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <MapPin className="h-4 w-4 text-brand-primary shrink-0" />
                  <span className="truncate">{selectedCity}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${cityOpen ? "rotate-180" : ""}`} />
              </button>

              {cityOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-card z-50 animate-in fade-in">
                  {cityOptions.map((city) => (
                    <button
                      key={city}
                      onClick={() => {
                        onCityChange(city);
                        setCityOpen(false);
                      }}
                      className={`flex w-full items-center rounded-xl px-3 py-2 text-xs font-semibold ${
                        selectedCity === city ? "bg-brand-light text-brand-primary" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Property Type */}
            <div className="sm:col-span-3 relative">
              <button
                onClick={() => {
                  setTypeOpen(!typeOpen);
                  setCityOpen(false);
                  setPriceOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm font-semibold text-gray-800 hover:border-brand-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Home className="h-4 w-4 text-brand-primary shrink-0" />
                  <span className="truncate">{getSelectedTypeLabel()}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${typeOpen ? "rotate-180" : ""}`} />
              </button>

              {typeOpen && (
                <div className="absolute top-full left-0 mt-2 w-52 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-card z-50 animate-in fade-in">
                  {typeOptions.map((type) => (
                    <button
                      key={type.key}
                      onClick={() => {
                        onTypeChange(type.key);
                        setTypeOpen(false);
                      }}
                      className={`flex w-full items-center rounded-xl px-3 py-2 text-xs font-semibold ${
                        selectedType === type.key ? "bg-brand-light text-brand-primary" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column 3: Price */}
            <div className="sm:col-span-3 relative">
              <button
                onClick={() => {
                  setPriceOpen(!priceOpen);
                  setCityOpen(false);
                  setTypeOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/50 px-4 py-3 text-xs sm:text-sm font-semibold text-gray-800 hover:border-brand-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Coins className="h-4 w-4 text-brand-primary shrink-0" />
                  <span className="truncate">{getSelectedPriceLabel()}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${priceOpen ? "rotate-180" : ""}`} />
              </button>

              {priceOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-card z-50 animate-in fade-in">
                  {priceOptions.map((price) => (
                    <button
                      key={price.key}
                      onClick={() => {
                        onPriceFilterChange(price.key);
                        setPriceOpen(false);
                      }}
                      className={`flex w-full items-center rounded-xl px-3 py-2 text-xs font-semibold ${
                        priceFilter === price.key ? "bg-brand-light text-brand-primary" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {price.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Column 4: Search CTA Button */}
            <div className="sm:col-span-3">
              <button
                onClick={onSearch}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-primary px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-card hover:bg-brand-primary-hover active:scale-[0.98] transition-all"
              >
                <Search className="h-4 w-4" />
                <span>{t.searchBar.searchBtn}</span>
              </button>
            </div>

          </div>

          {/* Mobile Vertical Stacked Layout (Exact to Mobile Reference) */}
          <div className="sm:hidden flex flex-col space-y-2.5">
            
            {/* Row 1: Location */}
            <div className="relative">
              <button
                onClick={() => setCityOpen(!cityOpen)}
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200/90 bg-gray-50/50 px-4 py-3 text-xs font-semibold text-gray-800"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-brand-primary" />
                  <span>{selectedCity}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 ${cityOpen ? "rotate-180" : ""}`} />
              </button>

              {cityOpen && (
                <div className="mt-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-card">
                  {cityOptions.map((city) => (
                    <button
                      key={city}
                      onClick={() => {
                        onCityChange(city);
                        setCityOpen(false);
                      }}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 2: Property Type */}
            <div className="relative">
              <button
                onClick={() => setTypeOpen(!typeOpen)}
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200/90 bg-gray-50/50 px-4 py-3 text-xs font-semibold text-gray-800"
              >
                <div className="flex items-center gap-2.5">
                  <Home className="h-4 w-4 text-brand-primary" />
                  <span>{getSelectedTypeLabel()}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 ${typeOpen ? "rotate-180" : ""}`} />
              </button>

              {typeOpen && (
                <div className="mt-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-card">
                  {typeOptions.map((type) => (
                    <button
                      key={type.key}
                      onClick={() => {
                        onTypeChange(type.key);
                        setTypeOpen(false);
                      }}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 3: Price */}
            <div className="relative">
              <button
                onClick={() => setPriceOpen(!priceOpen)}
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200/90 bg-gray-50/50 px-4 py-3 text-xs font-semibold text-gray-800"
              >
                <div className="flex items-center gap-2.5">
                  <Coins className="h-4 w-4 text-brand-primary" />
                  <span>{getSelectedPriceLabel()}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 ${priceOpen ? "rotate-180" : ""}`} />
              </button>

              {priceOpen && (
                <div className="mt-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-card">
                  {priceOptions.map((price) => (
                    <button
                      key={price.key}
                      onClick={() => {
                        onPriceFilterChange(price.key);
                        setPriceOpen(false);
                      }}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {price.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row 4: Action Button */}
            <button
              onClick={onSearch}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-3.5 text-xs font-bold text-white shadow-card hover:bg-brand-primary-hover active:scale-[0.98] transition-all"
            >
              <Search className="h-4 w-4" />
              <span>{t.searchBar.searchBtn}</span>
            </button>

          </div>

        </div>

      </div>
    </section>
  );
}
