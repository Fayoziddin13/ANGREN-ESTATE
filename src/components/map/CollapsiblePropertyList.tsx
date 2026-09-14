"use client";

import React from "react";
import Image from "next/image";
import { X, MapPin, Maximize2, Bed, Bath, ArrowRight } from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";

interface CollapsiblePropertyListProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  selectedProperty: Property | null;
  onSelectProperty: (property: Property) => void;
  onViewDetails: (property: Property) => void;
}

export function CollapsiblePropertyList({
  isOpen,
  onClose,
  properties,
  selectedProperty,
  onSelectProperty,
  onViewDetails,
}: CollapsiblePropertyListProps) {
  const { locale, t } = useLanguage();
  const { currency, exchangeRate } = useCurrency();

  if (!isOpen) return null;

  return (
    <div className="hidden lg:flex flex-col fixed top-24 right-6 bottom-6 w-96 z-30 pointer-events-auto rounded-3xl bg-white/90 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-extrabold text-brand-dark">
            {t.mapSection.listToggle}
          </h2>
          <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-bold text-brand-primary">
            {properties.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-gray-50">
        {properties.map((p) => {
          const isSelected = selectedProperty?.id === p.id;
          const title = locale === "uz" ? p.title_uz : p.title_ru;
          const address = locale === "uz" ? p.address_uz : p.address_ru;
          const isSale = p.transaction_type === "sale";

          const priceDisplay = isSale
            ? currency === "UZS"
              ? `${p.price_uzs.toLocaleString("ru-RU")} UZS`
              : `$${Math.round(p.price_uzs / exchangeRate).toLocaleString("ru-RU")}`
            : currency === "UZS"
              ? `${p.price_uzs.toLocaleString("ru-RU")} UZS / ${t.common.month}`
              : `$${Math.round(p.price_uzs / exchangeRate).toLocaleString("ru-RU")} / ${t.common.month}`;

          return (
            <div
              key={p.id}
              onClick={() => onSelectProperty(p)}
              className={`group flex gap-3 p-2.5 rounded-2xl cursor-pointer transition-all ${
                isSelected
                  ? "bg-brand-light/70 ring-2 ring-brand-primary"
                  : "hover:bg-gray-50/80"
              }`}
            >
              <div className="relative h-20 w-24 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <Image
                  src={p.images[0]}
                  alt={title}
                  fill
                  sizes="100px"
                  className="object-cover"
                />
                <span className="absolute top-1 left-1 rounded-md bg-brand-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {isSale ? t.popular.saleBadge : t.popular.rentBadge}
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="text-xs font-extrabold text-brand-dark truncate">
                    {priceDisplay}
                  </div>
                  <h3 className="text-xs font-semibold text-gray-800 truncate group-hover:text-brand-primary transition-colors">
                    {title}
                  </h3>
                  <p className="text-[10px] text-gray-500 truncate">{address}</p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{p.area_sqm} m²</span>
                    {p.rooms && <span>• {p.rooms} xona</span>}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(p);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-brand-primary hover:underline"
                  >
                    <span>{t.propertyCard.details}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
