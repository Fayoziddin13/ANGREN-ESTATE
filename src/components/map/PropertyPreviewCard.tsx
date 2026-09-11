"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Heart, MapPin, Maximize2, Bed, Bath, ArrowRight, Phone, Send, Layers } from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { trackEvent } from "@/lib/analytics";

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
  const { currency } = useCurrency();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFavorited = isFavorite(property.id);

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
    toggleFavorite(property);
  };

  return (
    <div
      className={`pointer-events-auto relative w-80 sm:w-96 rounded-3xl bg-white/90 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${className}`}
    >
      {/* Top Close Button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-all shadow-sm active:scale-95"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Property Image with Clickable trigger for details */}
      <div
        onClick={() => onViewDetails(property)}
        className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100 cursor-pointer group"
      >
        <Image
          src={property.images[0]}
          alt={title}
          fill
          sizes="400px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Transaction & Property Type Badges */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          <span className="rounded-xl bg-brand-primary px-3 py-1 text-xs font-bold tracking-wide text-white shadow-sm">
            {badgeText}
          </span>
          <span className="rounded-xl bg-white/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow-sm">
            {getPropertyTypeLabel(property.property_type, locale)}
          </span>
        </div>

        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white shadow-sm hover:scale-110 active:scale-95 transition-all"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              isFavorited ? "fill-red-500 text-red-500" : "text-white"
            }`}
          />
        </button>
      </div>

      {/* Body Content */}
      <div className="p-4 space-y-3">
        <div className="cursor-pointer" onClick={() => onViewDetails(property)}>
          <div className="text-xl sm:text-2xl font-black tracking-tight text-brand-dark">
            {priceDisplay}
          </div>
          <h3 className="text-sm sm:text-base font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors">
            {title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-0.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
            <span className="truncate">{address}</span>
          </div>
        </div>

        {/* Specs Row */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 text-xs font-semibold text-gray-600">
          <div className="flex items-center gap-1.5">
            <Maximize2 className="h-3.5 w-3.5 text-gray-400" />
            <span>{property.area_sqm} {t.common.sqm}</span>
          </div>
          {property.rooms && (
            <div className="flex items-center gap-1.5">
              <Bed className="h-3.5 w-3.5 text-gray-400" />
              <span>{property.rooms} {t.common.rooms}</span>
            </div>
          )}
          {floorNum ? (
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-gray-400" />
              <span>{floorNum}{totalFloors ? `/${totalFloors}` : ""}-{locale === "uz" ? "qavat" : "эт."}</span>
            </div>
          ) : property.bathrooms ? (
            <div className="flex items-center gap-1.5">
              <Bath className="h-3.5 w-3.5 text-gray-400" />
              <span>{property.bathrooms}</span>
            </div>
          ) : null}
        </div>

        {/* "Batafsil ko'rish" Main Button */}
        <button
          onClick={() => onViewDetails(property)}
          className="group w-full flex items-center justify-center gap-2 rounded-xl bg-brand-primary py-2.5 text-xs font-bold text-white shadow-card hover:bg-brand-primary-hover active:scale-[0.98] transition-all"
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
