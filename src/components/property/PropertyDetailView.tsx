"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  Share2,
  MapPin,
  Maximize2,
  Bed,
  Bath,
  Building,
  CheckCircle2,
  Phone,
  Send,
  Calendar,
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Instagram,
  Zap,
  Flame,
  Droplets,
  Thermometer,
  Wifi,
  Scale,
  Video,
  Handshake,
  UserCheck,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { useCompare } from "@/lib/compareStore";
import { PropertyInfrastructureSection } from "./PropertyInfrastructureSection";
import { PropertyGroupedFeaturesView } from "./PropertyGroupedFeaturesView";
import { getPropertyRepository } from "@/lib/repository/propertyRepository";
import { Property } from "@/lib/types";
import { trackEvent } from "@/lib/analytics";
import { recordPublicLead } from "@/lib/leadClient";
import { formatPublishedDate } from "@/lib/dateFormat";
import {
  getPropertyTitle,
  getPropertyDescription,
  getPropertyNote,
  getPropertyAddress,
  getPropertyDistrict,
  getRenovationLabel,
  getPropertyTypeLabel,
  getBadgeLabel,
  isPropertyNew,
} from "@/lib/propertyFormatters";

function DetailMapLoading() {
  const { locale } = useLanguage();
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs font-semibold">
      {locale === "uz" ? "Xarita yuklanmoqda..." : "Загрузка карты..."}
    </div>
  );
}

// Dynamic import for mini map
const AngrenMap = dynamic(
  () => import("@/components/map/AngrenMap").then((mod) => mod.AngrenMap),
  {
    ssr: false,
    loading: () => <DetailMapLoading />,
  }
);

