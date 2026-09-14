"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MapPin, Maximize2, Bed, Bath, ArrowRight } from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { formatPrice } from "@/lib/currency";

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

  const title = locale === "uz" ? property.title_uz : property.title_ru;
  const address = locale === "uz" ? property.address_uz : property.address_ru;
  
  const isSale = property.transaction_type === "sale";
  const badgeText = isSale ? t.popular.saleBadge : t.popular.rentBadge;

  // Format price
  const formatted = formatPrice(property.price_uzs, locale, currency, false, exchangeRate);
  const priceDisplay = isSale
    ? currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} UZS`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}`
    : currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} UZS / ${t.common.month}`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")} / ${t.common.month}`;

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails(property);
    } else {
      router.push(`/properties/${property.id}`);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavorite(property.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex flex-col overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer"
    >
      
      {/* Property Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
        <Image
          src={property.images[0]}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Transaction Badge (Top Left) */}
        <div className="absolute top-2.5 sm:top-3.5 left-2.5 sm:left-3.5 z-10">
          <span className="rounded-lg sm:rounded-xl bg-brand-primary px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold tracking-wide text-white shadow-sm">
            {badgeText}
          </span>
        </div>

        {/* Favorite Heart Button (Top Right) */}
        <button
          onClick={handleFavoriteClick}
          aria-label="Favorite"
          className="absolute top-2.5 sm:top-3.5 right-2.5 sm:right-3.5 z-10 flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white shadow-sm hover:scale-110 active:scale-95 transition-all"
        >
          <Heart
            className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors ${
              isFavorited ? "fill-red-500 text-red-500" : "text-white"
            }`}
          />
        </button>
      </div>

      {/* Property Card Body */}
      <div className="flex flex-1 flex-col p-3 sm:p-5 justify-between">
        
        <div className="space-y-1">
          {/* Price */}
          <div className="text-sm sm:text-xl font-extrabold tracking-tight text-brand-dark">
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
            <h3 className="text-xs sm:text-base font-bold text-gray-900 line-clamp-1 group-hover:text-brand-primary transition-colors">
              {title}
            </h3>
          </Link>

          {/* Location / Address */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-500 pt-0.5">
            <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{address}</span>
          </div>
        </div>

        {/* Specs & Action Row */}
        <div className="mt-3 sm:mt-4 flex items-center justify-between border-t border-gray-100 pt-2.5 sm:pt-3 text-[10px] sm:text-xs font-semibold text-gray-600">
          
          {/* Specs Icons */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Area */}
            <div className="flex items-center gap-1">
              <Maximize2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-400" />
              <span>{property.area_sqm} {t.common.sqm}</span>
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
            aria-label="Batafsil ma'lumot"
            className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 group-hover:bg-brand-primary group-hover:text-white transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>

        </div>

      </div>

    </div>
  );
}
