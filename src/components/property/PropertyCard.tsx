"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MapPin, Maximize2, Bed, Bath, ArrowRight, Scale, Sparkles, Zap, Percent, TrendingDown } from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { useCompare } from "@/lib/compareStore";
import { formatPrice } from "@/lib/currency";
import { getPropertyTitle, getPropertyAddress, isPropertyNew } from "@/lib/propertyFormatters";
import { PropertyPhotoGalleryModal } from "./PropertyPhotoGalleryModal";

interface PropertyCardProps {
  property: Property;
  onViewDetails?: (property: Property) => void;
}

export function PropertyCard({ property, onViewDetails }: PropertyCardProps) {
  const router = useRouter();
  const { locale, t } = useLanguage();
  const { currency, exchangeRate } = useCurrency();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isFavorited = isFavorite(property.id);
  const { isInCompare, toggleCompare } = useCompare();
  const isCompared = isInCompare(property.id);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const title = getPropertyTitle(property, locale);
  const address = getPropertyAddress(property, locale);
  
  const isSale = property.transaction_type === "sale";
  const badgeText = isSale ? t.popular.saleBadge : t.popular.rentBadge;

  // Format price
  const formatted = formatPrice(property.price_uzs, locale, currency, false, exchangeRate);
  const uzsSuffix = locale === "uz" ? "so‘m" : "сум";
  const monthSuffix = isSale ? "" : ` / ${locale === "uz" ? "oy" : "мес"}`;
  const priceDisplay = isSale
    ? currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} ${uzsSuffix}`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}`
    : currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} ${uzsSuffix}${monthSuffix}`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}${monthSuffix}`;

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails(property);
    } else {
      router.push(`/properties/${property.id}`);
    }
  };

  const handlePhotoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsGalleryOpen(true);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite(property.id);
  };

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const res = toggleCompare(property);
    if (res.limitReached) {
      alert(
        locale === "uz"
          ? "Solishtirish uchun ko‘pi bilan 3 ta obyekt tanlash mumkin."
          : "Для сравнения можно выбрать не более 3 объектов."
      );
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-[#e2e9e6] shadow-card hover:shadow-elevated transition-all duration-200 cursor-pointer"
    >
      
      {/* Property Image Container — 3:4 Vertical Aspect Ratio with Cover & Fullscreen Gallery Trigger */}
      <div
        onClick={handlePhotoClick}
        className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100 cursor-pointer"
        data-testid={`property-card-photo-${property.id}`}
        title={locale === "uz" ? "Galereyani to‘liq ekranda ko‘rish" : "Открыть галерею на весь экран"}
      >
        <Image
          src={property.images[0]}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Photo Counter Badge & View Fullscreen Indicator */}
        {property.images && property.images.length > 0 && (
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold shadow-xs">
            <Maximize2 className="w-3 h-3" />
            <span>1 / {property.images.length}</span>
          </div>
        )}

        {/* Transaction Badge and Marketing Badges (Top Left) */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1 items-center max-w-[85%]">
          <span className="rounded-lg bg-[#0c2e1f] px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wide text-white shadow-xs">
            {badgeText}
          </span>
          {/* Automatic "New" / "Новинка" Badge (3 days from publication) */}
          {isPropertyNew(property) && (
            <span className="rounded-lg bg-[#206e4d] px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wide text-white shadow-xs">
              {locale === "uz" ? "Yangi" : "Новинка"}
            </span>
          )}
          {property.badges &&
            property.badges.filter((b) => b !== "new").slice(0, 2).map((b) => {
              if (b === "top") {
                return (
                  <span
                    key={b}
                    className="rounded-lg bg-amber-600 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wide text-white shadow-xs flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>TOP</span>
                  </span>
                );
              }
              if (b === "arzon") {
                return (
                  <span
                    key={b}
                    className="rounded-lg bg-[#206e4d] px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wide text-white shadow-xs"
                  >
                    {locale === "uz" ? "Arzon" : "Недорого"}
                  </span>
                );
              }
              if (b === "tez_sotiladi") {
                return (
                  <span
                    key={b}
                    className="rounded-lg bg-rose-600 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wide text-white shadow-xs flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 shrink-0" />
                    <span>{locale === "uz" ? "Tezkor" : "Срочно"}</span>
                  </span>
                );
              }
              if (b === "hamyonbop" || b === "yaxshi_taklif") {
                return (
                  <span
                    key={b}
                    className="rounded-lg bg-[#19573c] px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wide text-white shadow-xs flex items-center gap-1"
                  >
                    <Percent className="w-3 h-3 shrink-0" />
                    <span>{locale === "uz" ? "Hamyonbop" : "Выгодно"}</span>
                  </span>
                );
              }
              if (b === "narxi_tushirildi") {
                return (
                  <span
                    key={b}
                    className="rounded-lg bg-slate-700 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-wide text-white shadow-xs flex items-center gap-1"
                  >
                    <TrendingDown className="w-3 h-3 shrink-0" />
                    <span>{locale === "uz" ? "Arzonlashdi" : "Цена снижена"}</span>
                  </span>
                );
              }
              return null;
            })}
        </div>

        {/* Top Right Action Buttons: Compare & Favorite */}
        <div className="absolute top-2.5 sm:top-3.5 right-2.5 sm:right-3.5 z-10 flex items-center gap-1.5">
          {/* Compare Button */}
          <button
            type="button"
            onClick={handleCompareClick}
            aria-label={locale === "uz" ? "Solishtirish" : "Сравнить"}
            title={locale === "uz" ? "Solishtirishga qo‘shish" : "Добавить в сравнение"}
            className={`flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full backdrop-blur-md shadow-sm hover:scale-110 active:scale-95 transition-all ${
              isCompared
                ? "bg-[#0c2e1f] text-white ring-2 ring-white/50"
                : "bg-black/40 text-white hover:bg-black/60"
            }`}
          >
            <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          {/* Favorite Heart Button */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label="Favorite"
            className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white shadow-sm hover:scale-110 active:scale-95 transition-all"
          >
            <Heart
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors ${
                isFavorited ? "fill-red-500 text-red-500" : "text-white"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Property Card Body */}
      <div className="flex flex-1 flex-col p-3 sm:p-4 justify-between">
        
        <div className="space-y-1">
          {/* Price */}
          <div className="text-sm sm:text-lg font-extrabold tracking-tight text-[#0c2e1f]">
            {priceDisplay}
          </div>

          {/* Title */}
          <Link
            href={`/properties/${property.id}`}
            onClick={(e) => {
              if (onViewDetails) {
                e.preventDefault();
                onViewDetails(property);
              }
            }}
            className="block focus:outline-none"
          >
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 group-hover:text-[#19573c] transition-colors">
              {title}
            </h3>
          </Link>

          {/* Location / Address */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10.5px] sm:text-xs text-gray-500 pt-0.5">
            <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{address}</span>
          </div>
        </div>

        {/* Specs & Action Row */}
        <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-[#e2e9e6] pt-2 sm:pt-2.5 text-[10.5px] sm:text-xs font-semibold text-gray-600">
          
          {/* Specs Icons */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Area */}
            <div className="flex items-center gap-1">
              <Maximize2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400" />
              <span>
                {property.area_sqm} {t.common.sqm}
                {property.area_sotikh && property.area_sotikh > 0
                  ? ` (${property.area_sotikh} ${locale === "uz" ? "sotix" : "сот."})`
                  : ""}
              </span>
            </div>

            {/* Rooms / Beds */}
            {property.rooms && (
              <div className="flex items-center gap-1">
                <Bed className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400" />
                <span>{property.rooms}</span>
              </div>
            )}

            {/* Bathrooms */}
            {property.bathrooms && (
              <div className="flex items-center gap-1">
                <Bath className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400" />
                <span>{property.bathrooms}</span>
              </div>
            )}
          </div>

          {/* Circular Details Button */}
          <Link
            href={`/properties/${property.id}`}
            onClick={(e) => {
              if (onViewDetails) {
                e.preventDefault();
                onViewDetails(property);
              }
            }}
            aria-label={locale === "uz" ? "Batafsil ma'lumot" : "Подробнее"}
            className="hidden sm:flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 group-hover:bg-[#0c2e1f] group-hover:text-white transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

        </div>

      </div>

      {/* Fullscreen Photo Gallery Modal */}
      <PropertyPhotoGalleryModal
        images={property.images}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        title={title}
      />
    </div>
  );
}