export default function PropertyDetailView({
  initialProperty,
  propertyId: propIdParam,
}: {
  initialProperty?: Property | null;
  propertyId?: string;
}) {
  const routeParams = useParams();
  const propertyId = (propIdParam || (routeParams?.id as string) || initialProperty?.id || "") as string;

  const { locale, t } = useLanguage();
  const { currency, exchangeRate } = useCurrency();
  const { user, openAuthModal } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isInCompare, toggleCompare } = useCompare();

  const [property, setProperty] = useState<Property | null>(initialProperty || null);
  const isCompared = property ? isInCompare(property.id) : false;
  const [loading, setLoading] = useState(!initialProperty);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadProperty() {
      if (!propertyId) return;
      let data = property;
      if (!data) {
        const repo = getPropertyRepository();
        data = await repo.getPropertyById(propertyId);
        setProperty(data);
        setLoading(false);
      }

      if (data) {
        trackEvent("property_view", {
          property_id: data.id,
          user_id: user?.id,
          metadata: { title: data.title_uz, price: data.price_uzs },
        });
      }
    }
    loadProperty();
  }, [propertyId, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-10 h-10 rounded-full border-3 border-[#16543C] border-t-transparent animate-spin mb-3" />
          <p className="text-sm font-semibold">{locale === "uz" ? "Ko‘chmas mulk ma’lumotlari yuklanmoqda..." : "Загрузка информации об объекте..."}</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-[#16543C] flex items-center justify-center mb-4">
            <Info className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {locale === "uz" ? "Obyekt topilmadi" : "Объект не найден"}
          </h1>
          <p className="text-gray-500 text-sm max-w-md mb-6">
            {locale === "uz"
              ? "Ushbu e’lon o‘chirilgan yoki sotilgan bo‘lishi mumkin. Shahar xaritasidan boshqa takliflarni ko‘ring."
              : "Данное объявление могло быть продано или архивировано. Посмотрите другие предложения на карте."}
          </p>
          <Link
            href="/"
            className="px-6 py-3 rounded-2xl bg-[#16543C] hover:bg-[#113F2D] text-white text-sm font-bold shadow-lg shadow-emerald-950/20 transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{locale === "uz" ? "Xaritaga qaytish" : "Вернуться на карту"}</span>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const title = getPropertyTitle(property, locale);
  const description = getPropertyDescription(property, locale);
  const address = getPropertyAddress(property, locale);
  const district = getPropertyDistrict(property, locale);
  const isSale = property.transaction_type === "sale";
  const favorited = isFavorite(property.id);
  const isSold = property.status === "sold";
  const isRented = property.status === "rented";
  const isSoldOrRented = isSold || isRented;

  const priceDisplay = isSale
    ? currency === "UZS"
      ? `${property.price_uzs.toLocaleString("ru-RU")} UZS`
      : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}`
    : currency === "UZS"
    ? `${property.price_uzs.toLocaleString("ru-RU")} UZS / ${t.common.month}`
    : `$${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")} / ${t.common.month}`;

  const secondaryPrice =
    currency === "UZS"
      ? `≈ $${Math.round(property.price_uzs / exchangeRate).toLocaleString("ru-RU")}`
      : `≈ ${property.price_uzs.toLocaleString("ru-RU")} UZS`;

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      trackEvent("property_share", { property_id: property.id });
    }
  };

  const handleCallClick = () => {
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
    <div className="min-h-screen flex flex-col bg-[#F8FAF9]">
      <Header />

      <main className="flex-1 pb-20">
        {/* Breadcrumbs Bar */}
        <div className="bg-white border-b border-gray-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 truncate">
              <Link href="/" className="hover:text-[#16543C] flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{locale === "uz" ? "Xarita" : "Карта"}</span>
              </Link>
              <span>/</span>
              <span>{isSale ? (locale === "uz" ? "Sotuv" : "Продажа") : locale === "uz" ? "Ijara" : "Аренда"}</span>
              <span>/</span>
              <span className="text-gray-900 font-bold truncate">{locale === "uz" ? "Angren," : "г. Ангрен,"} {district}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors shadow-sm ${
                  isCompared
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                }`}
                title={locale === "uz" ? "Solishtirishga qo‘shish" : "Добавить в сравнение"}
              >
                <Scale className="w-3.5 h-3.5 text-[#16543C]" />
                <span>{isCompared ? (locale === "uz" ? "Solishtirishda" : "В сравнении") : (locale === "uz" ? "Solishtirish" : "Сравнить")}</span>
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? (locale === "uz" ? "Nusxalandi" : "Скопировано") : locale === "uz" ? "Ulashish" : "Поделиться"}</span>
              </button>

              <button
                onClick={() => toggleFavorite(property)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                  favorited
                    ? "bg-red-50 border-red-200 text-red-600"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${favorited ? "fill-red-500 text-red-500" : ""}`} />
                <span>{favorited ? (locale === "uz" ? "Saqlangan" : "В избранном") : locale === "uz" ? "Saqlash" : "В избранное"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sold / Rented Prominent Notification Banner */}
        {isSoldOrRented && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <div
              className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
                isSold
                  ? "bg-red-50/90 border-red-200 text-red-950"
                  : "bg-blue-50/90 border-blue-200 text-blue-950"
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <span
                  className={`p-2 rounded-xl text-white shrink-0 ${
                    isSold ? "bg-red-600" : "bg-blue-600"
                  }`}
                >
                  <Info className="w-5 h-5" />
                </span>
                <div>
                  <div className="font-extrabold text-sm sm:text-base">
                    {isSold
                      ? locale === "uz"
                        ? "Ushbu ko‘chmas mulk sotilgan"
                        : "Данный объект уже продан"
                      : locale === "uz"
                      ? "Ushbu ko‘chmas mulk ijaraga berildi"
                      : "Данный объект сдан в аренду"}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                    {locale === "uz"
                      ? "Obyekt faol sotuv/ijarada emas. Xaritada Angrendagi boshqa mavjud takliflarni ko‘rishingiz mumkin."
                      : "Объект снят с активной продажи/аренды. Ознакомьтесь с другими доступными объектами на карте."}
                  </p>
                </div>
              </div>

              <Link
                href="/"
                className="shrink-0 px-5 py-2.5 rounded-2xl bg-[#16543C] hover:bg-[#113F2D] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>{locale === "uz" ? "Boshqa e'lonlarni ko‘rish" : "Смотреть другие объекты"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Content Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column (8 cols): Media Gallery + Details */}
            <div className="lg:col-span-8 space-y-6">
              {/* Photo Gallery */}
              <div className="rounded-3xl overflow-hidden bg-white border border-gray-200/80 shadow-card">
                {/* Main Large Image */}
                <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-gray-900 group">
                  <Image
                    src={property.images[activePhotoIndex] || property.images[0]}
                    alt={title}
                    fill
                    priority
                    className="object-cover transition-transform duration-500"
                  />

                  {/* Badges Overlay */}
                  <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
                    <span className="px-3.5 py-1.5 rounded-xl bg-[#16543C] text-white text-xs font-black tracking-wide shadow-md">
                      {isSale ? (locale === "uz" ? "Sotuv" : "Продажа") : locale === "uz" ? "Ijara" : "Аренда"}
                    </span>
                    {isSold && (
                      <span className="px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-black tracking-wide shadow-md">
                        {locale === "uz" ? "Sotilgan" : "Продано"}
                      </span>
                    )}
                    {isRented && (
                      <span className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-black tracking-wide shadow-md">
                        {locale === "uz" ? "Ijaraga berildi" : "Арендовано"}
                      </span>
                    )}
                    {property.badges &&
                      property.badges.map((b) => {
                        if (b === "top") {
                          return (
                            <span
                              key={b}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-black tracking-wide shadow-md flex items-center gap-1"
                            >
                              ★ {locale === "uz" ? "TOP" : "ТОП"}
                            </span>
                          );
                        }
                        if (b === "new") {
                          return (
                            <span
                              key={b}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold tracking-wide shadow-md"
                            >
                              {locale === "uz" ? "Yangi" : "Новинка"}
                            </span>
                          );
                        }
                        if (b === "tez_sotiladi") {
                          return (
                            <span
                              key={b}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold tracking-wide shadow-md flex items-center gap-1"
                            >
                              ⚡ {locale === "uz" ? "Tez sotiladi" : "Быстрая продажа"}
                            </span>
                          );
                        }
                        if (b === "yaxshi_taklif") {
                          return (
                            <span
                              key={b}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold tracking-wide shadow-md flex items-center gap-1"
                            >
                              % {locale === "uz" ? "Yaxshi taklif" : "Выгодная сделка"}
                            </span>
                          );
                        }
                        return null;
                      })}
                    <span className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
                      {district}
                    </span>
                  </div>

                  {/* Prev/Next arrows if multiple photos */}
                  {property.images.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setActivePhotoIndex((prev) =>
                            prev === 0 ? property.images.length - 1 : prev - 1
                          )
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() =>
                          setActivePhotoIndex((prev) =>
                            prev === property.images.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails row */}
                {property.images.length > 1 && (
                  <div className="p-3 bg-gray-50/80 flex items-center gap-2.5 overflow-x-auto">
                    {property.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`relative w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                          activePhotoIndex === idx
                            ? "border-[#16543C] ring-2 ring-emerald-500/20 scale-105"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <Image src={img} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Key Info */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-gray-200/80 shadow-card space-y-6">
                <div>
                  {/* Badges and Category row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="rounded-xl bg-[#16543C] px-3 py-1 text-xs font-bold tracking-wide text-white shadow-xs">
                      {property.transaction_type === "sale" ? (locale === "uz" ? "Sotuv" : "Продажа") : (locale === "uz" ? "Ijara" : "Аренда")}
                    </span>
                    <span className="rounded-xl bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold border border-slate-200">
                      {getPropertyTypeLabel(property.property_type, locale)}
                    </span>
                    {isPropertyNew(property) && (
                      <span className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
                        {locale === "uz" ? "Yangi" : "Новинка"}
                      </span>
                    )}
                    {property.badges &&
                      property.badges.filter((b) => b !== "new").map((b) => (
                        <span
                          key={b}
                          className={`rounded-xl px-3 py-1 text-xs font-bold text-white shadow-xs ${
                            b === "top"
                              ? "bg-amber-500"
                              : b === "arzon"
                              ? "bg-teal-600"
                              : b === "tez_sotiladi"
                              ? "bg-rose-600"
                              : b === "hamyonbop" || b === "yaxshi_taklif"
                              ? "bg-blue-600"
                              : b === "narxi_tushirildi"
                              ? "bg-purple-600"
                              : "bg-slate-700"
                          }`}
                        >
                          {getBadgeLabel(b, locale)}
                        </span>
                      ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                        {priceDisplay}
                      </div>
                      {property.price_negotiable && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
                          <Handshake className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{locale === "uz" ? "Narxi kelishiladi" : "Цена договорная"}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-gray-500">{secondaryPrice}</div>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-3 leading-snug">
                    {title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500 mt-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#16543C] shrink-0" />
                      <span>{address}</span>
                    </div>
                    {property.published_at && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span>•</span>
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formatPublishedDate(property.published_at, locale)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick specs pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
                  {property.property_type === "house_yard" || property.property_type === "land" ? (
                    <>
                      <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100/80 text-center">
                        <div className="text-xs text-gray-500 font-medium">
                          {locale === "uz" ? "Yer maydoni" : "Участок"}
                        </div>
                        <div className="text-base font-extrabold text-gray-900 mt-0.5">
                          {property.area_sotikh ? `${property.area_sotikh} ${locale === "uz" ? "sotix" : "соток"}` : `${property.area_sqm} ${locale === "uz" ? "m²" : "м²"}`}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100/80 text-center">
                        <div className="text-xs text-gray-500 font-medium">
                          {locale === "uz" ? "Uy maydoni" : "Жилая пл."}
                        </div>
                        <div className="text-base font-extrabold text-gray-900 mt-0.5">
                          {property.living_area_sqm || property.area_sqm} {locale === "uz" ? "m²" : "м²"}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100/80 text-center">
                        <div className="text-xs text-gray-500 font-medium">
                          {locale === "uz" ? "Xonalar" : "Комнаты"}
                        </div>
                        <div className="text-base font-extrabold text-gray-900 mt-0.5">
                          {property.rooms} {locale === "uz" ? "xona" : "комн."}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100/80 text-center">
                        <div className="text-xs text-gray-500 font-medium">
                          {locale === "uz" ? "Ta’mir" : "Ремонт"}
                        </div>
                        <div className="text-base font-extrabold text-[#16543C] mt-0.5 capitalize">
                          {getRenovationLabel(property.renovation, locale)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100/80 text-center">
                        <div className="text-xs text-gray-500 font-medium">{locale === "uz" ? "Umumiy maydon" : "Площадь"}</div>
                        <div className="text-base font-extrabold text-gray-900 mt-0.5">{property.area_sqm} {locale === "uz" ? "m²" : "м²"}</div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100/80 text-center">
                        <div className="text-xs text-gray-500 font-medium">{locale === "uz" ? "Xonalar" : "Комнаты"}</div>
                        <div className="text-base font-extrabold text-gray-900 mt-0.5">{property.rooms} {locale === "uz" ? "xona" : "комн."}</div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100/80 text-center">
                        <div className="text-xs text-gray-500 font-medium">{locale === "uz" ? "Qavat" : "Этаж"}</div>
                        <div className="text-base font-extrabold text-gray-900 mt-0.5">
                          {property.floor ? `${property.floor}/${property.total_floors || "-"}` : "-"}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100/80 text-center">
                        <div className="text-xs text-gray-500 font-medium">{locale === "uz" ? "Ta’mir" : "Ремонт"}</div>
                        <div className="text-base font-extrabold text-[#16543C] mt-0.5 capitalize">
                          {getRenovationLabel(property.renovation, locale)}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Description */}
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <h3 className="text-base font-bold text-gray-900">
                    {locale === "uz" ? "Tavsif" : "Описание"}
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {description}
                  </p>
                </div>

                {/* Additional Note (Bilingual localized) */}
                {getPropertyNote(property, locale) && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-700" />
                      <span>{locale === "uz" ? "Qo‘shimcha eslatma" : "Дополнительная заметка"}</span>
                    </div>
                    <p className="text-xs text-amber-950 leading-relaxed">
                      {getPropertyNote(property, locale)}
                    </p>
                  </div>
                )}

                {/* Video Review Button / Block (Only if video_url is present) */}
                {property.video_url && (
                  <div className="pt-4 border-t border-gray-100">
                    <a
                      href={property.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all active:scale-98 cursor-pointer"
                    >
                      <Video className="w-5 h-5" />
                      <span>{locale === "uz" ? "Uy video obzori" : "Видеообзор дома"}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Grouped Features (Communications, Extra Objects, Advantages) */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-gray-200/80 shadow-card">
                <PropertyGroupedFeaturesView property={property} />
              </div>

              {/* Location Mini-Map */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-gray-200/80 shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#16543C]" />
                    <span>{locale === "uz" ? "Xaritadagi joylashuvi" : "Расположение на карте"}</span>
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">{locale === "uz" ? "Angren shahri" : "г. Ангрен"}</span>
                </div>

                <div className="relative h-72 w-full rounded-2xl overflow-hidden border border-gray-200">
                  <AngrenMap
                    properties={[property]}
                    selectedProperty={property}
                    onSelectProperty={() => {}}
                    mapMode="standard"
                    onMapModeChange={() => {}}
                  />
                </div>

                {/* Infrastructure Around Property ("Atrofida" / "Рядом") */}
                {(property.latitude ?? property.coordinates?.lat) &&
                  (property.longitude ?? property.coordinates?.lng) && (
                    <div className="pt-6 border-t border-gray-100">
                      <PropertyInfrastructureSection
                        latitude={property.latitude ?? property.coordinates.lat}
                        longitude={property.longitude ?? property.coordinates.lng}
                      />
                    </div>
                  )}
              </div>
            </div>

            {/* Right Column (4 cols): Sticky Contact & Action Box */}
            <div className="lg:col-span-4 space-y-6">
              {/* Contact Card */}
              <div className="sticky top-28 p-6 rounded-3xl bg-white border border-gray-200/80 shadow-elevated space-y-6">
                <div className="flex items-center gap-3.5 pb-4 border-b border-gray-100">
                  <div className="relative w-14 h-14 rounded-2xl bg-emerald-950 text-white flex items-center justify-center font-bold text-lg border-2 border-[#16543C] shadow-sm overflow-hidden shrink-0">
                    {property.realtor && property.realtor.is_active && (property.realtor.photo_url || property.realtor.avatar_url) ? (
                      <Image
                        src={property.realtor.photo_url || property.realtor.avatar_url || ""}
                        alt={property.realtor.name}
                        fill
                        className="object-cover"
                      />
                    ) : property.realtor && property.realtor.is_active && property.realtor.name ? (
                      property.realtor.name.slice(0, 2).toUpperCase()
                    ) : (
                      "AE"
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-base">
                      {property.realtor && property.realtor.is_active && property.realtor.name
                        ? property.realtor.name
                        : "ANGREN ESTATE Eksperti"}
                    </div>
                    <div className="text-xs text-[#16543C] font-semibold flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>
                        {property.realtor && property.realtor.is_active
                          ? locale === "uz"
                            ? "Tasdiqlangan rieltor"
                            : "Проверенный риелтор"
                          : locale === "uz"
                          ? "Rasmiy mutaxassis"
                          : "Официальный специалист"}
                      </span>
                    </div>
                  </div>
                </div>

                {isSoldOrRented ? (
                  <div className="space-y-3">
                    <div
                      className={`p-3.5 rounded-2xl text-center text-xs font-bold ${
                        isSold
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {isSold
                        ? locale === "uz"
                          ? "Obyekt sotilgan (Mavjud emas)"
                          : "Объект продан (Недоступен)"
                        : locale === "uz"
                        ? "Obyekt ijaraga berilgan"
                        : "Объект сдан в аренду"}
                    </div>

                    <Link
                      href="/"
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#16543C] hover:bg-[#113F2D] text-white text-sm font-bold shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>
                        {locale === "uz" ? "Boshqa e'lonlarni ko‘rish" : "Смотреть другие объекты"}
                      </span>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <a
                      href={`tel:${property.contact_phone}`}
                      onClick={handleCallClick}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#16543C] hover:bg-[#113F2D] text-white text-sm font-bold shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{property.contact_phone}</span>
                    </a>

                    {property.contact_telegram && (
                      <a
                        href={`https://t.me/${property.contact_telegram.replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleTelegramClick}
                        className="w-full py-3.5 px-4 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                      >
                        <Send className="w-4 h-4" />
                        <span>{locale === "uz" ? "Telegram orqali yozish" : "Написать в Telegram"}</span>
                      </a>
                    )}

                    {property.realtor && property.realtor.is_active && (property.realtor.instagram_url || property.realtor.instagram) && (
                      <a
                        href={(property.realtor.instagram_url || property.realtor.instagram) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-4 rounded-2xl border border-pink-200 bg-pink-50/60 hover:bg-pink-100 text-pink-700 text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-98"
                      >
                        <Instagram className="w-4 h-4 text-pink-600" />
                        <span>Instagram</span>
                      </a>
                    )}

                    {/* Realtor Profile Button */}
                    <Link
                      href="/kontaktlar#realtors"
                      className="w-full py-3 px-4 rounded-2xl border border-gray-200 hover:border-[#16543C] bg-gray-50 hover:bg-emerald-50/50 text-gray-700 hover:text-[#16543C] text-sm font-bold shadow-xs flex items-center justify-center gap-2 transition-all active:scale-98"
                    >
                      <UserCheck className="w-4 h-4 text-[#16543C]" />
                      <span>{locale === "uz" ? "Rieltor profili" : "Профиль риелтора"}</span>
                    </Link>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-gray-600 space-y-1.5">
                  <div className="font-bold text-[#16543C] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{locale === "uz" ? "Xavfsiz bitim kafolati" : "Гарантия безопасной сделки"}</span>
                  </div>
                  <p>
                    {locale === "uz"
                      ? "Barcha hujjatlar va kadastr ma’lumotlari mutaxassislar tomonidan to‘liq tekshirilgan."
                      : "Все документы и кадастровые данные полностью проверены специалистами."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
