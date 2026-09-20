"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  Handshake,
  Video,
  Instagram,
  Info,
  UserCheck,
  Trees,
  Warehouse,
} from "lucide-react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { useCompare } from "@/lib/compareStore";
import { PropertyInfrastructureSection } from "./PropertyInfrastructureSection";
import { PropertyGroupedFeaturesView } from "./PropertyGroupedFeaturesView";
import { recordPublicLead } from "@/lib/leadClient";
import { trackEvent } from "@/lib/analytics";
import {
  getPropertyTitle,
  getPropertyDescription,
  getPropertyNote,
  getPropertyAddress,
  getPropertyDistrict,
  getRenovationLabel,
} from "@/lib/propertyFormatters";

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

  const title = getPropertyTitle(property, locale);
  const description = getPropertyDescription(property, locale);
  const address = getPropertyAddress(property, locale);
  const district = getPropertyDistrict(property, locale);
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



  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto overflow-x-hidden">
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
          className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white/95 backdrop-blur-xl shadow-elevated border border-white/80 z-10 flex flex-col my-auto min-w-0 mx-auto"
        >
          {/* Floating Top Close & Actions Bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between gap-2 p-3 sm:p-4 px-3 sm:px-6 bg-white/85 backdrop-blur-md border-b border-gray-100 min-w-0">
            {/* Badges Container */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
              <span className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-brand-light px-2.5 sm:px-3 py-1 text-xs font-bold text-brand-primary shrink-0">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{t.propertyDetail.verified}</span>
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 sm:px-3 py-1 text-xs font-semibold text-gray-700 shrink-0">
                {badgeText}
              </span>
              {isSold && (
                <span className="rounded-full bg-red-100 px-2.5 sm:px-3 py-1 text-xs font-bold text-red-700 shrink-0">
                  {locale === "uz" ? "Sotilgan" : "Продано"}
                </span>
              )}
              {isRented && (
                <span className="rounded-full bg-blue-100 px-2.5 sm:px-3 py-1 text-xs font-bold text-blue-700 shrink-0">
                  {locale === "uz" ? "Ijaraga berildi" : "Арендовано"}
                </span>
              )}
              {property.badges &&
                property.badges.map((b) => {
                  if (b === "top") {
                    return (
                      <span
                        key={b}
                        className="rounded-full bg-amber-500 px-2.5 sm:px-3 py-1 text-xs font-black text-white shadow-xs flex items-center gap-1 shrink-0"
                      >
                        ★ {locale === "uz" ? "TOP E’lon" : "ТОП"}
                      </span>
                    );
                  }
                  if (b === "new") {
                    return (
                      <span
                        key={b}
                        className="rounded-full bg-emerald-600 px-2.5 sm:px-3 py-1 text-xs font-bold text-white shadow-xs shrink-0"
                      >
                        {locale === "uz" ? "Yangi" : "Новинка"}
                      </span>
                    );
                  }
                  if (b === "tez_sotiladi") {
                    return (
                      <span
                        key={b}
                        className="rounded-full bg-rose-600 px-2.5 sm:px-3 py-1 text-xs font-bold text-white shadow-xs flex items-center gap-1 shrink-0"
                      >
                        ⚡ {locale === "uz" ? "Tez sotiladi" : "Быстрая продажа"}
                      </span>
                    );
                  }
                  if (b === "yaxshi_taklif") {
                    return (
                      <span
                        key={b}
                        className="rounded-full bg-blue-600 px-2.5 sm:px-3 py-1 text-xs font-bold text-white shadow-xs flex items-center gap-1 shrink-0"
                      >
                        % {locale === "uz" ? "Yaxshi taklif" : "Выгодная сделка"}
                      </span>
                    );
                  }
                  return null;
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-colors ${
                  isCompared
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title={locale === "uz" ? "Solishtirish" : "Сравнить"}
              >
                <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title={t.propertyDetail.share}
              >
                {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand-primary" /> : <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </button>

              {/* Favorite Button */}
              <button
                onClick={handleFavoriteClick}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Heart
                  className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                    isFavorited ? "fill-red-500 text-red-500" : "text-gray-600"
                  }`}
                />
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>

          <div className="p-3.5 sm:p-6 space-y-5 sm:space-y-6 min-w-0">
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
                <div className="flex gap-2.5 overflow-x-auto pb-1 min-w-0 no-scrollbar">
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

            {/* 1. TITLE & 2. PRICE HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-100 pb-5 min-w-0">
              <div className="space-y-1.5 min-w-0 flex-1">
                {/* 1. Property Title */}
                <h1 className="text-lg sm:text-2xl font-black text-gray-900 break-words leading-tight">
                  {title}
                </h1>

                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 flex-wrap">
                  <MapPin className="h-4 w-4 text-brand-primary shrink-0" />
                  <span>{address}</span>
                  <span className="text-gray-300">•</span>
                  <span className="font-semibold text-brand-primary">{district}</span>
                </div>

                {/* 2. Price & Negotiable Badge */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <span className="text-2xl sm:text-4xl font-black tracking-tight text-brand-dark">
                    {priceFormatted}
                  </span>
                  {!isSale && (
                    <span className="text-sm font-semibold text-gray-500">
                      / {t.common.month}
                    </span>
                  )}
                  {property.price_negotiable && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
                      <Handshake className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{locale === "uz" ? "Narxi kelishiladi" : "Цена договорная"}</span>
                    </span>
                  )}
                </div>
                <div className="text-xs font-semibold text-gray-400">
                  {secondaryPrice}
                </div>
              </div>

              {/* Action Buttons: Call, Telegram & 9. Video Review */}
              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {isSoldOrRented ? (
                    <span
                      className={`px-3 py-2 rounded-2xl text-xs font-extrabold ${
                        isSold ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {isSold
                        ? locale === "uz" ? "Sotilgan" : "Продано"
                        : locale === "uz" ? "Ijaraga berildi" : "Арендовано"}
                    </span>
                  ) : (
                    <>
                      <a
                        href={`tel:${property.realtor?.phone || property.contact_phone}`}
                        onClick={handleCallClick}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-brand-primary px-4 sm:px-5 py-2.5 text-xs font-bold text-white shadow-card hover:bg-brand-primary-hover active:scale-[0.98] transition-all shrink-0"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>{t.propertyDetail.call}</span>
                      </a>
                      {(property.realtor?.telegram || property.contact_telegram) && (
                        <a
                          href={`https://t.me/${(property.realtor?.telegram || property.contact_telegram || "").replace("@", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={handleTelegramClick}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 sm:px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm shrink-0"
                        >
                          <Send className="h-3.5 w-3.5 text-brand-primary" />
                          <span>Telegram</span>
                        </a>
                      )}
                    </>
                  )}
                </div>

                {/* 9. Video Review Button */}
                {property.video_url && (
                  <a
                    href={property.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all active:scale-98 cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>{locale === "uz" ? "Uy video obzori" : "Видеообзор дома"}</span>
                  </a>
                )}
              </div>
            </div>

            {/* 3. PRIMARY PROPERTY INFORMATION */}
            <div className="space-y-2.5">
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-500">
                {t.propertyDetail.detailsTitle}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {property.property_type === "apartment" || property.property_type === "new_build" ? (
                  <>
                    {/* Maydon */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Maydon" : "Площадь"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.area_sqm} m²
                      </span>
                    </div>

                    {/* Qavat */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Qavat" : "Этаж"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.floor_number || property.floor || 1}-qavat
                      </span>
                    </div>

                    {/* Bino qavatlari */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Bino qavatlari" : "Этажность"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.total_floors || property.floors || 1} {locale === "uz" ? "qavat" : "эт."}
                      </span>
                    </div>

                    {/* Xonalar */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Bed className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Xonalar" : "Комнаты"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.rooms || 1} {locale === "uz" ? "xona" : "комн."}
                      </span>
                    </div>
                  </>
                ) : property.property_type === "house_yard" ? (
                  <>
                    {/* Uy maydoni */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Uy maydoni" : "Площадь дома"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.living_area_sqm || property.area_sqm} m²
                      </span>
                    </div>

                    {/* Yer maydoni (Sotix) */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Yer maydoni" : "Участок"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.area_sotikh ? `${property.area_sotikh} ${locale === "uz" ? "sotix" : "соток"}` : "—"}
                      </span>
                    </div>

                    {/* Fasad & Chuqurlik */}
                    {(property.facade_m || property.depth_m || property.dimensions) && (
                      <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">{locale === "uz" ? "Fasad / Chuqurlik" : "Фасад / Глубина"}</span>
                        </span>
                        <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                          {property.dimensions || `${property.facade_m || "—"} × ${property.depth_m || "—"} m`}
                        </span>
                      </div>
                    )}

                    {/* Xonalar */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Bed className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Xonalar" : "Комнаты"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.rooms ? `${property.rooms} ${locale === "uz" ? "xona" : "комн."}` : "—"}
                      </span>
                    </div>
                  </>
                ) : property.property_type === "land" ? (
                  <>
                    {/* Sotix */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Yer maydoni" : "Участок"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.area_sotikh ? `${property.area_sotikh} ${locale === "uz" ? "sotix" : "соток"}` : "—"}
                      </span>
                    </div>

                    {/* Fasad */}
                    {property.facade_m && (
                      <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">{locale === "uz" ? "Fasad" : "Фасад"}</span>
                        </span>
                        <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                          {property.facade_m} m
                        </span>
                      </div>
                    )}

                    {/* Chuqurlik */}
                    {property.depth_m && (
                      <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">{locale === "uz" ? "Chuqurlik" : "Глубина"}</span>
                        </span>
                        <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                          {property.depth_m} m
                        </span>
                      </div>
                    )}

                    {/* Umumiy maydon */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Maydon" : "Площадь"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.area_sqm} m²
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Commercial / Other */}
                    <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                      <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                        <span className="truncate">{locale === "uz" ? "Maydon" : "Площадь"}</span>
                      </span>
                      <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                        {property.area_sqm} m²
                      </span>
                    </div>
                    {property.floor && (
                      <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Building className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">{locale === "uz" ? "Qavat" : "Этаж"}</span>
                        </span>
                        <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                          {property.floor}
                        </span>
                      </div>
                    )}
                    {property.rooms && (
                      <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Bed className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">{locale === "uz" ? "Xonalar" : "Помещений"}</span>
                        </span>
                        <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                          {property.rooms}
                        </span>
                      </div>
                    )}
                    {property.facade_m && (
                      <div className="flex flex-col p-3 sm:p-3.5 rounded-2xl bg-brand-light/60 border border-brand-primary/10 min-w-0">
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">{locale === "uz" ? "Fasad" : "Фасад"}</span>
                        </span>
                        <span className="text-sm sm:text-lg font-extrabold text-brand-dark pt-1 truncate">
                          {property.facade_m} m
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 4. DESCRIPTION & ADDITIONAL NOTE */}
            <div className="space-y-3 min-w-0">
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-500">
                {t.propertyDetail.description}
              </h2>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed bg-gray-50/70 p-3.5 sm:p-4 rounded-2xl border border-gray-100 whitespace-pre-line break-words">
                {description}
              </p>

              {getPropertyNote(property, locale) && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1">
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>{locale === "uz" ? "Qo‘shimcha eslatma" : "Дополнительная заметка"}</span>
                  </div>
                  <p className="text-xs text-amber-950 leading-relaxed">
                    {getPropertyNote(property, locale)}
                  </p>
                </div>
              )}
            </div>

            {/* 5. NEARBY INFRASTRUCTURE (Calculated via getInfrastructureAround) */}
            {(property.latitude ?? property.coordinates?.lat) &&
              (property.longitude ?? property.coordinates?.lng) && (
                <div className="pt-2 border-t border-gray-100 min-w-0">
                  <PropertyInfrastructureSection
                    latitude={property.latitude ?? property.coordinates.lat}
                    longitude={property.longitude ?? property.coordinates.lng}
                  />
                </div>
              )}

            {/* 6. GROUPED FEATURES (Communications / Extra Objects / Advantages) */}
            <div className="pt-2 border-t border-gray-100 min-w-0">
              <PropertyGroupedFeaturesView property={property} />
            </div>

            {/* 7. REALTOR CONTACT & 8. REALTOR PROFILE BUTTON (Confidential: NO owner phone!) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-brand-light/70 border border-brand-primary/15 space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-3 min-w-0 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-12 rounded-2xl bg-[#16543C] text-white flex items-center justify-center font-black text-base shrink-0 shadow-sm overflow-hidden">
                    {property.realtor && property.realtor.is_active && (property.realtor.photo_url || property.realtor.avatar_url) ? (
                      <Image
                        src={property.realtor.photo_url || property.realtor.avatar_url || ""}
                        alt={property.realtor.name}
                        fill
                        className="object-cover"
                      />
                    ) : property.realtor?.name ? (
                      property.realtor.name.slice(0, 2).toUpperCase()
                    ) : (
                      "AE"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {locale === "uz" ? "Mas'ul rieltor" : "Ответственный риелтор"}
                    </p>
                    <p className="text-sm font-extrabold text-gray-900 truncate">
                      {property.realtor?.name || "ANGREN ESTATE Eksperti"}
                    </p>
                    <p className="text-xs text-emerald-700 font-semibold truncate">
                      {property.realtor?.phone || property.contact_phone}
                    </p>
                  </div>
                </div>

                {/* 8. Realtor Profile Button */}
                <Link
                  href="/kontaktlar#realtors"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-200 hover:border-[#16543C] text-xs font-bold text-gray-700 hover:text-[#16543C] shadow-xs transition-all active:scale-98 shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#16543C]" />
                  <span>{locale === "uz" ? "Rieltor profili" : "Профиль риелтора"}</span>
                </Link>
              </div>

              {/* Action Buttons: Call, Telegram, Instagram */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-brand-primary/10">
                <a
                  href={`tel:${property.realtor?.phone || property.contact_phone}`}
                  onClick={handleCallClick}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#16543C] hover:bg-[#113F2D] text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-98"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{locale === "uz" ? "Qo‘ng‘iroq" : "Позвонить"}</span>
                </a>

                {(property.realtor?.telegram || property.contact_telegram) && (
                  <a
                    href={`https://t.me/${(property.realtor?.telegram || property.contact_telegram || "").replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleTelegramClick}
                    className="w-full py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram</span>
                  </a>
                )}

                {property.realtor && (property.realtor.instagram_url || property.realtor.instagram) && (
                  <a
                    href={(property.realtor.instagram_url || property.realtor.instagram) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <Instagram className="w-3.5 h-3.5 text-pink-600" />
                    <span>Instagram</span>
                  </a>
                )}
              </div>
            </div>

            {/* Security & Authenticity Footnote */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-gray-50 border border-gray-200/60 flex items-center gap-2.5 sm:gap-3 text-xs text-gray-500 min-w-0">
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
