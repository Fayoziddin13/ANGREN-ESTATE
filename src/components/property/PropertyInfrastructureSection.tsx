"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  GraduationCap,
  Cross,
  ShoppingCart,
  Trees,
  Bus,
  Stethoscope,
  CreditCard,
  Building2,
  BookOpen,
  Utensils,
  MapPin,
  MapPinOff,
  Compass,
  Loader2,
  Sparkles,
  Fuel,
  Dumbbell,
  Shield,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  fetchNearbyInfrastructure,
  getInfrastructureAround,
  MAX_INFRASTRUCTURE_RADIUS_METERS,
} from "@/lib/infrastructureService";
import { POICategory, POIItem, InfrastructureSummary } from "@/lib/types";

interface PropertyInfrastructureSectionProps {
  latitude: number;
  longitude: number;
  className?: string;
  showEmptyState?: boolean;
}

export function PropertyInfrastructureSection({
  latitude,
  longitude,
  className = "",
  showEmptyState = false,
}: PropertyInfrastructureSectionProps) {
  const { locale } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<POICategory | "all">("all");
  const [summaries, setSummaries] = useState<InfrastructureSummary[]>(() =>
    getInfrastructureAround(latitude, longitude, MAX_INFRASTRUCTURE_RADIUS_METERS, locale)
  );
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch real infrastructure from server API when coordinates change
  useEffect(() => {
    let isMounted = true;
    if (!latitude || !longitude) {
      setSummaries([]);
      return;
    }

    // Immediately calculate synchronous 1km fallback to prevent layout flash
    const initial = getInfrastructureAround(
      latitude,
      longitude,
      MAX_INFRASTRUCTURE_RADIUS_METERS,
      locale
    );
    setSummaries(initial);

    // Then fetch from server (with Yandex Organization Search & cache)
    setLoading(true);
    fetchNearbyInfrastructure(latitude, longitude, locale)
      .then((res) => {
        if (isMounted && res && Array.isArray(res.summaries)) {
          setSummaries(res.summaries);
        }
      })
      .catch((err) => {
        console.warn("[PropertyInfrastructureSection] Fetch error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, locale]);

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
      case "bank":
        return <Building2 className="h-4 w-4 text-blue-700" />;
      case "education":
        return <BookOpen className="h-4 w-4 text-indigo-600" />;
      case "restaurant":
        return <Utensils className="h-4 w-4 text-orange-600" />;
      case "gas_station":
        return <Fuel className="h-4 w-4 text-amber-600" />;
      case "sport":
        return <Dumbbell className="h-4 w-4 text-sky-600" />;
      case "police":
        return <Shield className="h-4 w-4 text-slate-800" />;
      default:
        return <MapPin className="h-4 w-4 text-slate-500" />;
    }
  };

  const getCategoryLabel = (category: POICategory) => {
    const summary = summaries.find((s) => s.category === category);
    if (summary) {
      return locale === "uz" ? summary.labelUz : summary.labelRu;
    }
    return category;
  };

  // Flatten and sort all items strictly within 1km
  const allItems = useMemo(() => {
    const list: POIItem[] = [];
    summaries.forEach((s) => {
      s.items.forEach((item) => {
        if (item.distanceMeters <= MAX_INFRASTRUCTURE_RADIUS_METERS) {
          list.push(item);
        }
      });
    });
    return list.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [summaries]);

  // Filter by selected category
  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return allItems;
    return allItems.filter((i) => i.category === selectedCategory);
  }, [allItems, selectedCategory]);

  const totalCount = allItems.length;

  // HARD RULE: Do NOT show the infrastructure section if there are zero results on public detail
  if (!loading && totalCount === 0 && !showEmptyState) {
    return null;
  }

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 sm:h-5 sm:w-5 text-[#16543C]" />
          <h3 className="text-sm sm:text-base font-black text-slate-900">
            {locale === "uz" ? "Yaqin infratuzilma" : "Ближайшая инфраструктура"}
          </h3>
          {totalCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#16543C]">
              {totalCount} {locale === "uz" ? "ta maskan" : "объектов"}
            </span>
          )}
        </div>
        <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
          {locale === "uz" ? "Maksimum 1 km radius" : "В радиусе до 1 км"}
        </span>
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs font-bold text-emerald-800 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
          <span>
            {locale === "uz"
              ? "Atrofdagi infratuzilma aniqlanmoqda..."
              : "Определяем инфраструктуру рядом..."}
          </span>
        </div>
      )}

      {/* Empty State */}
      {!loading && totalCount === 0 && showEmptyState && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1">
          <MapPinOff className="w-5 h-5 mx-auto text-slate-400" />
          <p className="text-xs font-bold text-slate-600">
            {locale === "uz"
              ? "1 km radiusda infratuzilma topilmadi."
              : "В радиусе 1 км инфраструктура не найдена."}
          </p>
        </div>
      )}

      {/* Categories Filter Pills */}
      {totalCount > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-2.5 py-1 rounded-xl font-bold whitespace-nowrap transition-all text-[11px] ${
              selectedCategory === "all"
                ? "bg-[#16543C] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {locale === "uz" ? "Barchasi" : "Все"} ({totalCount})
          </button>
          {summaries.map((s) => (
            <button
              key={s.category}
              type="button"
              onClick={() =>
                setSelectedCategory(selectedCategory === s.category ? "all" : s.category)
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold whitespace-nowrap transition-all text-[11px] ${
                selectedCategory === s.category
                  ? "bg-[#16543C] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className="shrink-0">{getCategoryIcon(s.category)}</span>
              <span>{locale === "uz" ? s.labelUz : s.labelRu}</span>
              <span className="opacity-75">({s.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Individual Real Infrastructure Items (Icon, Real Name, Category, Exact Distance) */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs hover:border-emerald-200/80 transition-all min-w-0"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/60 shrink-0">
                  {getCategoryIcon(item.category)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {locale === "uz" ? item.nameUz : item.nameRu}
                  </div>
                  <div className="text-[10px] font-medium text-slate-400 truncate">
                    {getCategoryLabel(item.category)}
                  </div>
                </div>
              </div>
              <span className="text-xs font-black text-[#16543C] bg-emerald-50/80 px-2 py-1 rounded-md shrink-0 whitespace-nowrap">
                {item.formattedDistance}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
