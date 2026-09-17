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
  Globe,
  Languages,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useProperties } from "@/lib/propertyStore";
import { useRealtors } from "@/lib/realtorStore";
import { PropertyImageUploader } from "@/components/admin/PropertyImageUploader";
import { HududPolygonDrawerModal } from "@/components/admin/HududPolygonDrawerModal";
import dynamic from "next/dynamic";
import {
  PropertyType,
  TransactionType,
  RenovationType,
  PropertyStatus,
  HududItem,
} from "@/lib/types";
import {
  getPropertyTypeLabel,
  getDealTypeLabel,
  getBadgeLabel,
  getPropertyStatusLabel,
  getRenovationLabel,
} from "@/lib/propertyFormatters";

const AdminLocationPicker = dynamic(
  () => import("@/components/admin/AdminLocationPicker").then((mod) => mod.AdminLocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 rounded-2xl bg-slate-100 flex flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-400">
        <div className="h-7 w-7 rounded-full border-2 border-[#16543C] border-t-transparent animate-spin" />
        <span>Загрузка карты...</span>
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

  // Badges state
  const [isTop, setIsTop] = useState(false);
  const [isFastSale, setIsFastSale] = useState(false);
  const [isGoodDeal, setIsGoodDeal] = useState(false);

  // Hudud state
  const [hududId, setHududId] = useState("");
  const [hududList, setHududList] = useState<HududItem[]>([]);
  const [isHududModalOpen, setIsHududModalOpen] = useState(false);

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationNotice, setTranslationNotice] = useState<{
    type: "success" | "error" | "info";
    msg: string;
  } | null>(null);

  const handleAutoTranslate = async (direction: "uz_to_ru" | "ru_to_uz") => {
    setIsTranslating(true);
    setTranslationNotice(null);
    try {
      const from = direction === "uz_to_ru" ? "uz" : "ru";
      const to = direction === "uz_to_ru" ? "ru" : "uz";
      const sourceTitle = from === "uz" ? titleUz : titleRu;
      const sourceDesc = from === "uz" ? descUz : descRu;

      if (!sourceTitle && !sourceDesc) {
        setTranslationNotice({
          type: "info",
          msg:
            locale === "uz"
              ? "Avval manba tilida sarlavha yoki tavsifni kiriting."
              : "Сначала введите заголовок или описание на исходном языке.",
        });
        setIsTranslating(false);
        return;
      }

      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            { key: "title", text: sourceTitle, from, to },
            { key: "desc", text: sourceDesc, from, to },
          ],
        }),
      });

      const data = await res.json();
      if (data?.success && Array.isArray(data.results)) {
        for (const item of data.results) {
          if (item.key === "title" && item.result?.translatedText) {
            if (to === "ru") setTitleRu(item.result.translatedText);
            else setTitleUz(item.result.translatedText);
          }
          if (item.key === "desc" && item.result?.translatedText) {
            if (to === "ru") setDescRu(item.result.translatedText);
            else setDescUz(item.result.translatedText);
          }
        }
        setTranslationNotice({
          type: "success",
          msg:
            locale === "uz"
              ? "Kontent muvaffaqiyatli tarjima qilindi. Natijani tekshirishingiz mumkin."
              : "Контент успешно переведен. Вы можете проверить и отредактировать результат.",
        });
      } else {
        setTranslationNotice({
          type: "error",
          msg:
            data?.error ||
            (locale === "uz"
              ? "Tarjima xizmati javob bermadi. Matnni qo‘lda kiritishingiz mumkin."
              : "Сервис перевода недоступен. Вы можете ввести перевод вручную."),
        });
      }
    } catch {
      setTranslationNotice({
        type: "error",
        msg:
          locale === "uz"
            ? "Tarjimada xatolik yuz berdi. Matnni qo‘lda kiritishingiz mumkin."
            : "Ошибка при переводе. Вы можете ввести перевод вручную.",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    fetch("/api/hududs")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.hududs)) {
          setHududList(d.hududs);
        }
      })
      .catch((e) => console.error("Error fetching hududs:", e));
  }, []);

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
        hudud_id: hududId || undefined,
        transaction_type: transactionType,
        property_type: propertyType,
        status,
        price_uzs: priceUzs,
        price_usd: priceUsd,
        area_sqm: areaSqm,
        living_area_sqm: livingAreaSqm,
        area_sotikh:
          (propertyType === "house_yard" || propertyType === "land") && areaSotikh > 0
            ? Number(areaSotikh)
            : undefined,
        is_top: isTop,
        is_fast_sale: isFastSale,
        is_good_deal: isGoodDeal,
        badges: [
          ...(isTop ? ["top" as const] : []),
          ...(isFastSale ? ["tez_sotiladi" as const] : []),
          ...(isGoodDeal ? ["yaxshi_taklif" as const] : []),
        ],
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
          { step: 1, label: locale === "uz" ? "Turi & Narxi" : "Тип и цена" },
          { step: 2, label: locale === "uz" ? "Sarlavha & Matn" : "Заголовок и текст" },
          { step: 3, label: locale === "uz" ? "Manzil & Xarita" : "Адрес и карта" },
          { step: 4, label: locale === "uz" ? "Parametrlar" : "Параметры" },
          { step: 5, label: locale === "uz" ? "Rasmlar & Aloqa" : "Фото и контакты" },
          { step: 6, label: locale === "uz" ? "Ko‘rib chiqish" : "Просмотр" },
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
              {locale === "uz" ? "1. Bitim va ko‘chmas mulk turi" : "1. Сделка и тип недвижимости"}
            </h2>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                {locale === "uz" ? "Bitim turi" : "Тип сделки"}
              </label>
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
                  {locale === "uz" ? "Sotuv (Ko‘chmas mulkni sotish)" : "Продажа (Продажа недвижимости)"}
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
                  {locale === "uz" ? "Ijara (Oylik ijara)" : "Аренда (Ежемесячная аренда)"}
                </button>
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                {locale === "uz" ? "Ko‘chmas mulk turi" : "Тип недвижимости"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: "apartment", label: getPropertyTypeLabel("apartment", locale) },
                  { key: "house_yard", label: getPropertyTypeLabel("house_yard", locale) },
                  { key: "new_build", label: getPropertyTypeLabel("new_build", locale) },
                  { key: "land", label: getPropertyTypeLabel("land", locale) },
                  { key: "commercial", label: getPropertyTypeLabel("commercial", locale) },
                  { key: "other", label: getPropertyTypeLabel("other", locale) },
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
                <label className="text-xs font-bold text-slate-700">
                  {locale === "uz" ? "Narx (USD $)" : "Цена (USD $)"}
                </label>
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
                <label className="text-xs font-bold text-slate-700">
                  {locale === "uz" ? "Narx (UZS so‘mda)" : "Цена (UZS сум)"}
                </label>
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

            {/* Property Badges Section */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-800">
                  {locale === "uz" ? "E’lon nishonlari (Marketing nishonlari)" : "Значки объявления (Маркетинговые значки)"}
                </label>
                <p className="text-[11px] text-slate-500">
                  {locale === "uz"
                    ? "E’lon kartochkasi va katalogda alohida ajralib turuvchi maxsus nishonlar."
                    : "Специальные значки, выделяющие карточку в каталоге."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* TOP Badge */}
                <label
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isTop
                      ? "border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white text-xs font-black shadow-sm">
                      ★
                    </span>
                    <div>
                      <span className="text-xs font-extrabold block">
                        {locale === "uz" ? "TOP E’lon" : "ТОП объявление"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {locale === "uz" ? "Katalogda yuqorida" : "Вверху каталога"}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isTop}
                    onChange={(e) => setIsTop(e.target.checked)}
                    className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                </label>

                {/* Tez sotiladi Badge */}
                <label
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isFastSale
                      ? "border-rose-400 bg-rose-50 text-rose-900 ring-2 ring-rose-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500 text-white text-xs font-black shadow-sm">
                      ⚡
                    </span>
                    <div>
                      <span className="text-xs font-extrabold block">
                        {locale === "uz" ? "Tez sotiladi" : "Быстрая продажа"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {locale === "uz" ? "Shoshilinch taklif" : "Срочное предложение"}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isFastSale}
                    onChange={(e) => setIsFastSale(e.target.checked)}
                    className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                </label>

                {/* Yaxshi taklif Badge */}
                <label
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isGoodDeal
                      ? "border-blue-400 bg-blue-50 text-blue-900 ring-2 ring-blue-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-white text-xs font-black shadow-sm">
                      %
                    </span>
                    <div>
                      <span className="text-xs font-extrabold block">
                        {locale === "uz" ? "Yaxshi taklif" : "Выгодная сделка"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {locale === "uz" ? "Qulay narx" : "Выгодная цена"}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isGoodDeal}
                    onChange={(e) => setIsGoodDeal(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-[11px] text-emerald-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{locale === "uz" ? "Yangi" : "Новинка"}</strong>{" "}
                  {locale === "uz"
                    ? "nishoni e’lon birinchi marta chop etilganda (published) 3 kun davomida avtomatik ko‘rsatiladi."
                    : "значок автоматически отображается в течение 3 дней после первой публикации."}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Sarlavha & Tavsiflar (Bilingual UZ / RU) */}
        {activeStep === 2 && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {locale === "uz" ? "2. Sarlavha va Tavsif (UZ & RU)" : "2. Заголовок и Описание (UZ & RU)"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {locale === "uz"
                    ? "Ikkala tildagi matnni kiriting yoki avtomatik tarjimadan foydalaning."
                    : "Заполните текст на обоих языках или используйте автоматический перевод."}
                </p>
              </div>

              {/* Language status badges */}
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
                    titleUz.trim() && descUz.trim()
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : titleUz.trim()
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  UZ: {titleUz.trim() && descUz.trim() ? "✓ To‘liq" : titleUz.trim() ? "Qisman" : "Bo‘sh"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
                    titleRu.trim() && descRu.trim()
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : titleRu.trim()
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  RU: {titleRu.trim() && descRu.trim() ? "✓ Заполнено" : titleRu.trim() ? "Частично" : "Пусто"}
                </span>
              </div>
            </div>

            {/* Translation Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
                <Languages className="h-4 w-4 text-[#16543C]" />
                {locale === "uz" ? "Avto-tarjima:" : "Авто-перевод:"}
              </span>

              <button
                type="button"
                disabled={isTranslating || (!titleUz.trim() && !descUz.trim())}
                onClick={() => handleAutoTranslate("uz_to_ru")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#16543C] text-slate-800 hover:text-[#16543C] text-xs font-bold transition-all disabled:opacity-40 disabled:hover:border-slate-300 shadow-sm"
              >
                {isTranslating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#16543C]" />
                ) : (
                  <Globe className="h-3.5 w-3.5 text-emerald-700" />
                )}
                <span>UZ → RU ({locale === "uz" ? "Ruschaga" : "на русский"})</span>
              </button>

              <button
                type="button"
                disabled={isTranslating || (!titleRu.trim() && !descRu.trim())}
                onClick={() => handleAutoTranslate("ru_to_uz")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#16543C] text-slate-800 hover:text-[#16543C] text-xs font-bold transition-all disabled:opacity-40 disabled:hover:border-slate-300 shadow-sm"
              >
                {isTranslating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#16543C]" />
                ) : (
                  <Globe className="h-3.5 w-3.5 text-blue-700" />
                )}
                <span>RU → UZ ({locale === "uz" ? "O‘zbekchaga" : "на узбекский"})</span>
              </button>
            </div>

            {translationNotice && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                  translationNotice.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : translationNotice.type === "error"
                    ? "bg-red-50 text-red-800 border-red-200"
                    : "bg-blue-50 text-blue-800 border-blue-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {translationNotice.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  )}
                  <span>{translationNotice.msg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTranslationNotice(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* UZ Language Card */}
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
                  <span className="text-xs font-extrabold text-[#16543C] flex items-center gap-1.5">
                    🇺🇿 O‘zbekcha (Lotin)
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Asosiy sayt tili</span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Sarlavha (UZ)</label>
                  <input
                    type="text"
                    value={titleUz}
                    onChange={(e) => setTitleUz(e.target.value)}
                    placeholder="Masalan: Angren markazida 3 xonali ta’mirlangan kvartira"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Batafsil tavsif (UZ)</label>
                  <textarea
                    rows={4}
                    value={descUz}
                    onChange={(e) => setDescUz(e.target.value)}
                    placeholder="Kvartira qavatida, atrofida bog‘cha, maktab, bozor joylashgan..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                  />
                </div>
              </div>

              {/* RU Language Card */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    🇷🇺 Русский язык
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Для русскоязычных</span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Заголовок (RU)</label>
                  <input
                    type="text"
                    value={titleRu}
                    onChange={(e) => setTitleRu(e.target.value)}
                    placeholder="Например: 3-комнатная квартира с ремонтом в центре Ангрена"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Описание объекта (RU)</label>
                  <textarea
                    rows={4}
                    value={descRu}
                    onChange={(e) => setDescRu(e.target.value)}
                    placeholder="Квартира на удобном этаже, рядом детский сад, школа, рынок..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Manzil & Xarita koordinatalari / Polygon */}
        {activeStep === 3 && (
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              {locale === "uz" ? "3. Joylashuv va xarita (Koordinatalar & Poligon)" : "3. Расположение и карта (Координаты и полигон)"}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    {locale === "uz" ? "Tuman / Hudud (Angren)" : "Район / Зона (Ангрен)"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsHududModalOpen(true)}
                    className="text-[11px] font-bold text-[#16543C] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{locale === "uz" ? "Yangi hudud yaratish" : "Создать новый район"}</span>
                  </button>
                </div>
                <select
                  value={hududId || district}
                  onChange={(e) => {
                    const sel = e.target.value;
                    const found = hududList.find((h) => h.id === sel || h.name_uz === sel);
                    if (found) {
                      setHududId(found.id);
                      setDistrict(found.name_uz);
                      if (found.latitude && found.longitude) {
                        setLat(found.latitude);
                        setLng(found.longitude);
                      }
                    } else {
                      setDistrict(sel);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                >
                  <option value="">
                    {locale === "uz" ? "-- Hududni tanlang --" : "-- Выберите район --"}
                  </option>
                  {hududList.length > 0 ? (
                    hududList.map((h) => (
                      <option key={h.id} value={h.id}>
                        {locale === "uz" ? h.name_uz : (h.name_ru || h.name_uz)}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Markaz">{locale === "uz" ? "Markaz" : "Центр"}</option>
                      <option value="5-mavze">{locale === "uz" ? "5-mavze" : "5-й массив"}</option>
                      <option value="6-mavze">{locale === "uz" ? "6-mavze" : "6-й массив"}</option>
                      <option value="7-mavze">{locale === "uz" ? "7-mavze" : "7-й массив"}</option>
                      <option value="Dukent">{locale === "uz" ? "Dukent" : "Дукент"}</option>
                      <option value="Yangiobod">{locale === "uz" ? "Yangiobod" : "Янгиабад"}</option>
                      <option value="Geolog">{locale === "uz" ? "Geolog" : "Геолог"}</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {locale === "uz" ? "Aniq manzil (Ko‘cha va uy)" : "Точный адрес (Улица и дом)"}
                </label>
                <input
                  type="text"
                  value={addressUz}
                  onChange={(e) => setAddressUz(e.target.value)}
                  placeholder={locale === "uz" ? "Mustaqillik shoh ko‘chasi, 12-uy" : "ул. Мустакиллик, д. 12"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>
            </div>

            {/* Interactive Location & Polygon Picker Map */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#16543C]" />
                  <span>{locale === "uz" ? "Xaritada nuqtani belgilash" : "Отметка на карте"}</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  {locale === "uz"
                    ? "Xaritadagi belgini suring yoki kerakli joyni bosing"
                    : "Перетащите маркер на карте или кликните в нужном месте"}
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
                    <span>
                      {locale === "uz"
                        ? "Yer / Hovli ko‘pburchakli chegarasi (GeoJSON)"
                        : "Границы участка / дома (GeoJSON)"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">
                    {polygonPoints.length > 0
                      ? locale === "uz"
                        ? `${polygonPoints.length} ta nuqta belgilandi`
                        : `Точек: ${polygonPoints.length}`
                      : locale === "uz"
                      ? "Nuqtalar yo‘q"
                      : "Нет точек"}
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
                  placeholder={
                    locale === "uz"
                      ? "Xaritada 'Poligon chizish' tugmasini bosing yoki JSON kiriting"
                      : "Нажмите кнопку 'Нарисовать полигон' на карте или введите JSON"
                  }
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
              {locale === "uz" ? "4. Texnik parametrlar va qulayliklar" : "4. Технические параметры и удобства"}
            </h2>

            {/* Area, Dimensions & Rooms (Dynamic by Property Type) */}
            {propertyType === "land" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Yer maydoni — Sotix" : "Площадь участка — Сотки"}
                  </label>
                  <input
                    type="number"
                    value={areaSotikh || ""}
                    onChange={(e) => setAreaSotikh(Number(e.target.value))}
                    placeholder={locale === "uz" ? "Masalan: 6" : "Например: 6"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Fasad kengligi (metrda)" : "Ширина фасада (в метрах)"}
                  </label>
                  <input
                    type="number"
                    value={facadeM}
                    onChange={(e) => setFacadeM(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={locale === "uz" ? "Masalan: 15" : "Например: 15"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Uzunligi / Chuqurligi (metrda)" : "Длина / глубина (в метрах)"}
                  </label>
                  <input
                    type="number"
                    value={depthM}
                    onChange={(e) => setDepthM(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={locale === "uz" ? "Masalan: 40" : "Например: 40"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>
            ) : propertyType === "house_yard" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Yer maydoni — Sotix" : "Площадь участка — Сотки"}
                  </label>
                  <input
                    type="number"
                    value={areaSotikh || ""}
                    onChange={(e) => setAreaSotikh(Number(e.target.value))}
                    placeholder={locale === "uz" ? "Masalan: 6" : "Например: 6"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Uy maydoni (m²)" : "Площадь дома (м²)"}
                  </label>
                  <input
                    type="number"
                    value={areaSqm}
                    onChange={(e) => setAreaSqm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Xonalar soni" : "Количество комнат"}
                  </label>
                  <input
                    type="number"
                    value={rooms}
                    onChange={(e) => setRooms(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Fasad kengligi (metrda)" : "Ширина фасада (в метрах)"}
                  </label>
                  <input
                    type="number"
                    value={facadeM}
                    onChange={(e) => setFacadeM(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={locale === "uz" ? "Masalan: 15" : "Например: 15"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Uzunligi / Chuqurligi (metrda)" : "Длина / глубина (в метрах)"}
                  </label>
                  <input
                    type="number"
                    value={depthM}
                    onChange={(e) => setDepthM(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={locale === "uz" ? "Masalan: 40" : "Например: 40"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Yashash maydoni (m²)" : "Жилая площадь (м²)"}
                  </label>
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
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Umumiy maydon (m²)" : "Общая площадь (м²)"}
                  </label>
                  <input
                    type="number"
                    value={areaSqm}
                    onChange={(e) => setAreaSqm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Yashash maydoni (m²)" : "Жилая площадь (м²)"}
                  </label>
                  <input
                    type="number"
                    value={livingAreaSqm}
                    onChange={(e) => setLivingAreaSqm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Xonalar soni" : "Количество комнат"}
                  </label>
                  <input
                    type="number"
                    value={rooms}
                    onChange={(e) => setRooms(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Qavat / Jami qavatlar" : "Этаж / Всего этажей"}
                  </label>
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
                  {locale === "uz"
                    ? "Asosiy kommunikatsiyalar (6 ta standart parametr)"
                    : "Основные коммуникации (6 стандартных параметров)"}
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  {locale === "uz" ? "Hayotiy muhim tarmoqlar" : "Жизненно важные коммуникации"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-bold">
                {[
                  { key: "electricity", label: locale === "uz" ? "Elektr tarmog‘i" : "Электросеть" },
                  { key: "gas", label: locale === "uz" ? "Tabiiy gaz" : "Природный газ" },
                  { key: "cold_water", label: locale === "uz" ? "Sovuq suv" : "Холодная вода" },
                  { key: "hot_water", label: locale === "uz" ? "Issiq suv" : "Горячая вода" },
                  { key: "heating", label: locale === "uz" ? "Isitish tizimi" : "Отопление" },
                  { key: "internet", label: locale === "uz" ? "Internet (Optik tola / Wi-Fi)" : "Интернет (Оптоволокно / Wi-Fi)" },
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
                  {locale === "uz"
                    ? "Qo‘shimcha kommunikatsiya va qulayliklar"
                    : "Дополнительные коммуникации и удобства"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customUtilityInput}
                    onChange={(e) => setCustomUtilityInput(e.target.value)}
                    placeholder={
                      locale === "uz"
                        ? "Masalan: Artezian quduq, Generator, Transformator..."
                        : "Например: Артезианская скважина, Генератор, Трансформатор..."
                    }
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
                    {locale === "uz" ? "+ Qo‘shish" : "+ Добавить"}
                  </button>
                </div>
                {Array.isArray(utilities.custom) && utilities.custom.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {utilities.custom.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-[#16543C] text-xs font-bold border border-emerald-200"
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = utilities.custom?.filter((_, i) => i !== idx);
                            setUtilities({ ...utilities, custom: updated });
                          }}
                          className="hover:text-red-600"
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
              <label className="text-xs font-bold text-slate-700">
                {locale === "uz" ? "Qo‘shimcha jihozlar" : "Удобства и оснащение"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {(
                  [
                    { key: "furniture", label: locale === "uz" ? "Mebel" : "Мебель" },
                    { key: "parking", label: locale === "uz" ? "Avtoturargoh" : "Парковка" },
                    { key: "elevator", label: locale === "uz" ? "Lift" : "Лифт" },
                    { key: "ac", label: locale === "uz" ? "Konditsioner" : "Кондиционер" },
                    { key: "balcony", label: locale === "uz" ? "Balkon" : "Балкон" },
                    { key: "internet", label: locale === "uz" ? "Internet" : "Интернет" },
                  ] as const
                ).map((a) => (
                  <label key={a.key} className="flex items-center gap-2 p-2.5 rounded-xl border bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={amenities[a.key]}
                      onChange={(e) => setAmenities({ ...amenities, [a.key]: e.target.checked })}
                      className="rounded text-[#16543C]"
                    />
                    <span className="font-semibold text-slate-700">{a.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Images & Media Upload */}
        {activeStep === 5 && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Camera className="h-5 w-5 text-[#16543C]" />
                <span>{locale === "uz" ? "5-bosqich: Fotosuratlar va Video" : "Этап 5: Фотографии и Видео"}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {locale === "uz"
                  ? "Obyektning sifatli rasmlari ko‘rishlar sonini 4 baravargacha oshiradi."
                  : "Качественные фотографии увеличивают количество просмотров до 4 раз."}
              </p>
            </div>

            <PropertyImageUploader
              images={imageUrls}
              onChangeImages={(urls: string[]) => {
                setImageUrls(urls);
                if (!mainImage && urls.length > 0) {
                  setMainImage(urls[0]);
                }
              }}
              mainImage={mainImage}
              onChangeMainImage={(url: string) => setMainImage(url)}
            />

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800">
                {locale === "uz" ? "Video sharh havolasi (YouTube / Vimeo / MP4)" : "Ссылка на видеообзор (YouTube / Vimeo / MP4)"}
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
              />
            </div>
          </div>
        )}

        {/* STEP 6: Contacts, Assigned Realtor & Confirmation */}
        {activeStep === 6 && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Phone className="h-5 w-5 text-[#16543C]" />
                <span>{locale === "uz" ? "6-bosqich: Aloqa va Mas’ul Rieltor" : "Этап 6: Контакты и Ответственный Риелтор"}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {locale === "uz"
                  ? "Mulk egasi ma’lumotlari faqat adminga ko‘rinadi. Mijozlar esa e’londagi ommaviy telefon yoki mas’ul rieltor orqali bog‘lanadi."
                  : "Контакты владельца видны только администратору. Клиенты связываются по публичному номеру или через ответственного риелтора."}
              </p>
            </div>

            {/* Realtor Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  {locale === "uz"
                    ? "Mas’ul rieltorni biriktirish"
                    : "Назначить ответственного риелтора"}
                </label>
                {selectedRealtorId && (
                  <button
                    type="button"
                    onClick={() => setSelectedRealtorId("")}
                    className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                  >
                    <span>{locale === "uz" ? "Rieltorni bo‘shatish" : "Открепить риелтора"}</span>
                  </button>
                )}
              </div>
              <select
                value={selectedRealtorId}
                onChange={(e) => setSelectedRealtorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
              >
                <option value="">
                  {locale === "uz"
                    ? "(Rieltorsiz — Angren Estate ma’muriyati)"
                    : "(Без риелтора — Администрация Angren Estate)"}
                </option>
                {realtors.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phone}) — {locale === "uz" ? r.specialization_uz : r.specialization_ru}
                  </option>
                ))}
              </select>
            </div>

            {/* Owner Direct Phone (Dedicated Field) */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>{locale === "uz" ? "Mulk egasining telefoni" : "Номер телефона владельца"}</span>
                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                  {locale === "uz" ? "Faqat adminga ko‘rinadi" : "Видно только админу"}
                </span>
              </label>
              <input
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-amber-50/20"
              />
              <p className="text-[11px] text-slate-500">
                {locale === "uz"
                  ? "Ushbu raqam sahifada ommaviy ko‘rinmaydi, faqat admin panelida mulk egasi bilan to‘g‘ridan-to‘g‘ri bog‘lanish uchun saqlanadi."
                  : "Этот номер не отображается публично на сайте, а сохраняется только в панели администратора для связи с владельцем."}
              </p>
            </div>

            {/* Public Contact Phone */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800">
                {locale === "uz" ? "E’londagi ommaviy telefon" : "Публичный телефон для связи"}
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
              {locale === "uz" ? "6. Yakuniy ko‘rib chiqish" : "6. Предварительный просмотр"}
            </h2>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {getDealTypeLabel(transactionType, locale)} • {getPropertyTypeLabel(propertyType, locale)}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-2">
                    {titleUz || (locale === "uz" ? "Sarlavha kiritilmagan" : "Заголовок не указан")}
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
                  <span className="text-slate-600 font-bold text-[10px]">{locale === "uz" ? "Maydon" : "Площадь"}</span>
                  <div className="font-bold">{areaSqm} m²</div>
                </div>
                <div className="p-2 bg-white rounded-xl">
                  <span className="text-slate-600 font-bold text-[10px]">{locale === "uz" ? "Xonalar" : "Комнаты"}</span>
                  <div className="font-bold">{rooms}</div>
                </div>
                <div className="p-2 bg-white rounded-xl">
                  <span className="text-slate-600 font-bold text-[10px]">{locale === "uz" ? "Qavat" : "Этаж"}</span>
                  <div className="font-bold">{floor}/{totalFloors}</div>
                </div>
                <div className="p-2 bg-white rounded-xl">
                  <span className="text-slate-600 font-bold text-[10px]">{locale === "uz" ? "Ta’mir" : "Ремонт"}</span>
                  <div className="font-bold capitalize">
                    {getRenovationLabel(renovation, locale)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-100"
              >
                {locale === "uz" ? "Qoralama sifatida saqlash" : "Сохранить как черновик"}
              </button>
              <button
                type="button"
                onClick={() => handleSave("published")}
                className="px-6 py-2.5 rounded-xl bg-[#16543C] hover:bg-[#0E3324] text-white font-black text-xs shadow-md"
              >
                {locale === "uz" ? "✓ Saytda darhol nashr qilish" : "✓ Опубликовать на сайте"}
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
            {locale === "uz" ? "← Orqaga" : "← Назад"}
          </button>

          {activeStep < totalSteps && (
            <button
              type="button"
              onClick={() => setActiveStep((prev) => Math.min(totalSteps, prev + 1))}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              {locale === "uz" ? "Keyingisi →" : "Далее →"}
            </button>
          )}
        </div>
      </div>

      <HududPolygonDrawerModal
        isOpen={isHududModalOpen}
        onClose={() => setIsHududModalOpen(false)}
        onHududCreated={(newH) => {
          setHududList((prev) => [newH, ...prev]);
          setHududId(newH.id);
          setDistrict(newH.name_uz);
          if (newH.latitude && newH.longitude) {
            setLat(newH.latitude);
            setLng(newH.longitude);
          }
        }}
      />
    </div>
  );
}
