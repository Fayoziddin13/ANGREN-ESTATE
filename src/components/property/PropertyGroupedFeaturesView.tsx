"use client";

import React from "react";
import {
  Flame,
  Zap,
  Droplets,
  Thermometer,
  Wifi,
  Warehouse,
  Trees,
  Archive,
  Home,
  Waves,
  Building,
  DoorClosed,
  Wind,
  Armchair,
  Check,
  Sparkles,
  Layers,
  Sparkle,
  Compass,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Property } from "@/lib/types";
import {
  extractPropertyFeatures,
  getFeatureCategoryOrder,
  CATEGORY_TITLES,
  PropertyFeatureItem,
  FeatureCategory,
} from "@/lib/propertyFeatures";

interface PropertyGroupedFeaturesViewProps {
  property: Property;
  className?: string;
}

function getFeatureIcon(iconName: string) {
  switch (iconName) {
    case "Flame":
      return <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />;
    case "Zap":
      return <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />;
    case "Droplets":
      return <Droplets className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600" />;
    case "Thermometer":
      return <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />;
    case "Wifi":
      return <Wifi className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />;
    case "Warehouse":
      return <Warehouse className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0c2e1f]" />;
    case "Trees":
      return <Trees className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#19573c]" />;
    case "Archive":
      return <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />;
    case "Home":
      return <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700" />;
    case "Waves":
      return <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-600" />;
    case "Building":
      return <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />;
    case "DoorClosed":
      return <DoorClosed className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#19573c]" />;
    case "Wind":
      return <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500" />;
    case "Armchair":
      return <Armchair className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-800" />;
    case "ParkingSquare":
      return <span className="text-[11px] font-black text-blue-600 w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center">P</span>;
    case "Sparkles":
      return <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />;
    default:
      return <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0c2e1f]" />;
  }
}

function getCategoryIcon(cat: FeatureCategory) {
  switch (cat) {
    case "communications":
      return <Zap className="w-4 h-4 text-[#0c2e1f]" />;
    case "extra_objects":
      return <Building className="w-4 h-4 text-[#0c2e1f]" />;
    case "advantages":
      return <Sparkles className="w-4 h-4 text-[#0c2e1f]" />;
  }
}

export function PropertyGroupedFeaturesView({
  property,
  className = "",
}: PropertyGroupedFeaturesViewProps) {
  const { locale } = useLanguage();

  const grouped = extractPropertyFeatures(property, locale);
  const order = getFeatureCategoryOrder(property.property_type);

  const categoryMap: Record<FeatureCategory, PropertyFeatureItem[]> = {
    communications: grouped.communications,
    extra_objects: grouped.extraObjects,
    advantages: grouped.advantages,
  };

  // Check if at least one category has items
  const hasAnyItems =
    grouped.communications.length > 0 ||
    grouped.extraObjects.length > 0 ||
    grouped.advantages.length > 0;

  if (!hasAnyItems) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {order.map((cat) => {
        const items = categoryMap[cat];
        // Rule 5: Empty section must NEVER be shown
        if (!items || items.length === 0) return null;

        const title =
          locale === "uz" ? CATEGORY_TITLES[cat].uz : CATEGORY_TITLES[cat].ru;

        return (
          <div
            key={cat}
            data-testid={`feature-section-${cat}`}
            className="space-y-3 pt-4 first:pt-0 border-t first:border-t-0 border-gray-100 min-w-0"
          >
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getCategoryIcon(cat)}
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
                  {title}
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#e5f0eb]/50 text-[#0c2e1f]">
                {items.length} {locale === "uz" ? "ta" : "ед."}
              </span>
            </div>

            {/* Grid of Items */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {items.map((item) => (
                <div
                  key={item.key}
                  data-testid={`feature-item-${item.key}`}
                  className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-white border border-slate-100/90 shadow-2xs hover:border-[#c2d3c9] transition-all min-w-0"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/60 shrink-0">
                    {getFeatureIcon(item.iconName)}
                  </div>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {locale === "uz" ? item.labelUz : item.labelRu}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
