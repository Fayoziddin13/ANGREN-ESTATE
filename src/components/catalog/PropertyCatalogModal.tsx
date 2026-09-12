"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  X,
  MapPin,
  Maximize2,
  Bed,
  Layers,
  Heart,
  Calendar,
  Sparkles,
  Search,
  Filter,
} from "lucide-react";
import { Property, TransactionType, PropertyType } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useFavorites } from "@/lib/favoriteStore";
import { formatPublishedDate } from "@/lib/dateFormat";

interface PropertyCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  transactionType: TransactionType | "all";
  onTransactionChange: (t: TransactionType | "all") => void;
  selectedType: PropertyType | "all";
  onTypeChange: (t: PropertyType | "all") => void;
  onViewDetails: (property: Property) => void;
  searchQuery?: string;
  onClearFilters?: () => void;
}

export function PropertyCatalogModal({
  isOpen,
  onClose,
  properties,
  transactionType,
  onTransactionChange,
  selectedType,
  onTypeChange,
  onViewDetails,
  searchQuery,
  onClearFilters,
}: PropertyCatalogModalProps) {
  const { locale, t } = useLanguage();
  const { currency } = useCurrency();
  const { isFavorite, toggleFavorite } = useFavorites();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* 1. Sticky Navigation Bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-xs px-4 sm:px-8 py-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {/* Back to Map button */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs sm:text-sm transition-all active:scale-95 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-[#16543C]" />
            <span>{locale === "uz" ? "Харитага қайтиш" : "Вернуться на карту"}</span>
          </button>

          {/* Transaction Type Segmented Control */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-100 border border-slate-200/80">
            <button
              onClick={() => onTransactionChange("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                transactionType === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {locale === "uz" ? "Барчаси" : "Все"}
            </button>
            <button
              onClick={() => onTransactionChange("sale")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                transactionType === "sale"
                  ? "bg-[#16543C] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {locale === "uz" ? "Сотув" : "Продажа"}
            </button>
            <button
              onClick={() => onTransactionChange("rent")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                transactionType === "rent"
                  ? "bg-[#1D4ED8] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {locale === "uz" ? "Ижара" : "Аренда"}
            </button>
          </div>

          {/* Right Close & Total Counter */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#16543C] text-xs font-extrabold border border-emerald-200/70">
              <span>{properties.length}</span>
              <span>{locale === "uz" ? "та эълон" : "объектов"}</span>
            </span>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Property Type Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: "all", label_uz: "Барча турлар", label_ru: "Все типы" },
            { id: "apartment", label_uz: "Квартиралар", label_ru: "Квартиры" },
            { id: "house_yard", label_uz: "Ҳовли / Уй", label_ru: "Дома / Участки" },
            { id: "new_build", label_uz: "Янги бинолар", label_ru: "Новостройки" },
            { id: "land", label_uz: "Ер майдонлари", label_ru: "Земельные участки" },
            { id: "commercial", label_uz: "Тижорат мулки", label_ru: "Коммерческая" },
          ].map((cat) => {
            const isActive = selectedType === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onTypeChange(cat.id as PropertyType | "all")}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#16543C] text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {locale === "uz" ? cat.label_uz : cat.label_ru}
              </button>
            );
          })}
        </div>
      </header>

      {/* 2. Scrollable Body Grid */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Status Subtitle */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              {locale === "uz"
                ? `Ангрен шаҳри бўйича ${properties.length} та фаол эълон`
                : `Найдено ${properties.length} активных объявлений в Ангрене`}
            </span>
            {searchQuery && (
              <span className="italic">
                "{searchQuery}" {locale === "uz" ? "бўйича қидирув" : "поиск"}
              </span>
            )}
          </div>

          {/* Empty State */}
          {properties.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="h-16 w-16 rounded-3xl bg-emerald-50 text-[#16543C] flex items-center justify-center">
                <Search className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-800">
                  {locale === "uz" ? "Бирорта ҳам эълон топилмади" : "Объявления не найдены"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  {locale === "uz"
                    ? "Филтрларни тозалаб кўринг ёки бошқа категорияни танланг."
                    : "Попробуйте сбросить фильтры или выбрать другую категорию."}
                </p>
              </div>
              {onClearFilters && (
                <button
                  onClick={onClearFilters}
                  className="px-4 py-2 rounded-xl bg-[#16543C] text-white text-xs font-bold shadow-sm"
                >
                  {locale === "uz" ? "Филтрларни тозалаш" : "Сбросить фильтры"}
                </button>
              )}
            </div>
          ) : (
            /* Properties Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {properties.map((property) => {
                const isFavorited = isFavorite(property.id);
                const isSale = property.transaction_type === "sale";
                const isHouse =
                  property.property_type === "house_yard" ||
                  property.property_type === "land";

                const title = locale === "uz" ? property.title_uz : property.title_ru;
                const address =
                  locale === "uz" ? property.address_uz : property.address_ru;

                const priceDisplay = isSale
                  ? currency === "UZS"
                    ? `${property.price_uzs.toLocaleString("ru-RU")} UZS`
                    : `$${Math.round(property.price_uzs / 12800).toLocaleString("ru-RU")}`
                  : currency === "UZS"
                  ? `${property.price_uzs.toLocaleString("ru-RU")} UZS / ой`
                  : `$${Math.round(property.price_uzs / 12800).toLocaleString("ru-RU")} / мес`;

                const dateDisplay = formatPublishedDate(
                  property.published_at || property.created_at,
                  locale,
                  true
                );

                const floorNum = property.floor_number ?? property.floor;
                const totalFloors = property.floors ?? property.total_floors;

                return (
                  <div
                    key={property.id}
                    onClick={() => onViewDetails(property)}
                    className="group flex flex-col rounded-3xl bg-white border border-slate-200/80 shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden cursor-pointer active:scale-[0.99]"
                  >
                    {/* Image Area */}
                    <div className="relative aspect-[16/10] w-full bg-slate-100 overflow-hidden">
                      <Image
                        src={property.images[0]}
                        alt={title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Transaction & Type Badges */}
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                        <span
                          className={`rounded-xl px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-sm ${
                            isSale ? "bg-[#16543C]" : "bg-[#1D4ED8]"
                          }`}
                        >
                          {isSale
                            ? locale === "uz" ? "Сотув" : "Продажа"
                            : locale === "uz" ? "Ижара" : "Аренда"}
                        </span>
                        {isHouse && property.area_sotikh && (
                          <span className="rounded-xl bg-white/90 backdrop-blur-md px-2 py-1 text-[10px] font-extrabold text-slate-800 shadow-sm">
                            {property.area_sotikh} {locale === "uz" ? "сотих" : "соток"}
                          </span>
                        )}
                      </div>

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(property.id);
                        }}
                        className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white shadow-sm hover:scale-110 active:scale-95 transition-all"
                      >
                        <Heart
                          className={`h-3.5 w-3.5 transition-colors ${
                            isFavorited ? "fill-red-500 text-red-500" : "text-white"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Content Area */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        {/* Price */}
                        <div className="text-base sm:text-lg font-black tracking-tight text-[#0E3324]">
                          {priceDisplay}
                        </div>

                        {/* Title */}
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-[#16543C] transition-colors mt-0.5">
                          {title}
                        </h4>

                        {/* Address */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-1">
                          <MapPin className="h-3 w-3 shrink-0 text-[#16543C]" />
                          <span className="truncate">{address}</span>
                        </div>
                      </div>

                      {/* Type-Specific Specs Row */}
                      <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-600">
                        {isHouse ? (
                          /* House specs: land sotix, house area, rooms */
                          <div className="flex items-center gap-3">
                            {property.area_sotikh ? (
                              <span>{property.area_sotikh} {locale === "uz" ? "сот." : "сот."}</span>
                            ) : null}
                            <div className="flex items-center gap-1">
                              <Maximize2 className="h-3 w-3 text-slate-400" />
                              <span>{property.area_sqm} м²</span>
                            </div>
                            {property.rooms ? (
                              <div className="flex items-center gap-1">
                                <Bed className="h-3 w-3 text-slate-400" />
                                <span>{property.rooms} {locale === "uz" ? "хона" : "комн."}</span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          /* Apartment specs: area, rooms, floor */
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Maximize2 className="h-3 w-3 text-slate-400" />
                              <span>{property.area_sqm} м²</span>
                            </div>
                            {property.rooms ? (
                              <div className="flex items-center gap-1">
                                <Bed className="h-3 w-3 text-slate-400" />
                                <span>{property.rooms} {locale === "uz" ? "хона" : "комн."}</span>
                              </div>
                            ) : null}
                            {floorNum ? (
                              <div className="flex items-center gap-1">
                                <Layers className="h-3 w-3 text-slate-400" />
                                <span>{floorNum}{totalFloors ? `/${totalFloors}` : ""} {locale === "uz" ? "қават" : "эт."}</span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Date badge */}
                        {dateDisplay && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                            <Calendar className="h-3 w-3" />
                            <span>{dateDisplay}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
