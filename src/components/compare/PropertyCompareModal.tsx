"use client";

import React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  X,
  Trash2,
  ExternalLink,
  Check,
  Building2,
  Home,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useCompare } from "@/lib/compareStore";
import { formatPublishedDate } from "@/lib/dateFormat";
import {
  getPropertyTitle,
  getPropertyAddress,
  getPropertyDistrict,
  getPropertyTypeLabel,
  getRenovationLabel,
} from "@/lib/propertyFormatters";

interface PropertyCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onSelectProperty?: (p: Property) => void;
}

export function PropertyCompareModal({
  isOpen,
  onClose,
  properties,
  onSelectProperty,
}: PropertyCompareModalProps) {
  const { locale, t } = useLanguage();
  const { currency, exchangeRate, formatPrice } = useCurrency();
  const { compareIds, removeCompare, clearCompare } = useCompare();

  if (!isOpen) return null;

  const comparedProperties = properties.filter((p) => compareIds.includes(p.id));

  const formatPriceValue = (p: Property) => {
    return formatPrice(p.price_uzs, locale);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf5f0]/50 text-[#167d4f]">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {locale === "uz" ? "Obyektlarni solishtirish" : "Сравнение объектов"}
                </h3>
                <p className="text-xs text-slate-500">
                  {comparedProperties.length}/3 {locale === "uz" ? "obyekt tanlangan" : "объекта выбрано"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {comparedProperties.length > 0 && (
                <button
                  type="button"
                  onClick={clearCompare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {locale === "uz" ? "Tozalash" : "Очистить"}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {comparedProperties.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-4">
                <Scale className="h-8 w-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                {locale === "uz" ? "Solishtirish uchun obyekt yo‘q" : "Нет объектов для сравнения"}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mb-6">
                {locale === "uz"
                  ? "Katalog yoki xaritadagi obyekt kartasidagi tarozi belgisini bosib 3 tagacha obyektni qo‘shing."
                  : "Добавьте до 3 объектов для сравнения, нажав на значок весов на карточке объекта."}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl bg-[#167d4f] text-white text-xs font-extrabold hover:bg-[#167d4f] transition-colors"
              >
                {locale === "uz" ? "Katalogga qaytish" : "Вернуться к каталогу"}
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Mobile View: Stacked Cards with Horizontal Swipe */}
              <div className="md:hidden space-y-4">
                {comparedProperties.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {getPropertyTypeLabel(p.property_type, locale)}
                      </span>
                      <button
                        onClick={() => removeCompare(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title={locale === "uz" ? "O‘chirish" : "Удалить"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="relative h-36 w-full rounded-xl overflow-hidden bg-slate-100">
                      {p.main_image || (p.photos && p.photos.length > 0) ? (
                        <Image
                          src={p.main_image || p.photos![0]}
                          alt={getPropertyTitle(p, locale)}
                          fill
                          className="object-cover"
                          sizes="350px"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-300">
                          <Building2 className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        {getPropertyTitle(p, locale)}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>{getPropertyAddress(p, locale)}</span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-base font-black text-[#167d4f]">
                        {formatPriceValue(p).primary}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatPriceValue(p).secondary}
                      </p>
                    </div>

                    {/* Parameters list */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">
                          {locale === "uz" ? "Maydon" : "Площадь"}
                        </span>
                        <span className="font-bold text-slate-800">
                          {p.area_sqm} {locale === "uz" ? "m²" : "м²"} {p.area_sotikh ? `(${p.area_sotikh} ${locale === "uz" ? "sotix" : "соток"})` : ""}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">
                          {locale === "uz" ? "Xonalar" : "Комнаты"}
                        </span>
                        <span className="font-bold text-slate-800">
                          {p.rooms ? `${p.rooms} ${locale === "uz" ? "xona" : "комн."}` : "-"}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">
                          {locale === "uz" ? "Qavat" : "Этаж"}
                        </span>
                        <span className="font-bold text-slate-800">
                          {p.floor ? `${p.floor}/${p.total_floors || "-"}` : "-"}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px]">
                          {locale === "uz" ? "Ta’mir" : "Ремонт"}
                        </span>
                        <span className="font-bold text-slate-800">
                          {getRenovationLabel(p.renovation, locale)}
                        </span>
                      </div>
                    </div>

                    {onSelectProperty && (
                      <button
                        onClick={() => {
                          onSelectProperty(p);
                          onClose();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#167d4f] text-white text-xs font-extrabold hover:bg-[#167d4f] transition-all mt-2"
                      >
                        <span>{locale === "uz" ? "Batafsil ochish" : "Подробнее"}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop View: Side-by-Side Comparison Matrix */}
              <div className="hidden md:block min-w-[640px] text-xs">
                {/* Header Row: Images, Titles, Price */}
                <div className="grid grid-cols-4 gap-4 pb-4 border-b border-slate-200">
                  <div className="p-3 font-bold text-slate-400 self-end">
                    {locale === "uz" ? "Parametrlar" : "Параметры"}
                  </div>

                  {comparedProperties.map((p) => (
                    <div key={p.id} className="p-4 border-l border-slate-200 space-y-2 relative group bg-white">
                      <button
                        onClick={() => removeCompare(p.id)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 transition-colors z-10"
                        title={locale === "uz" ? "Olib tashlash" : "Удалить"}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      {/* Thumbnail Image */}
                      <div className="relative h-24 w-full rounded-xl overflow-hidden bg-slate-100">
                        {p.main_image || (p.photos && p.photos.length > 0) ? (
                          <Image
                            src={p.main_image || p.photos![0]}
                            alt={getPropertyTitle(p, locale)}
                            fill
                            className="object-cover"
                            sizes="200px"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-300">
                            <Building2 className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      <h4 className="text-xs font-black text-slate-900 line-clamp-2">
                        {getPropertyTitle(p, locale)}
                      </h4>
                      <div>
                        <p className="text-sm font-extrabold text-[#167d4f]">
                          {formatPriceValue(p).primary}
                        </p>
                        <p className="text-[11px] font-medium text-slate-400">
                          {formatPriceValue(p).secondary}
                        </p>
                      </div>

                      {onSelectProperty && (
                        <button
                          onClick={() => {
                            onSelectProperty(p);
                            onClose();
                          }}
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-[#eaf5f0]/40 hover:bg-[#eaf5f0]/80 text-[#167d4f] text-[11px] font-extrabold transition-all"
                        >
                          <span>{locale === "uz" ? "Ko‘rish" : "Открыть"}</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Empty Slots if less than 3 */}
                  {Array.from({ length: 3 - comparedProperties.length }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="p-4 border-l border-slate-200 flex flex-col items-center justify-center text-center text-slate-300 bg-slate-50/50"
                    >
                      <Building2 className="h-8 w-8 stroke-1 mb-1" />
                      <span className="text-[11px] font-bold">
                        {locale === "uz" ? "Obyekt qo‘shish mumkin" : "Свободный слот"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Data Rows */}
                <div className="divide-y divide-slate-100 text-xs text-slate-800">
                  {/* Turkum */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Ko‘chmas mulk turi" : "Тип недвижимости"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 font-semibold">
                        {getPropertyTypeLabel(p.property_type, locale)}
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* Bitim turi */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Bitim turi" : "Тип сделки"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 font-semibold">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${
                          p.transaction_type === "sale"
                            ? "bg-[#eaf5f0] text-[#167d4f]"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {p.transaction_type === "sale"
                            ? locale === "uz" ? "Sotuv" : "Продажа"
                            : locale === "uz" ? "Ijara" : "Аренда"}
                        </span>
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* Joylashuv */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Joylashuv / Mavze" : "Район / Массив"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 font-semibold flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[#167d4f] shrink-0" />
                        <span>{getPropertyDistrict(p, locale)}</span>
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* Maydoni */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Umumiy maydon" : "Общая площадь"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 font-bold">
                        {p.area_sqm || p.area} {locale === "uz" ? "m²" : "м²"} {p.area_sotikh ? `(${p.area_sotikh} ${locale === "uz" ? "sotix" : "соток"})` : ""}
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* Xonalar soni */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Xonalar soni" : "Количество комнат"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 font-semibold">
                        {p.rooms ? `${p.rooms} ${locale === "uz" ? "xona" : "комн."}` : "-"}
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* Qavat / Qavatlilik */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Qavat / Qavatlar" : "Этаж / Этажность"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 font-semibold">
                        {p.floor ? `${p.floor} / ${p.total_floors || p.floors || 1}` : "-"}
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* Ta'mir holati */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Ta’mir" : "Ремонт"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 font-semibold capitalize">
                        {getRenovationLabel(p.renovation, locale)}
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* Mebel va Jihozlar */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Mebel bilan" : "С мебелью"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 font-semibold">
                        {p.furniture ? (
                          <span className="text-[#167d4f] font-bold flex items-center gap-1">
                            <Check className="h-4 w-4" />
                            <span>{locale === "uz" ? "Mavjud" : "Да"}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">{locale === "uz" ? "Yo‘q" : "Нет"}</span>
                        )}
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* Fasad va o'lchamlar (agar mavjud bo'lsa) */}
                  {comparedProperties.some((p) => (p.amenities as any)?.dimensions || (p.amenities as any)?.facade_m) && (
                    <div className="grid grid-cols-4 items-center">
                      <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                        {locale === "uz" ? "Fasad / O‘lchamlar" : "Фасад / Габариты"}
                      </div>
                      {comparedProperties.map((p) => (
                        <div key={p.id} className="p-3.5 border-l border-slate-100 font-semibold">
                          {(p.amenities as any)?.dimensions ||
                            ((p.amenities as any)?.facade_m && (p.amenities as any)?.depth_m
                              ? `${(p.amenities as any).facade_m} × ${(p.amenities as any).depth_m} ${locale === "uz" ? "m" : "м"}`
                              : "-")}
                        </div>
                      ))}
                      {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                        <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                      ))}
                    </div>
                  )}

                  {/* Kommunal xizmatlar */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "Kommunal tarmoqlar" : "Коммуникации"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#167d4f]" />
                          <span>{locale === "uz" ? "Gaz / Suv / Elektr" : "Газ / Вода / Свет"}</span>
                        </div>
                        {p.amenities?.internet && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            <span>Internet</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>

                  {/* E'lon sanasi */}
                  <div className="grid grid-cols-4 items-center">
                    <div className="p-3.5 font-bold text-slate-500 bg-slate-50/60">
                      {locale === "uz" ? "E’lon berilgan sana" : "Дата публикации"}
                    </div>
                    {comparedProperties.map((p) => (
                      <div key={p.id} className="p-3.5 border-l border-slate-100 text-slate-500 text-[11px] flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>{formatPublishedDate(p.published_at || p.created_at, locale, true)}</span>
                      </div>
                    ))}
                    {Array.from({ length: 3 - comparedProperties.length }).map((_, i) => (
                      <div key={i} className="p-3.5 border-l border-slate-100 text-slate-300">-</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
