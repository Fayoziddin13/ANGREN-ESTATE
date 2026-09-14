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
  Building,
  Sparkles,
  CheckCircle2,
  Phone,
  Send,
  Share2,
  ShieldCheck,
  Calendar,
  Check,
  Zap,
  Flame,
  Droplets,
  Thermometer,
  Wifi,
  User,
  Scale,
} from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { useCompare } from "@/lib/compareStore";
import { PropertyInfrastructureSection } from "./PropertyInfrastructureSection";
import { recordPublicLead } from "@/lib/leadClient";
import { trackEvent } from "@/lib/analytics";

interface PropertyDetailModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PropertyDetailModal({
  property,
  isOpen,
  onClose,
}: PropertyDetailModalProps) {
  const { locale, t } = useLanguage();
  const { currency, exchangeRate } = useCurrency();
  const { user, openAuthModal } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isInCompare, toggleCompare } = useCompare();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const isFavorited = property ? isFavorite(property.id) : false;
  const isCompared = property ? isInCompare(property.id) : false;
  const [copied, setCopied] = useState(false);

  if (!isOpen || !property) return null;

  const title = locale === "uz" ? property.title_uz : property.title_ru;
  const description =
    locale === "uz" ? property.description_uz : property.description_ru;
  const address = locale === "uz" ? property.address_uz : property.address_ru;
  const district =
    locale === "uz" ? property.district_name_uz : property.district_name_ru;
  const isSale = property.transaction_type === "sale";
  const badgeText = isSale ? t.popular.saleBadge : t.popular.rentBadge;
  const isSold = property.status === "sold";
  const isRented = property.status === "rented";
  const isSoldOrRented = isSold || isRented;

  const priceFormatted =
    currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} UZS`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}`;

  const secondaryPrice =
    currency === "UZS"
      ? `≈ $${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}`
      : `≈ ${property.price_uzs.toLocaleString("ru-RU")} UZS`;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!property) return;
    toggleFavorite(property.id);
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCallClick = () => {
    if (!property) return;
    trackEvent("phone_click", { property_id: property.id });
    recordPublicLead({
      propertyId: property.id,
      type: "phone",
      propertyTitle: title,
      propertySlug: property.slug,
      realtorId: property.realtor_id,
    });
  };

  const handleTelegramClick = () => {
    if (!property) return;
    trackEvent("telegram_click", { property_id: property.id });
    recordPublicLead({
      propertyId: property.id,
      type: "telegram",
      propertyTitle: title,
      propertySlug: property.slug,
      realtorId: property.realtor_id,
    });
  };

  // Human-friendly renovation label
  const getRenovationLabel = () => {
    switch (property.renovation) {
      case "designer":
        return locale === "uz" ? "Dizaynerlik ta'miri" : "Дизайнерский ремонт";
      case "euro":
        return locale === "uz" ? "Yevro ta'mirlangan" : "Евроремонт";
      case "cosmetic":
        return locale === "uz" ? "Kosmetik ta'mir" : "Косметический ремонт";
      default:
        return locale === "uz" ? "O'rtacha" : "Без ремонта";
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop with liquid glass blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-brand-dark/40 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white/95 backdrop-blur-xl shadow-elevated border border-white/80 z-10 flex flex-col my-auto"
        >
          {/* Floating Top Close & Actions Bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between p-4 px-6 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{t.propertyDetail.verified}</span>
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {badgeText}
              </span>
              {isSold && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                  {locale === "uz" ? "Sotilgan" : "Продано"}
                </span>
              )}
              {isRented && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  {locale === "uz" ? "Ijaraga berildi" : "Арендовано"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Compare Button */}
              <button
                type="button"
                onClick={() => {
                  if (!property) return;
                  const res = toggleCompare(property);
                  if (res.limitReached) {
                    alert(
                      locale === "uz"
                        ? "Solishtirish uchun ko‘pi bilan 3 ta obyekt tanlash mumkin."
                        : "Для сравнения можно выбрать не более 3 объектов."
                    );
                  }
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  isCompared
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title={locale === "uz" ? "Solishtirish" : "Сравнить"}
              >
                <Scale className="h-4 w-4" />
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title={t.propertyDetail.share}
              >
                {copied ? <Check className="h-4 w-4 text-brand-primary" /> : <Share2 className="h-4 w-4" />}
              </button>

              {/* Favorite Button */}
              <button
                onClick={handleFavoriteClick}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Heart
                  className={`h-4 w-4 ${
                    isFavorited ? "fill-red-500 text-red-500" : "text-gray-600"
                  }`}
                />
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* Gallery Section */}
            <div className="space-y-3">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gray-100 shadow-sm">
                <Image
                  src={property.images[activeImageIndex] || property.images[0]}
                  alt={title}
                  fill
                  priority
                  className="object-cover transition-all duration-300"
                />
              </div>

              {/* Thumbnail Bar */}
              {property.images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {property.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative h-16 w-24 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                        activeImageIndex === idx
                          ? "border-brand-primary ring-2 ring-brand-primary/30"
                          : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={img}
                        alt="thumbnail"
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Price & Title Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-gray-100 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-4xl font-black tracking-tight text-brand-dark">
                    {priceFormatted}
                  </span>
                  {!isSale && (
                    <span className="text-sm font-semibold text-gray-500">
                      / {t.common.month}
                    </span>
                  )}
                </div>
                <div className="text-xs font-semibold text-gray-400">
                  {secondaryPrice}
                </div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 pt-1">
                  {title}
                </h1>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-brand-primary shrink-0" />
                  <span>{address}</span>
                  <span className="text-gray-300">•</span>
                  <span className="font-semibold text-brand-primary">{district}</span>
                </div>
              </div>

              {/* Contact Call-to-Actions (Desktop) */}
              <div className="flex items-center gap-2.5 pt-2 sm:pt-0">
                {isSoldOrRented ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3.5 py-2.5 rounded-2xl text-xs font-extrabold ${
                        isSold ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {isSold
                        ? locale === "uz"
                          ? "Sotilgan"
                          : "Продано"
                        : locale === "uz"
                        ? "Ijaraga berildi"
                        : "Арендовано"}
                    </span>
                    <button
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-2xl bg-[#16543C] text-white text-xs font-bold hover:bg-[#113F2D] transition-colors shadow-sm"
                    >
                      {locale === "uz" ? "Boshqa obyektlar" : "Другие объекты"}
                    </button>
                  </div>
                ) : (
                  <>
                    <a
                      href={`tel:${property.contact_phone}`}
                      onClick={handleCallClick}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-brand-primary px-6 py-3.5 text-xs font-bold text-white shadow-card hover:bg-brand-primary-hover active:scale-[0.98] transition-all"
                    >
                      <Phone className="h-4 w-4" />
                      <span>{t.propertyDetail.call}</span>
                    </a>
                    {property.contact_telegram && (
                      <a
                        href={`https://t.me/${property.contact_telegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleTelegramClick}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm"
                      >
                        <Send className="h-4 w-4 text-brand-primary" />
                        <span>Telegram</span>
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Visual Parameter Blocks (Dynamic by Property Type) */}
            <div className="space-y-2.5">
              <h2 className="text-sm font-bold tracking-tight text-gray-800">
                {t.propertyDetail.detailsTitle}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {property.property_type === "house_yard" || property.property_type === "land" ? (
                  <>
                    {/* Yer maydoni (Sotix) */}
                    <div className="flex flex-col p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5 text-brand-primary" />
                        <span>{locale === "uz" ? "Yer maydoni" : "Площадь участка"}</span>
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-brand-dark pt-1">
                        {property.area_sotikh ? `${property.area_sotikh} ${locale === "uz" ? "sotix" : "соток"}` : "—"}
                      </span>
                    </div>

                    {/* Uy maydoni (m²) */}
                    {property.property_type !== "land" && (
                      <div className="flex flex-col p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10">
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Building className="h-3.5 w-3.5 text-brand-primary" />
                          <span>{locale === "uz" ? "Uy maydoni" : "Площадь дома"}</span>
                        </span>
                        <span className="text-base sm:text-lg font-extrabold text-brand-dark pt-1">
                          {property.area_sqm} {t.common.sqm}
                        </span>
                      </div>
                    )}

                    {/* O'lchamlari / Fasad */}
                    <div className="flex flex-col p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                        <span>{locale === "uz" ? "O‘lchamlari" : "Размеры"}</span>
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-brand-dark pt-1">
                        {property.dimensions || (property.facade_m && property.depth_m ? `${property.facade_m} × ${property.depth_m} m` : property.facade_m ? `Fasad: ${property.facade_m} m` : "—")}
                      </span>
                    </div>

                    {/* Xonalar soni */}
                    {property.property_type !== "land" && (
                      <div className="flex flex-col p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10">
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Bed className="h-3.5 w-3.5 text-brand-primary" />
                          <span>{t.propertyDetail.rooms}</span>
                        </span>
                        <span className="text-base sm:text-lg font-extrabold text-brand-dark pt-1">
                          {property.rooms ? `${property.rooms} ${t.common.rooms}` : "—"}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Qavat / Jami qavat (Apartment Primary) */}
                    <div className="flex flex-col p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-brand-primary" />
                        <span>{t.propertyDetail.floor}</span>
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-brand-dark pt-1">
                        {property.floor_number || property.floor
                          ? `${property.floor_number || property.floor} / ${property.total_floors || property.floors || property.floor_number || 1} ${locale === "uz" ? "qavat" : "эт."}`
                          : "1 / 1"}
                      </span>
                    </div>

                    {/* Maydon (m²) */}
                    <div className="flex flex-col p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5 text-brand-primary" />
                        <span>{t.propertyDetail.area}</span>
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-brand-dark pt-1">
                        {property.area_sqm} {t.common.sqm}
                      </span>
                    </div>

                    {/* Xonalar */}
                    <div className="flex flex-col p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Bed className="h-3.5 w-3.5 text-brand-primary" />
                        <span>{t.propertyDetail.rooms}</span>
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-brand-dark pt-1">
                        {property.rooms ? `${property.rooms} ${t.common.rooms}` : "—"}
                      </span>
                    </div>

                    {/* Sanuzel */}
                    <div className="flex flex-col p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Bath className="h-3.5 w-3.5 text-brand-primary" />
                        <span>{t.propertyDetail.bathrooms}</span>
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-brand-dark pt-1">
                        {property.bathrooms ? `${property.bathrooms} ${locale === "uz" ? "ta" : ""}`.trim() : (locale === "uz" ? "1 ta" : "1")}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold tracking-tight text-gray-800">
                {t.propertyDetail.description}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
                {description}
              </p>
            </div>

            {/* 6 Core Communications (NO emojis, Professional Lucide Icons) */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold tracking-tight text-gray-800">
                {locale === "uz" ? "Kommunikatsiyalar" : "Коммуникации"}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    icon: Zap,
                    label: "Svet",
                    labelRu: "Электричество",
                    active: property.utilities?.electricity ?? true,
                  },
                  {
                    icon: Flame,
                    label: "Gaz",
                    labelRu: "Газ",
                    active: property.utilities?.gas ?? true,
                  },
                  {
                    icon: Droplets,
                    label: "Sovuq suv",
                    labelRu: "Холодная вода",
                    active: property.utilities?.cold_water ?? property.utilities?.water ?? true,
                  },
                  {
                    icon: Thermometer,
                    label: "Issiq suv",
                    labelRu: "Горячая вода",
                    active: property.utilities?.hot_water ?? true,
                  },
                  {
                    icon: Flame,
                    label: "Isitish",
                    labelRu: "Отопление",
                    active: property.utilities?.heating ?? true,
                  },
                  {
                    icon: Wifi,
                    label: "Internet",
                    labelRu: "Интернет",
                    active: property.utilities?.internet ?? property.amenities?.internet ?? true,
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition-all ${
                        item.active
                          ? "bg-emerald-50 text-[#16543C] border border-emerald-200/80 shadow-xs"
                          : "bg-gray-50 text-gray-400 border border-gray-100 opacity-60"
                      }`}
                    >
                      <div className={`flex h-7 w-7 items-center justify-center rounded-xl shrink-0 ${
                        item.active ? "bg-[#16543C] text-white" : "bg-gray-200 text-gray-400"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{locale === "uz" ? item.label : item.labelRu}</span>
                    </div>
                  );
                })}

                {/* Custom Options if specified */}
                {Array.isArray(property.utilities?.custom) && property.utilities.custom.map((c, i) => (
                  <div
                    key={`custom-${i}`}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50 text-[#16543C] border border-emerald-200/80 shadow-xs text-xs font-bold"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl shrink-0 bg-[#16543C] text-white">
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </div>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Infrastructure Around Property ("Atrofida" / "Рядом") */}
            {(property.latitude ?? property.coordinates?.lat) &&
              (property.longitude ?? property.coordinates?.lng) && (
                <div className="pt-4 border-t border-gray-100">
                  <PropertyInfrastructureSection
                    latitude={property.latitude ?? property.coordinates.lat}
                    longitude={property.longitude ?? property.coordinates.lng}
                  />
                </div>
              )}

            {/* Realtor & Owner Contacts */}
            <div className="p-4 rounded-2xl bg-brand-light/70 border border-brand-primary/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-[#16543C] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                  {property.realtor?.name?.charAt(0) || <User className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {locale === "uz" ? "Mas'ul rieltor" : "Ответственный риелтор"}
                  </p>
                  <p className="text-sm font-extrabold text-gray-900">
                    {property.realtor?.name || "Jasur Alimov"}
                  </p>
                  <p className="text-xs text-emerald-700 font-semibold">
                    {property.realtor?.phone || property.contact_phone}
                  </p>
                </div>
              </div>

              {property.owner_phone && (
                <div className="sm:border-l sm:border-gray-200/80 sm:pl-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {locale === "uz" ? "Mulkdor telefoni" : "Телефон собственника"}
                  </p>
                  <p className="text-xs font-bold text-gray-800 pt-0.5">
                    {property.owner_phone}
                  </p>
                </div>
              )}
            </div>

            {/* Security & Authenticity Footnote */}
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/60 flex items-center gap-3 text-xs text-gray-500">
              <ShieldCheck className="h-5 w-5 text-brand-primary shrink-0" />
              <span>
                {locale === "uz" ? (
                  <>Ushbu obyekt <strong>ANGREN ESTATE</strong> mutaxassislari tomonidan hujjatlar va fotosuratlar bo‘yicha to‘liq tekshirilgan.</>
                ) : (
                  <>Данный объект полностью проверен специалистами <strong>ANGREN ESTATE</strong> по документам и фотографиям.</>
                )}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
