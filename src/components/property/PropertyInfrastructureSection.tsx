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
  ChevronDown,
  ChevronUp,
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
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Auto-expand first category when data arrives if none are expanded
  useEffect(() => {
    if (summaries.length > 0) {
      setExpandedCategories((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [summaries[0].category]: true };
        }
        return prev;
      });
    }
  }, [summaries]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

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

      {/* Category-Grouped Expandable Infrastructure List */}
      <div className="space-y-2">
        {summaries.map((s) => {
          const isOpen = Boolean(expandedCategories[s.category]);
          const sortedItems = [...s.items].sort((a, b) => a.distanceMeters - b.distanceMeters);

          return (
            <div
              key={s.category}
              className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden transition-all shadow-2xs hover:border-emerald-300"
            >
              {/* Category Header Row: Icon, Category Name, Count */}
              <button
                type="button"
                onClick={() => toggleCategory(s.category)}
                className="w-full flex items-center justify-between p-3 sm:p-3.5 text-left transition-colors hover:bg-slate-50/70 select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="p-1.5 rounded-xl bg-slate-100/90 text-slate-700 shrink-0">
                    {getCategoryIcon(s.category)}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                      {locale === "uz" ? s.labelUz : s.labelRu}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      —
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#16543C] text-[11px] font-black shrink-0">
                      {s.count}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                    {locale === "uz" ? `Eng yaqini: ${s.closestDistance}` : `Ближайший: ${s.closestDistance}`}
                  </span>
                  <div className={`p-1 rounded-lg text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-emerald-700" : ""}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {/* Items List Inside Expanded Category: Real name, category, distance (sorted nearest to farthest) */}
              {isOpen && (
                <div className="px-3 sm:px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50 divide-y divide-slate-100/80">
                  {sortedItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono font-bold text-slate-400 w-4 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 truncate block">
                            {locale === "uz" ? item.nameUz : item.nameRu}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 truncate block">
                            {getCategoryLabel(item.category)}
                          </span>
                        </div>
                      </div>
                      <span className="font-black text-[#16543C] shrink-0 text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                        {item.formattedDistance}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
