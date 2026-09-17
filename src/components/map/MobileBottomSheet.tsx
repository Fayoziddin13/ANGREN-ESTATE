"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Heart,
  MapPin,
  Maximize2,
  Bed,
  Bath,
  Phone,
  Send,
  ArrowRight,
  Layers,
  Calendar,
  Box,
  Navigation,
  LocateFixed,
  Map,
} from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { trackEvent } from "@/lib/analytics";
import { formatPublishedDate } from "@/lib/dateFormat";
import { getPropertyTitle, getPropertyAddress, getPropertyTypeLabel } from "@/lib/propertyFormatters";
import { useMapDimension, useMapMode, MapMode } from "@/lib/mapStore";

interface MobileBottomSheetProps {
  property: Property | null;
  totalCount: number;
  onClose: () => void;
  onViewDetails: (property: Property) => void;
  onSelectProperty?: (p: Property) => void;
  properties: Property[];
  mapMode?: "standard" | "satellite";
  onMapModeChange?: (mode: "standard" | "satellite") => void;
}

export function MobileBottomSheet({
  property,
  totalCount,
  onClose,
  onViewDetails,
  onSelectProperty,
  properties,
  mapMode,
  onMapModeChange,
}: MobileBottomSheetProps) {
  const { locale, t } = useLanguage();
  const { currency, exchangeRate } = useCurrency();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFavorited = property ? isFavorite(property.id) : false;

  const [mapDimension] = useMapDimension();
  const [storedMode, setStoredMode] = useMapMode();
  const activeMapMode: MapMode = mapMode || storedMode;

  const handleToggle3D = () => {
    window.dispatchEvent(new CustomEvent("angren_map_toggle_3d"));
  };

  const handleUserLocation = () => {
    window.dispatchEvent(new CustomEvent("angren_map_user_location"));
  };

  const handleToggleMode = () => {
    const nextMode: MapMode = activeMapMode === "satellite" ? "standard" : "satellite";
    if (onMapModeChange) {
      onMapModeChange(nextMode);
    }
    setStoredMode(nextMode);
  };

  const handleResetCenter = () => {
    window.dispatchEvent(new CustomEvent("angren_map_reset_center"));
  };

  if (!property) {
    // Ultra-compact Mobile Map Bottom Control Row
    return (
      <div
        data-testid="mobile-map-control-row"
        className="sm:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-30 pointer-events-auto flex items-center justify-between px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-xl shadow-float border border-white/80"
      >
        {/* Subtle compact object count badge on the left */}
        <div
          data-testid="mobile-object-count-badge"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50/90 border border-emerald-200/60 text-[#16543C] shrink-0"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-black tracking-tight">{totalCount}</span>
        </div>

        {/* 4 Icon-Only Controls on the right */}
        <div className="flex items-center gap-2">
          {/* 1. 3D (Icon only) */}
          <button
            type="button"
            data-testid="mobile-panel-toggle-3d"
            onClick={handleToggle3D}
            aria-label="3D"
            title="3D"
            className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
              mapDimension === "3d"
                ? "bg-[#16543C] text-white shadow-sm ring-2 ring-emerald-500/30"
                : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80"
            }`}
          >
            <Box className="h-5 w-5" />
          </button>

          {/* 2. Location (Icon only) */}
          <button
            type="button"
            data-testid="mobile-panel-user-location"
            onClick={handleUserLocation}
            aria-label={locale === "uz" ? "Joylashuv" : "Местоположение"}
            title={locale === "uz" ? "Joylashuv" : "Местоположение"}
            className="h-10 w-10 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 text-[#16543C] flex items-center justify-center transition-all active:scale-95"
          >
            <Navigation className="h-5 w-5 text-[#16543C]" />
          </button>

          {/* 3. Map (Scheme ↔ Satellite single toggle, Icon only) */}
          <button
            type="button"
            data-testid="mobile-panel-toggle-mode"
            onClick={handleToggleMode}
            aria-label={locale === "uz" ? "Xarita" : "Карта"}
            title={locale === "uz" ? "Xarita" : "Карта"}
            className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
              activeMapMode === "satellite"
                ? "bg-[#16543C] text-white shadow-sm ring-2 ring-emerald-500/30"
                : "bg-slate-100/90 text-[#16543C] hover:bg-slate-200/80"
            }`}
          >
            {activeMapMode === "satellite" ? (
              <Layers className="h-5 w-5" />
            ) : (
              <Map className="h-5 w-5 text-[#16543C]" />
            )}
          </button>

          {/* 4. Center (Icon only) */}
          <button
            type="button"
            data-testid="mobile-panel-reset-center"
            onClick={handleResetCenter}
            aria-label={locale === "uz" ? "Markaz" : "Центр"}
            title={locale === "uz" ? "Markaz" : "Центр"}
            className="h-10 w-10 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 text-[#16543C] flex items-center justify-center transition-all active:scale-95"
          >
            <LocateFixed className="h-5 w-5 text-[#16543C]" />
          </button>
        </div>
      </div>
    );
  }

  const title = getPropertyTitle(property, locale);
  const address = getPropertyAddress(property, locale);
  const isSale = property.transaction_type === "sale";
  const badgeText = isSale ? t.popular.saleBadge : t.popular.rentBadge;

  const priceDisplay = isSale
    ? currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} UZS`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}`
    : currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} UZS / ${t.common.month}`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")} / ${t.common.month}`;

  const floorNum = property.floor_number ?? property.floor;
  const totalFloors = property.floors ?? property.total_floors;
  const isHouse = property.property_type === "house_yard" || property.property_type === "land";
  const publishedDateStr = formatPublishedDate(property.published_at || property.created_at, locale, true);


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
                <span
                  className={`rounded-lg px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm ${
                    isSale ? "bg-[#16543C]" : "bg-[#1D4ED8]"
                  }`}
                >
                  {badgeText}
                </span>
                <span className="rounded-lg bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  {getPropertyTypeLabel(property.property_type, locale)}
                </span>
                {isHouse && property.area_sotikh && (
                  <span className="rounded-lg bg-emerald-950/80 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-emerald-200 shadow-sm">
                    {property.area_sotikh} {locale === "uz" ? "sotix" : "сот."}
                  </span>
                )}
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

              {/* Specs & Published Date */}
              <div className="flex items-center justify-between text-[10px] font-semibold text-gray-600 pt-1">
                {property.property_type === "land" ? (
                  <div className="flex items-center gap-2">
                    {property.area_sotikh ? (
                      <span className="font-bold text-[#16543C]">{property.area_sotikh} {locale === "uz" ? "sotix" : "сот."}</span>
                    ) : null}
                    {property.dimensions || (property.facade_m && property.depth_m) ? (
                      <span className="text-gray-500 font-medium">
                        {property.dimensions || `${property.facade_m} × ${property.depth_m} ${locale === "uz" ? "m" : "м"}`}
                      </span>
                    ) : null}
                  </div>
                ) : isHouse ? (
                  <div className="flex items-center gap-2">
                    {property.area_sotikh ? (
                      <span className="font-bold text-[#16543C]">{property.area_sotikh} {locale === "uz" ? "sotix" : "сот."}</span>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <Maximize2 className="h-3 w-3 text-gray-400" />
                      <span>{locale === "uz" ? "Uy" : "Дом"}: {property.area_sqm} {locale === "uz" ? "m²" : "м²"}</span>
                    </div>
                    {property.rooms && (
                      <div className="flex items-center gap-1">
                        <Bed className="h-3 w-3 text-gray-400" />
                        <span>{property.rooms}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {floorNum ? (
                      <div className="flex items-center gap-1 font-bold text-gray-700">
                        <Layers className="h-3 w-3 text-brand-primary" />
                        <span>{floorNum}{totalFloors ? `/${totalFloors}` : ""} {locale === "uz" ? "qavat" : "эт."}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <Maximize2 className="h-3 w-3 text-gray-400" />
                      <span>{property.area_sqm} {locale === "uz" ? "m²" : "м²"}</span>
                    </div>
                    {property.rooms && (
                      <div className="flex items-center gap-1">
                        <Bed className="h-3 w-3 text-gray-400" />
                        <span>{property.rooms}</span>
                      </div>
                    )}
                  </div>
                )}

                {publishedDateStr && (
                  <div className="flex items-center gap-1 text-[9px] text-gray-400 font-medium">
                    <Calendar className="h-2.5 w-2.5 text-gray-400" />
                    <span>{publishedDateStr}</span>
                  </div>
                )}
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
