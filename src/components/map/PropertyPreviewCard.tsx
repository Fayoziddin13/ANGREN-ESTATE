"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Heart, MapPin, Maximize2, Bed, Bath, ArrowRight, Phone, Send, Layers, Calendar } from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { trackEvent } from "@/lib/analytics";
import { formatPublishedDate } from "@/lib/dateFormat";
import { getPropertyTitle, getPropertyAddress, getPropertyTypeLabel } from "@/lib/propertyFormatters";

interface PropertyPreviewCardProps {
  property: Property;
  onClose: () => void;
  onViewDetails: (property: Property) => void;
  className?: string;
}

export function PropertyPreviewCard({
  property,
  onClose,
  onViewDetails,
  className = "",
}: PropertyPreviewCardProps) {
  const { locale, t } = useLanguage();
  const { currency, exchangeRate } = useCurrency();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFavorited = isFavorite(property.id);

  const title = getPropertyTitle(property, locale);
  const address = getPropertyAddress(property, locale);
  const isSale = property.transaction_type === "sale";
  const badgeText = isSale ? t.popular.saleBadge : t.popular.rentBadge;

  const uzsSuffix = locale === "uz" ? "so‘m" : "сум";
  const monthSuffix = isSale ? "" : ` / ${locale === "uz" ? "oy" : "мес"}`;

  const priceDisplay = isSale
    ? currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} ${uzsSuffix}`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}`
    : currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} ${uzsSuffix}${monthSuffix}`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}${monthSuffix}`;

  const floorNum = property.floor_number ?? property.floor;
  const totalFloors = property.floors ?? property.total_floors;
  const isHouse = property.property_type === "house_yard" || property.property_type === "land";
  const publishedDateStr = formatPublishedDate(property.published_at || property.created_at, locale, true);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(property);
  };

  return (
    <div
      className={`pointer-events-auto relative w-80 sm:w-92 rounded-2xl bg-white/95 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${className}`}
    >
      {/* Top Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-all shadow-xs active:scale-95"
        aria-label="Close"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Property Image with Clickable trigger for details */}
      <div
        onClick={() => onViewDetails(property)}
        className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100 cursor-pointer group"
      >
        <Image
          src={property.images[0]}
          alt={title}
          fill
          sizes="400px"
          loading="lazy"
          priority={false}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Photo Counter Badge */}
        {property.images && property.images.length > 0 && (
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold shadow-xs">
            <Maximize2 className="w-3 h-3" />
            <span>1 / {property.images.length}</span>
          </div>
        )}

        {/* Transaction & Property Type Badges */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
          <span
            className={`rounded-lg px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-white shadow-xs ${
              isSale ? "bg-[#0c2e1f]" : "bg-[#1D4ED8]"
            }`}
          >
            {badgeText}
          </span>
          <span className="rounded-lg bg-white/90 backdrop-blur-md px-2 py-0.5 text-[10.5px] font-semibold text-gray-800 shadow-xs">
            {getPropertyTypeLabel(property.property_type, locale)}
          </span>
          {property.area_sotikh && (property.property_type === "house_yard" || property.property_type === "land") && (
            <span className="rounded-lg bg-[#0c2e1f]/80 backdrop-blur-md px-1.5 py-0.5 text-[10.5px] font-semibold text-white/80 shadow-xs">
              {property.area_sotikh} {locale === "uz" ? "sotix" : "соток"}
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          className="absolute bottom-2.5 left-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white shadow-xs hover:scale-110 active:scale-95 transition-all"
        >
          <Heart
            className={`h-3.5 w-3.5 transition-colors ${
              isFavorited ? "fill-red-500 text-red-500" : "text-white"
            }`}
          />
        </button>
      </div>

      {/* Body Content */}
      <div className="p-3.5 space-y-2.5">
        <div className="cursor-pointer" onClick={() => onViewDetails(property)}>
          <div className="text-base sm:text-lg font-extrabold tracking-tight text-[#0c2e1f]">
            {priceDisplay}
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 hover:text-[#19573c] transition-colors">
            {title}
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 pt-0.5">
            <MapPin className="h-3 w-3 shrink-0 text-[#0c2e1f]" />
            <span className="truncate">{address}</span>
          </div>
        </div>

        {/* Specs Row & Published Date */}
        <div className="flex items-center justify-between border-t border-[#e2e9e6] pt-2 text-[11px] font-semibold text-gray-600">
          {property.property_type === "land" ? (
            <div className="flex items-center gap-2">
              {property.area_sotikh ? (
                <span className="font-bold text-[#0c2e1f]">
                  {property.area_sotikh} {locale === "uz" ? "sotix" : "соток"}
                </span>
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
                <span className="font-bold text-[#0c2e1f]">
                  {property.area_sotikh} {locale === "uz" ? "sotix" : "соток"}
                </span>
              ) : null}
              <div className="flex items-center gap-1">
                <Maximize2 className="h-3.5 w-3.5 text-gray-400" />
                <span>{locale === "uz" ? "Uy" : "Дом"}: {property.area_sqm} {t.common.sqm}</span>
              </div>
              {property.rooms ? (
                <div className="flex items-center gap-1">
                  <Bed className="h-3.5 w-3.5 text-gray-400" />
                  <span>{property.rooms}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {floorNum ? (
                <div className="flex items-center gap-1 font-bold text-gray-700">
                  <Layers className="h-3.5 w-3.5 text-[#19573c]" />
                  <span>{floorNum}{totalFloors ? `/${totalFloors}` : ""} {locale === "uz" ? "qavat" : "эт."}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-1">
                <Maximize2 className="h-3.5 w-3.5 text-gray-400" />
                <span>{property.area_sqm} {t.common.sqm}</span>
              </div>
              {property.rooms ? (
                <div className="flex items-center gap-1">
                  <Bed className="h-3.5 w-3.5 text-gray-400" />
                  <span>{property.rooms}</span>
                </div>
              ) : null}
            </div>
          )}

          {/* Published Date */}
          {publishedDateStr && (
            <div className="flex items-center gap-1 text-[10.5px] text-gray-400 font-medium">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span>{publishedDateStr}</span>
            </div>
          )}
        </div>

        {/* "Batafsil ko'rish" Main Button */}
        <button
          onClick={() => onViewDetails(property)}
          className="group w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#0c2e1f] py-2 text-xs font-bold text-white shadow-card hover:bg-[#19573c] active:scale-[0.98] transition-all"
        >
          <span>{t.mapSection.viewDetails}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Call & Telegram Quick Links */}
        <div className="flex items-center gap-2 pt-0.5">
          <a
            href={`tel:${property.contact_phone}`}
            onClick={() =>
              trackEvent("phone_click", {
                property_id: property.id,
                metadata: { phone: property.contact_phone },
              })
            }
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white/80 py-2 text-xs font-bold text-gray-700 hover:bg-white hover:text-brand-primary transition-colors shadow-sm"
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
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white/80 py-2 text-xs font-bold text-gray-700 hover:bg-white hover:text-brand-primary transition-colors shadow-sm"
          >
            <Send className="h-3.5 w-3.5 text-brand-primary" />
            <span>Telegram</span>
          </a>
        </div>
      </div>
    </div>
  );
}
