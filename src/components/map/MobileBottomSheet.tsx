"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, MapPin, Maximize2, Bed, Bath, Phone, Send, ArrowRight, Layers } from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { trackEvent } from "@/lib/analytics";

interface MobileBottomSheetProps {
  property: Property | null;
  totalCount: number;
  onClose: () => void;
  onViewDetails: (property: Property) => void;
  onSelectProperty?: (p: Property) => void;
  properties: Property[];
}

export function MobileBottomSheet({
  property,
  totalCount,
  onClose,
  onViewDetails,
  onSelectProperty,
  properties,
}: MobileBottomSheetProps) {
  const { locale, t } = useLanguage();
  const { currency } = useCurrency();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFavorited = property ? isFavorite(property.id) : false;

  if (!property) {
    // Show compact floating pill when no marker is selected
    return (
      <div className="sm:hidden fixed bottom-20 left-4 right-4 z-30 pointer-events-auto">
        <div className="flex items-center justify-between rounded-2xl bg-white/90 backdrop-blur-xl p-3 shadow-elevated border border-white/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-xs font-bold text-brand-dark">
              {t.mapSection.objectsOnMap(totalCount)}
            </span>
          </div>
          <span className="text-[11px] font-medium text-gray-500">
            {t.mapSection.selectMarkerNotice}
          </span>
        </div>
      </div>
    );
  }

  const title = locale === "uz" ? property.title_uz : property.title_ru;
  const address = locale === "uz" ? property.address_uz : property.address_ru;
  const isSale = property.transaction_type === "sale";
  const badgeText = isSale ? t.popular.saleBadge : t.popular.rentBadge;

  const priceDisplay = isSale
    ? currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} UZS`
      : `$${Math.round(property.price_uzs / 12800).toLocaleString("ru-RU")}`
    : currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} UZS / ${t.common.month}`
      : `$${Math.round(property.price_uzs / 12800).toLocaleString("ru-RU")} / ${t.common.month}`;

  const floorNum = property.floor_number ?? property.floor;
  const totalFloors = property.floors ?? property.total_floors;

  const getPropertyTypeLabel = (type: string, loc: string) => {
    switch (type) {
      case "apartment":
        return loc === "uz" ? "Kvartira" : "Квартира";
      case "house_yard":
        return loc === "uz" ? "Hovli / Uy" : "Дом / Участок";
      case "new_build":
        return loc === "uz" ? "Yangi bino" : "Новостройка";
      case "land":
        return loc === "uz" ? "Yer uchastkasi" : "Земельный участок";
      case "commercial":
        return loc === "uz" ? "Tijorat mulki" : "Коммерческая";
      default:
        return loc === "uz" ? "Ko‘chmas mulk" : "Недвижимость";
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (property) toggleFavorite(property);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="sm:hidden fixed bottom-16 left-0 right-0 z-30 pointer-events-auto rounded-t-3xl bg-white/95 backdrop-blur-xl shadow-float border-t border-white/80 overflow-hidden"
      >
        {/* iOS Drag Handle Bar */}
        <div className="flex items-center justify-center pt-2.5 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Sheet Content */}
        <div className="p-4 pt-1 space-y-2.5">
          <div className="flex gap-3.5">
            {/* Property Thumbnail */}
            <div
              onClick={() => onViewDetails(property)}
              className="relative h-24 w-28 shrink-0 rounded-2xl overflow-hidden bg-gray-100 cursor-pointer"
            >
              <Image
                src={property.images[0]}
                alt={title}
                fill
                className="object-cover"
              />
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                <span className="rounded-lg bg-brand-primary px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  {badgeText}
                </span>
                <span className="rounded-lg bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  {getPropertyTypeLabel(property.property_type, locale)}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-base font-extrabold tracking-tight text-brand-dark leading-tight">
                    {priceDisplay}
                  </div>
                  <button
                    onClick={onClose}
                    className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3
                  onClick={() => onViewDetails(property)}
                  className="text-xs font-bold text-gray-800 line-clamp-1 pt-0.5 cursor-pointer hover:text-brand-primary"
                >
                  {title}
                </h3>
                <div className="flex items-center gap-1 text-[10px] text-gray-500 pt-0.5">
                  <MapPin className="h-3 w-3 shrink-0 text-brand-primary" />
                  <span className="truncate">{address}</span>
                </div>
              </div>

              {/* Specs */}
              <div className="flex items-center gap-3 text-[10px] font-semibold text-gray-600 pt-1">
                <div className="flex items-center gap-1">
                  <Maximize2 className="h-3 w-3 text-gray-400" />
                  <span>{property.area_sqm} {t.common.sqm}</span>
                </div>
                {property.rooms && (
                  <div className="flex items-center gap-1">
                    <Bed className="h-3 w-3 text-gray-400" />
                    <span>{property.rooms}</span>
                  </div>
                )}
                {floorNum ? (
                  <div className="flex items-center gap-1">
                    <Layers className="h-3 w-3 text-gray-400" />
                    <span>{floorNum}{totalFloors ? `/${totalFloors}` : ""}-{locale === "uz" ? "qavat" : "эт."}</span>
                  </div>
                ) : property.bathrooms ? (
                  <div className="flex items-center gap-1">
                    <Bath className="h-3 w-3 text-gray-400" />
                    <span>{property.bathrooms}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* "Batafsil ko'rish" Button */}
          <button
            onClick={() => onViewDetails(property)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2 text-xs font-bold text-white shadow-card active:scale-[0.98] transition-all"
          >
            <span>{t.mapSection.viewDetails}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          {/* Action Row: Call, Telegram, Favorite */}
          <div className="flex items-center gap-2">
            <a
              href={`tel:${property.contact_phone}`}
              onClick={() =>
                trackEvent("phone_click", {
                  property_id: property.id,
                  metadata: { phone: property.contact_phone },
                })
              }
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white/90 py-2 text-xs font-bold text-gray-700 shadow-sm active:scale-[0.98]"
            >
              <Phone className="h-3.5 w-3.5 text-brand-primary" />
              <span>{t.propertyCard.call}</span>
            </a>
            <a
              href={`https://t.me/${property.contact_telegram ? property.contact_telegram.replace("@", "") : "angrenestate"}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackEvent("telegram_click", {
                  property_id: property.id,
                  metadata: { telegram: property.contact_telegram },
                })
              }
              className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white/90 py-2 text-xs font-bold text-gray-700 shadow-sm active:scale-[0.98]"
            >
              <Send className="h-3.5 w-3.5 text-brand-primary" />
              <span>Telegram</span>
            </a>
            <button
              onClick={handleFavoriteClick}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white/90 text-gray-700 shadow-sm"
            >
              <Heart
                className={`h-4 w-4 ${isFavorited ? "fill-red-500 text-red-500" : "text-gray-400"}`}
              />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
