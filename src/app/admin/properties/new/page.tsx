"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Building2,
  MapPin,
  Camera,
  Flame,
  Droplet,
  Zap,
  CheckCircle2,
  Layers,
  Sparkles,
  DollarSign,
  FileText,
  Phone,
  Send,
  Trash2,
  Plus,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useProperties } from "@/lib/propertyStore";
import { useRealtors } from "@/lib/realtorStore";
import { PropertyImageUploader } from "@/components/admin/PropertyImageUploader";
import dynamic from "next/dynamic";
import {
  PropertyType,
  TransactionType,
  RenovationType,
  PropertyStatus,
} from "@/lib/types";

const AdminLocationPicker = dynamic(
  () => import("@/components/admin/AdminLocationPicker").then((mod) => mod.AdminLocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 rounded-2xl bg-slate-100 flex flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-400">
        <div className="h-7 w-7 rounded-full border-2 border-[#16543C] border-t-transparent animate-spin" />
        <span>Angren interaktiv xaritasi yuklanmoqda...</span>
      </div>
    ),
  }
);

export default function AddPropertyPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const { exchangeRate } = useCurrency();
  const { addProperty } = useProperties();
  const { realtors } = useRealtors();

  const [activeStep, setActiveStep] = useState(1);
  const totalSteps = 6; // Grouped logically into 6 comprehensive stages

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const s = Number(urlParams.get("step"));
      if (s >= 1 && s <= 6) {
        setActiveStep(s);
      }
      const dt = urlParams.get("deal_type");
      if (dt === "sale" || dt === "rent") {
        setTransactionType(dt);
      }
      const pt = urlParams.get("property_type");
      if (pt) {
        const validTypes: PropertyType[] = ["apartment", "house_yard", "commercial", "land", "new_build", "other"];
        if (validTypes.includes(pt as PropertyType)) {
          setPropertyType(pt as PropertyType);
        } else if (pt === "kvartira") {
          setPropertyType("apartment");
        } else if (pt === "uy_hovli" || pt === "hovli" || pt === "dala_hovli" || pt === "house") {
          setPropertyType("house_yard");
        } else if (pt === "tijorat") {
          setPropertyType("commercial");
        } else if (pt === "yer_uchastkasi") {
          setPropertyType("land");
        }
      }
      const addr = urlParams.get("address") || urlParams.get("location");
      if (addr) {
        setAddressUz(addr);
        setAddressRu(addr);
      }
      const title = urlParams.get("title");
      if (title) {
        setTitleUz(title);
        setTitleRu(title);
      }
      const desc = urlParams.get("description") || urlParams.get("desc");
      if (desc) {
        setDescUz(desc);
        setDescRu(desc);
      }
    }
  }, []);

  // Form State
  const [transactionType, setTransactionType] = useState<TransactionType>("sale");
  const [propertyType, setPropertyType] = useState<PropertyType>("apartment");
  const [titleUz, setTitleUz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [descUz, setDescUz] = useState("");
  const [descRu, setDescRu] = useState("");
  const [priceUzs, setPriceUzs] = useState(450000000);
  const [priceUsd, setPriceUsd] = useState(35000);
  const [currency, setCurrency] = useState<"UZS" | "USD">("USD");

  // Location
  const [district, setDistrict] = useState("Markaz");
  const [addressUz, setAddressUz] = useState("");
  const [addressRu, setAddressRu] = useState("");
  const [lat, setLat] = useState(41.0167);
  const [lng, setLng] = useState(70.1436);
  const [polygonCoords, setPolygonCoords] = useState<string>("");
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);

  // Specs
  const [areaSqm, setAreaSqm] = useState(65);
  const [livingAreaSqm, setLivingAreaSqm] = useState(48);
  const [areaSotikh, setAreaSotikh] = useState(0);
  const [rooms, setRooms] = useState(3);
  const [floor, setFloor] = useState(4);
  const [totalFloors, setTotalFloors] = useState(9);
  const [facadeM, setFacadeM] = useState<number | "">("");
  const [depthM, setDepthM] = useState<number | "">("");
  const [renovation, setRenovation] = useState<RenovationType>("euro");

  // Amenities & Utilities (6 core options + custom)
  const [utilities, setUtilities] = useState<{
    electricity: boolean;
    gas: boolean;
    cold_water: boolean;
    hot_water: boolean;
    heating: boolean;
    internet: boolean;
    custom?: string[];
  }>({
    electricity: true,
    gas: true,
    cold_water: true,
    hot_water: true,
    heating: true,
    internet: true,
    custom: [],
  });
  const [customUtilityInput, setCustomUtilityInput] = useState("");
  const [amenities, setAmenities] = useState({
    furniture: false,
    parking: true,
    elevator: true,
    ac: true,
    balcony: true,
    internet: true,
  });

  // Media
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [mainImage, setMainImage] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState("");

  // Contact & Realtor
  const [selectedRealtorId, setSelectedRealtorId] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [contactPhone, setContactPhone] = useState("+998 90 123 45 67");
  const [contactTelegram, setContactTelegram] = useState("@angrenestate_admin");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const DRAFT_KEY = "angren_new_property_draft_v2";
  const [draftAvailable, setDraftAvailable] = useState(false);

  const isDirty = Boolean(
    titleUz ||
    titleRu ||
    descUz ||
    descRu ||
    addressUz ||
    addressRu ||
    videoUrl ||
    selectedRealtorId
  );

  // Check for unsaved draft on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.titleUz || parsed.addressUz || parsed.priceUzs)) {
            setDraftAvailable(true);
          }
        }
      } catch (e) {}
    }
  }, []);

  // Auto-save draft to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined" || !isDirty || isSubmitting) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            transactionType,
            propertyType,
            titleUz,
            titleRu,
            descUz,
            descRu,
            priceUzs,
            priceUsd,
            currency,
            district,
            addressUz,
            addressRu,
            lat,
            lng,
            areaSqm,
            livingAreaSqm,
            areaSotikh,
            rooms,
            floor,
            totalFloors,
            renovation,
            utilities,
            amenities,
            imageUrls,
            mainImage,
            videoUrl,
            selectedRealtorId,
            contactPhone,
            contactTelegram,
          })
        );
      } catch (e) {}
    }, 800);
    return () => clearTimeout(timer);
  }, [
    isDirty,
    isSubmitting,
    transactionType,
    propertyType,
    titleUz,
    titleRu,
    descUz,
    descRu,
    priceUzs,
    priceUsd,
    currency,
    district,
    addressUz,
    addressRu,
    lat,
    lng,
    areaSqm,
    livingAreaSqm,
    areaSotikh,
    rooms,
    floor,
    totalFloors,
    renovation,
    utilities,
    amenities,
    imageUrls,
    mainImage,
    videoUrl,
    selectedRealtorId,
    contactPhone,
    contactTelegram,
  ]);

  // Warn user on page exit if form has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitting) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isSubmitting]);

  const restoreDraft = () => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.transactionType) setTransactionType(d.transactionType);
      if (d.propertyType) setPropertyType(d.propertyType);
      if (d.titleUz) setTitleUz(d.titleUz);
      if (d.titleRu) setTitleRu(d.titleRu);
      if (d.descUz) setDescUz(d.descUz);
      if (d.descRu) setDescRu(d.descRu);
      if (d.priceUzs) setPriceUzs(d.priceUzs);
      if (d.priceUsd) setPriceUsd(d.priceUsd);
      if (d.district) setDistrict(d.district);
      if (d.addressUz) setAddressUz(d.addressUz);
      if (d.addressRu) setAddressRu(d.addressRu);
      if (d.lat) setLat(d.lat);
      if (d.lng) setLng(d.lng);
      if (d.areaSqm) setAreaSqm(d.areaSqm);
      if (d.livingAreaSqm) setLivingAreaSqm(d.livingAreaSqm);
      if (d.rooms) setRooms(d.rooms);
      if (d.floor) setFloor(d.floor);
      if (d.totalFloors) setTotalFloors(d.totalFloors);
      if (d.renovation) setRenovation(d.renovation);
      if (d.utilities) setUtilities(d.utilities);
      if (d.amenities) setAmenities(d.amenities);
      if (Array.isArray(d.imageUrls) && d.imageUrls.length > 0) setImageUrls(d.imageUrls);
      if (d.mainImage) setMainImage(d.mainImage);
      if (d.videoUrl) setVideoUrl(d.videoUrl);
      if (d.selectedRealtorId) setSelectedRealtorId(d.selectedRealtorId);
      if (d.contactPhone) setContactPhone(d.contactPhone);
      if (d.contactTelegram) setContactTelegram(d.contactTelegram);
      setDraftAvailable(false);
    } catch (e) {}
  };

  const discardDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setDraftAvailable(false);
  };

  const handleSave = async (status: PropertyStatus) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSaveError(null);
    // Parse polygon if provided
    let parsedPolygon: [number, number][] | undefined = undefined;
    if (polygonCoords.trim()) {
      try {
        parsedPolygon = JSON.parse(polygonCoords);
      } catch {
        // Simple fallback box
        parsedPolygon = [
          [lat + 0.0005, lng - 0.0005],
          [lat + 0.0005, lng + 0.0005],
          [lat - 0.0005, lng + 0.0005],
          [lat - 0.0005, lng - 0.0005],
        ];
      }
    }

    try {
      const created = await addProperty({
        slug: `angren-${propertyType}-${Date.now().toString().slice(-6)}`,
        title_uz: titleUz || "Angren ko‘chmas mulk obyekti",
        title_ru: titleRu || "Объект недвижимости в Ангрене",
        description_uz: descUz || "Angren shahrida joylashgan qulay ko‘chmas mulk.",
        description_ru: descRu || "Удобный объект недвижимости в городе Ангрен.",
        address_uz: addressUz || "Angren sh., Markaz",
        address_ru: addressRu || "г. Ангрен, Центр",
        district_name_uz: district,
        district_name_ru: district,
        transaction_type: transactionType,
        property_type: propertyType,
        status,
        price_uzs: priceUzs,
        price_usd: priceUsd,
        area_sqm: areaSqm,
        living_area_sqm: livingAreaSqm,
        area_sotikh: areaSotikh > 0 ? areaSotikh : undefined,
        rooms,
        floor,
        total_floors: totalFloors,
        renovation,
        images: imageUrls,
        photos: imageUrls,
        main_image: mainImage || imageUrls[0] || undefined,
        video_url: videoUrl || undefined,
        coordinates: { lat, lng },
        polygon: parsedPolygon,
        utilities,
        amenities,
        facade_m: facadeM ? Number(facadeM) : undefined,
        depth_m: depthM ? Number(depthM) : undefined,
        dimensions: facadeM && depthM ? `${facadeM} × ${depthM} m` : undefined,
        contact_phone: contactPhone || "+998 90 123 45 67",
        contact_telegram: contactTelegram,
        owner_phone: ownerPhone || undefined,
        realtor_id: selectedRealtorId || undefined,
      });

      if (!created) {
        throw new Error(
          locale === "uz"
            ? "Obyektni saqlashda xatolik yuz berdi. Iltimos, ma’lumotlarni tekshirib qayta urinib ko‘ring."
            : "Ошибка при сохранении объекта. Пожалуйста, проверьте данные и попробуйте снова."
        );
      }

      // Clear session draft on successful save
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch (e) {}

      router.push("/admin/properties");
    } catch (e: any) {
      console.error("Error creating property:", e);
      setSaveError(e?.message || (locale === "uz" ? "Obyektni saqlashda xatolik yuz berdi" : "Ошибка при сохранении"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/properties"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              {locale === "uz" ? "Yangi obyekt yaratish" : "Создание нового объекта"}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === "uz" ? `${activeStep}-bosqich (${totalSteps} dan)` : `Этап ${activeStep} из ${totalSteps}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave("draft")}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors disabled:opacity-50"
          >
            {locale === "uz" ? "Qoralama sifatida saqlash" : "В черновики"}
          </button>
          <button
            onClick={() => handleSave("published")}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-[#16543C] text-white hover:bg-[#0E3324] font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting
              ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
              : locale === "uz" ? "Nashr qilish" : "Опубликовать"}
          </button>
        </div>
      </div>

      {/* Save Error Banner */}
      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-900 text-xs font-bold shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Unsaved Draft Recovery Banner */}
      {draftAvailable && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">
                {locale === "uz" ? "Saqlanmagan qoralama mavjud!" : "Обнаружен несохраненный черновик!"}
              </span>{" "}
              {locale === "uz"
                ? "Oldingi to‘ldirilgan ma’lumotlarni formaga qaytarishni xohlaysizmi?"
                : "Хотите восстановить ранее введенные данные?"}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={restoreDraft}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-xs"
            >
              {locale === "uz" ? "Tiklash" : "Восстановить"}
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-3 py-1.5 rounded-xl border border-amber-300 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition-colors"
            >
              {locale === "uz" ? "Bekor qilish" : "Отклонить"}
            </button>
          </div>
        </div>
      )}

      {/* Steps Progress Tabs */}
      <div className="grid grid-cols-6 gap-2 text-xs font-bold select-none">
        {[
          { step: 1, label: "Turi & Narxi" },
          { step: 2, label: "Sarlavha & Matn" },
          { step: 3, label: "Manzil & Xarita" },
          { step: 4, label: "Parametrlar" },
          { step: 5, label: "Rasmlar & Aloqa" },
          { step: 6, label: "Ko‘rib chiqish" },
        ].map((item) => (
          <button
            key={item.step}
            onClick={() => setActiveStep(item.step)}
            className={`py-2.5 px-2 rounded-xl text-center border transition-all truncate ${
              activeStep === item.step
                ? "bg-[#16543C] text-white border-emerald-800 shadow-xs"
                : activeStep > item.step
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-white text-slate-500 font-medium border-slate-200 hover:text-slate-800"
            }`}
          >
            <span className="mr-1">{item.step}.</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Step Forms Container */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* STEP 1: Bitim turi, Obyekt turi & Narx */}
        {activeStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              1. Bitim va Ko‘chmas mulk turi
            </h2>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Bitim turi</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTransactionType("sale")}
                  className={`p-4 rounded-2xl border text-center font-bold text-sm transition-all ${
                    transactionType === "sale"
                      ? "border-[#16543C] bg-emerald-50 text-[#16543C] ring-2 ring-[#16543C]"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Sotuv (Ko‘chmas mulkni sotish)
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType("rent")}
                  className={`p-4 rounded-2xl border text-center font-bold text-sm transition-all ${
                    transactionType === "rent"
                      ? "border-[#16543C] bg-emerald-50 text-[#16543C] ring-2 ring-[#16543C]"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Ijara (Oylik ijara)
                </button>
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Ko‘chmas mulk turi</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: "apartment", label: "Kvartira" },
                  { key: "house_yard", label: "Hovli / Kottej" },
                  { key: "new_build", label: "Yangi bino (Novostroyka)" },
                  { key: "land", label: "Yer maydoni" },
                  { key: "commercial", label: "Tijorat binosi" },
                  { key: "other", label: "Boshqa" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setPropertyType(t.key as PropertyType)}
                    className={`p-3.5 rounded-2xl border text-center font-bold text-xs transition-all ${
                      propertyType === t.key
                        ? "border-[#16543C] bg-emerald-50 text-[#16543C] ring-2 ring-[#16543C]"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Narx (USD $)</label>
                <input
                  type="number"
                  value={priceUsd}
                  onChange={(e) => {
                    const usd = Number(e.target.value);
                    setPriceUsd(usd);
                    setPriceUzs(Math.round(usd * exchangeRate));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-sm font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Narx (UZS so‘mda)</label>
                <input
                  type="number"
                  value={priceUzs}
                  onChange={(e) => {
                    const uzs = Number(e.target.value);
                    setPriceUzs(uzs);
                    setPriceUsd(Math.round(uzs / exchangeRate));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-sm font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Sarlavha & Tavsiflar (Bilingual UZ / RU) */}
        {activeStep === 2 && (
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              2. Sarlavha va Tavsif (UZ & RU)
            </h2>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Sarlavha (O‘zbekcha - Lotin)</label>
              <input
                type="text"
                value={titleUz}
                onChange={(e) => setTitleUz(e.target.value)}
                placeholder="Masalan: Angren markazida 3 xonali ta’mirlangan kvartira"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Sarlavha (Русский)</label>
              <input
                type="text"
                value={titleRu}
                onChange={(e) => setTitleRu(e.target.value)}
                placeholder="Например: 3-комнатная квартира с ремонтом в центре Ангрена"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Batafsil tavsif (UZ)</label>
                <textarea
                  rows={4}
                  value={descUz}
                  onChange={(e) => setDescUz(e.target.value)}
                  placeholder="Kvartira qavatida, atrofida bog‘cha, maktab, bozor joylashgan..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Описание объекта (RU)</label>
                <textarea
                  rows={4}
                  value={descRu}
                  onChange={(e) => setDescRu(e.target.value)}
                  placeholder="Квартира на удобном этаже, рядом детский сад, школа, рынок..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Manzil & Xarita koordinatalari / Polygon */}
        {activeStep === 3 && (
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              3. Joylashuv va Xarita (Koordinatalar & Polygon)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tuman / Daha (Angren)</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                >
                  <option value="Markaz">Markaz (Центр)</option>
                  <option value="1/1 dahasi">1/1 dahasi</option>
                  <option value="2/3 dahasi">2/3 dahasi</option>
                  <option value="5/1 dahasi">5/1 dahasi</option>
                  <option value="5/2 dahasi">5/2 dahasi</option>
                  <option value="Dukent">Dukent</option>
                  <option value="Yangiobod">Yangiobod</option>
                  <option value="Geolog">Geolog</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Aniq manzil (Ko‘cha va uy)</label>
                <input
                  type="text"
                  value={addressUz}
                  onChange={(e) => setAddressUz(e.target.value)}
                  placeholder="Mustaqillik shoh ko‘chasi, 12-uy"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>
            </div>

            {/* Interactive Location & Polygon Picker Map */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#16543C]" />
                  <span>Xaritada nuqtani belgilash (Draggable pin & Polygon)</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  Xaritadagi belgini suring yoki kerakli joyni bosing
                </span>
              </div>

              <AdminLocationPicker
                lat={lat}
                lng={lng}
                onChangeCoordinates={(coords) => {
                  setLat(coords.lat);
                  setLng(coords.lng);
                }}
                polygonCoords={polygonPoints}
                onChangePolygon={(pts) => {
                  setPolygonPoints(pts);
                  setPolygonCoords(pts.length > 0 ? JSON.stringify(pts) : "");
                }}
                isLandOrYard={propertyType === "house_yard" || propertyType === "land"}
              />
            </div>

            {/* Polygon Boundary Drawer JSON fallback for Houses and Lands */}
            {(propertyType === "house_yard" || propertyType === "land") && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-[#16543C]">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Yer / Hovli ko‘p burchakli chegarasi (GeoJSON / Koord Array)</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">
                    {polygonPoints.length > 0 ? `${polygonPoints.length} ta nuqta belgilandi` : "Nuqtalar yo‘q"}
                  </span>
                </div>
                <input
                  type="text"
                  value={polygonCoords}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPolygonCoords(val);
                    try {
                      const parsed = JSON.parse(val);
                      if (Array.isArray(parsed)) setPolygonPoints(parsed);
                    } catch {}
                  }}
                  placeholder="Xaritada 'Polygon chizish' tugmasini bosing yoki JSON kiriting"
                  className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-xs font-mono"
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Texnik xususiyatlar, Kommunikatsiya & Qulayliklar */}
        {activeStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              4. Texnik parametrlar va Qulayliklar
            </h2>

            {/* Area, Dimensions & Rooms (Dynamic by Property Type) */}
            {propertyType === "land" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Yer maydoni — Sotix (сотих)</label>
                  <input
                    type="number"
                    value={areaSotikh || ""}
                    onChange={(e) => setAreaSotikh(Number(e.target.value))}
                    placeholder="Masalan: 6"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Fasad kengligi (metrda)</label>
                  <input
                    type="number"
                    value={facadeM}
                    onChange={(e) => setFacadeM(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Masalan: 15"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Uzunligi / Chuqurligi (metrda)</label>
                  <input
                    type="number"
                    value={depthM}
                    onChange={(e) => setDepthM(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Masalan: 40"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>
            ) : propertyType === "house_yard" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Yer maydoni — Sotix (сотих)</label>
                  <input
                    type="number"
                    value={areaSotikh || ""}
                    onChange={(e) => setAreaSotikh(Number(e.target.value))}
                    placeholder="Masalan: 6"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Uy maydoni (m²)</label>
                  <input
                    type="number"
                    value={areaSqm}
                    onChange={(e) => setAreaSqm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Xonalar soni</label>
                  <input
                    type="number"
                    value={rooms}
                    onChange={(e) => setRooms(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Fasad kengligi (metrda)</label>
                  <input
                    type="number"
                    value={facadeM}
                    onChange={(e) => setFacadeM(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Masalan: 15"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Uzunligi / Chuqurligi (metrda)</label>
                  <input
                    type="number"
                    value={depthM}
                    onChange={(e) => setDepthM(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Masalan: 40"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Yashash maydoni (m²)</label>
                  <input
                    type="number"
                    value={livingAreaSqm}
                    onChange={(e) => setLivingAreaSqm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Umumiy maydon (m²)</label>
                  <input
                    type="number"
                    value={areaSqm}
                    onChange={(e) => setAreaSqm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Yashash maydoni (m²)</label>
                  <input
                    type="number"
                    value={livingAreaSqm}
                    onChange={(e) => setLivingAreaSqm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Xonalar soni</label>
                  <input
                    type="number"
                    value={rooms}
                    onChange={(e) => setRooms(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Qavat / Jami qavatlar</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={floor}
                      onChange={(e) => setFloor(Number(e.target.value))}
                      className="w-1/2 px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                    <span>/</span>
                    <input
                      type="number"
                      value={totalFloors}
                      onChange={(e) => setTotalFloors(Number(e.target.value))}
                      className="w-1/2 px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Core Communications (6 predefined options) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Асосий коммуникациялар (6 та стандарт параметр)
                </label>
                <span className="text-[11px] text-slate-500 font-medium">Ҳаётий муҳим тармоқлар</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-bold">
                {[
                  { key: "electricity", label: "Свет (Электр тармоғи)" },
                  { key: "gas", label: "Газ (Табиий газ)" },
                  { key: "cold_water", label: "Совуқ сув (Ичимлик суви)" },
                  { key: "hot_water", label: "Иссиқ сув" },
                  { key: "heating", label: "Отопление (Иситиш)" },
                  { key: "internet", label: "Интернет (Оптик тола / Wi-Fi)" },
                ].map((u) => (
                  <label
                    key={u.key}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                      utilities[u.key as keyof typeof utilities]
                        ? "bg-emerald-50 border-emerald-500 text-[#16543C]"
                        : "border-slate-200 text-slate-600 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(utilities[u.key as keyof typeof utilities])}
                      onChange={(e) =>
                        setUtilities({ ...utilities, [u.key]: e.target.checked })
                      }
                      className="rounded text-[#16543C] focus:ring-[#16543C]"
                    />
                    <span>{u.label}</span>
                  </label>
                ))}
              </div>

              {/* Custom Options Adder */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  Қўшимча коммуникация / қулайлик (Custom option)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customUtilityInput}
                    onChange={(e) => setCustomUtilityInput(e.target.value)}
                    placeholder="Масалан: Артезиан қудуқ, Генератор, Трансформатор..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customUtilityInput.trim()) {
                          const list = utilities.custom || [];
                          if (!list.includes(customUtilityInput.trim())) {
                            setUtilities({
                              ...utilities,
                              custom: [...list, customUtilityInput.trim()],
                            });
                          }
                          setCustomUtilityInput("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customUtilityInput.trim()) {
                        const list = utilities.custom || [];
                        if (!list.includes(customUtilityInput.trim())) {
                          setUtilities({
                            ...utilities,
                            custom: [...list, customUtilityInput.trim()],
                          });
                        }
                        setCustomUtilityInput("");
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-[#16543C] text-white text-xs font-bold hover:bg-[#0E3324] transition-colors"
                  >
                    + Қўшиш
                  </button>
                </div>
                {Array.isArray(utilities.custom) && utilities.custom.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {utilities.custom.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUtilities({
                              ...utilities,
                              custom: utilities.custom?.filter((_, i) => i !== idx),
                            });
                          }}
                          className="hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Amenities Checkboxes */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700">Qo‘shimcha jihozlar</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {(["furniture", "parking", "elevator", "ac", "balcony", "internet"] as const).map((a) => (
                  <label key={a} className="flex items-center gap-2 p-2.5 rounded-xl border bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={amenities[a]}
                      onChange={(e) => setAmenities({ ...amenities, [a]: e.target.checked })}
                      className="rounded text-[#16543C]"
                    />
                    <span className="capitalize">{a}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Media & Mas'ul Rieltor & Owner Phone */}
        {activeStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              5. Suratlar, Mas'ul Rieltor va Aloqa
            </h2>

            {/* Images */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700">Obyekt suratlari</label>
              <PropertyImageUploader
                images={imageUrls}
                mainImage={mainImage}
                onChangeImages={setImageUrls}
                onChangeMainImage={setMainImage}
                propertyId="new"
              />
            </div>

            {/* Assigned Realtor (Assign / Change / Unassign) */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Масъул Риелторни бириктириш (Assign / Change / Unassign)
                </label>
                {selectedRealtorId && (
                  <button
                    type="button"
                    onClick={() => setSelectedRealtorId("")}
                    className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                  >
                    <span>Риелторни бўшатиш (Unassign)</span>
                  </button>
                )}
              </div>
              <select
                value={selectedRealtorId}
                onChange={(e) => setSelectedRealtorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
              >
                <option value="">(Риелторсиз — Ангрен Эстейт маъмурияти)</option>
                {realtors.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phone}) — {r.specialization_uz}
                  </option>
                ))}
              </select>
            </div>

            {/* Owner Direct Phone (Dedicated Field) */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Мулк эгасининг телефони (Owner Phone)</span>
                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                  Фақат админга кўринади
                </span>
              </label>
              <input
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+998 90 123 45 67 (Мулк эгаси рақами)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-amber-50/20"
              />
              <p className="text-[11px] text-slate-500">
                Ушбу рақам саҳифада оммавий кўринмайди, фақат админ панелида мулк эгаси билан тўғридан-тўғри боғланиш учун сақланади.
              </p>
            </div>

            {/* Public Contact Phone */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800">
                Эълонда чиқувчи оммавий телефон (Contact Phone)
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
              />
            </div>
          </div>
        )}

        {/* STEP 6: Yakuniy ko‘rib chiqish (Preview) */}
        {activeStep === 6 && (
          <div className="space-y-6">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              6. Yakuniy ko‘rib chiqish
            </h2>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {transactionType === "sale" ? "Sotuv" : "Ijara"} • {propertyType}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-2">
                    {titleUz || "Sarlavha kiritilmagan"}
                  </h3>
                  <p className="text-xs text-slate-500">{district}, {addressUz}</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-[#16543C]">${priceUsd.toLocaleString()}</div>
                  <div className="text-xs text-slate-600 font-medium">{(priceUzs / 1000000).toFixed(0)} mln UZS</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs pt-2 border-t border-slate-200">
                <div className="p-2 bg-white rounded-xl">
                  <span className="text-slate-600 font-bold text-[10px]">Maydon</span>
                  <div className="font-bold">{areaSqm} m²</div>
                </div>
                <div className="p-2 bg-white rounded-xl">
                  <span className="text-slate-600 font-bold text-[10px]">Xonalar</span>
                  <div className="font-bold">{rooms}</div>
                </div>
                <div className="p-2 bg-white rounded-xl">
                  <span className="text-slate-600 font-bold text-[10px]">Qavat</span>
                  <div className="font-bold">{floor}/{totalFloors}</div>
                </div>
                <div className="p-2 bg-white rounded-xl">
                  <span className="text-slate-600 font-bold text-[10px]">Ta'mir</span>
                  <div className="font-bold capitalize">{renovation}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-100"
              >
                Qoralama sifatida saqlash
              </button>
              <button
                type="button"
                onClick={() => handleSave("published")}
                className="px-6 py-2.5 rounded-xl bg-[#16543C] hover:bg-[#0E3324] text-white font-black text-xs shadow-md"
              >
                ✓ Saytda darhol nashr qilish
              </button>
            </div>
          </div>
        )}

        {/* Step Navigation Bottom Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={activeStep === 1}
            onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Orqaga
          </button>

          {activeStep < totalSteps && (
            <button
              type="button"
              onClick={() => setActiveStep((prev) => Math.min(totalSteps, prev + 1))}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              Keyingisi →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
