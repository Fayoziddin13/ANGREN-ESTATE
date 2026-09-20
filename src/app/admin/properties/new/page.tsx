"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Building2,
  Home,
  Trees,
  Warehouse,
  Briefcase,
  MapPin,
  Camera,
  Flame,
  Droplets,
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
  Video,
  Eye,
  Star,
  ShieldCheck,
  Instagram,
  HelpCircle,
  Compass,
  CheckSquare,
  Square,
  RefreshCw,
  Clock,
  Car,
  Wind,
  Building,
  Thermometer,
  Wifi,
  Archive,
  Waves,
  DoorClosed,
  Pencil,
  GraduationCap,
  Cross,
  ShoppingCart,
  Bus,
  Stethoscope,
  CreditCard,
  BookOpen,
  Utensils,
  Fuel,
  Dumbbell,
  Shield,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useProperties } from "@/lib/propertyStore";
import { useRealtors } from "@/lib/realtorStore";
import { PropertyImageUploader } from "@/components/admin/PropertyImageUploader";
import { HududPolygonDrawerModal } from "@/components/admin/HududPolygonDrawerModal";
import {
  PropertyType,
  TransactionType,
  RenovationType,
  PropertyStatus,
  HududItem,
  PropertyBadge,
  InfrastructureSummary,
} from "@/lib/types";
import {
  getPropertyTypeLabel,
  getDealTypeLabel,
  getBadgeLabel,
  getPropertyStatusLabel,
  getRenovationLabel,
} from "@/lib/propertyFormatters";
import {
  getInfrastructureAround,
  fetchNearbyInfrastructure,
  MAX_INFRASTRUCTURE_RADIUS_METERS,
} from "@/lib/infrastructureService";

const PROTECTED_HUDUDS = ["markaz", "5-mavze", "6-mavze", "7-mavze", "dukent", "geolog", "yangiobod"];

const AdminLocationPicker = dynamic(
  () => import("@/components/admin/AdminLocationPicker").then((mod) => mod.AdminLocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 rounded-2xl bg-slate-100 flex flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-400">
        <div className="h-7 w-7 rounded-full border-2 border-[#16543C] border-t-transparent animate-spin" />
        <span>Xarita yuklanmoqda...</span>
      </div>
    ),
  }
);

const DRAFT_KEY = "angren_property_wizard_v5_draft";

export default function AddPropertyPage() {
  const router = useRouter();
  const { locale } = useLanguage();
  const { exchangeRate } = useCurrency();
  const { addProperty } = useProperties();
  const { realtors } = useRealtors();

  // Wizard active step (1 to 5)
  const [activeStep, setActiveStep] = useState<number>(1);
  const totalSteps = 5;

  // STEP 1: Asosiy ma'lumotlar
  const [transactionType, setTransactionType] = useState<TransactionType>("sale");
  const [propertyType, setPropertyType] = useState<PropertyType>("apartment");
  const [currency, setCurrency] = useState<"USD" | "UZS">("USD");
  const [priceInput, setPriceInput] = useState<number>(35000);
  const [priceNegotiable, setPriceNegotiable] = useState<boolean>(false);

  // STEP 2: Rasm va E'lon Kontenti
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [mainImage, setMainImage] = useState<string>("");
  const [titleUz, setTitleUz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [descUz, setDescUz] = useState("");
  const [descRu, setDescRu] = useState("");
  const [noteUz, setNoteUz] = useState("");
  const [noteRu, setNoteRu] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [titleUzManual, setTitleUzManual] = useState(false);
  const [titleRuManual, setTitleRuManual] = useState(false);
  const [descUzManual, setDescUzManual] = useState(false);
  const [descRuManual, setDescRuManual] = useState(false);
  const [noteUzManual, setNoteUzManual] = useState(false);
  const [noteRuManual, setNoteRuManual] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [translationNotice, setTranslationNotice] = useState<{
    type: "success" | "error" | "info";
    msg: string;
  } | null>(null);

  // STEP 3: Manzil, Hudud va Xarita
  const [district, setDistrict] = useState("Markaz");
  const [addressUz, setAddressUz] = useState("");
  const [addressRu, setAddressRu] = useState("");
  const [lat, setLat] = useState(41.0167);
  const [lng, setLng] = useState(70.1436);
  const [hududId, setHududId] = useState("");
  const [hududList, setHududList] = useState<HududItem[]>([]);
  const [isHududModalOpen, setIsHududModalOpen] = useState(false);

  // Extra Objects state (Qo‘shimcha obyektlar)
  const [extraObjects, setExtraObjects] = useState<string[]>([
    "Yashil hudud",
    "Garaj",
  ]);
  const [customExtraObjects, setCustomExtraObjects] = useState<string[]>([]);
  const [newExtraObjectInput, setNewExtraObjectInput] = useState("");

  // Advantages state (Afzalliklar)
  const [hasParking, setHasParking] = useState<boolean>(true);
  const [hasElevator, setHasElevator] = useState<boolean>(false);
  const [customAdvantages, setCustomAdvantages] = useState<string[]>([]);
  const [newAdvantageInput, setNewAdvantageInput] = useState("");

  // Reusable unified property features list
  const propertyFeatures = useMemo(
    () => [...extraObjects, ...customExtraObjects],
    [extraObjects, customExtraObjects]
  );

  // Hudud state
  const [hududToDelete, setHududToDelete] = useState<HududItem | null>(null);
  const [isDeletingHudud, setIsDeletingHudud] = useState(false);
  const [editingHudud, setEditingHudud] = useState<HududItem | null>(null);
  const [hududUsageCount, setHududUsageCount] = useState<number>(0);
  const [isCheckingUsage, setIsCheckingUsage] = useState<boolean>(false);

  // STEP 4: Dinamik Parametrlar
  // 4A Kvartira
  const [totalFloors, setTotalFloors] = useState<number>(9);
  const [floor, setFloor] = useState<number>(4);
  const [rooms, setRooms] = useState<number>(3);
  const [areaSqm, setAreaSqm] = useState<number>(65);
  const [hasAc, setHasAc] = useState<boolean>(true);
  const [heatingType, setHeatingType] = useState<"individual" | "central" | "other">("central");
  const [renovation, setRenovation] = useState<RenovationType>("euro");
  const [furniture, setFurniture] = useState<boolean>(false);

  // 4B Hovli & 4C Yer
  const [areaSotikh, setAreaSotikh] = useState<number>(4);
  const [houseAreaSqm, setHouseAreaSqm] = useState<number>(120);
  const [facadeM, setFacadeM] = useState<number | "">("");
  const [depthM, setDepthM] = useState<number | "">("");
  const [yardObjects, setYardObjects] = useState<string[]>(["Uy", "Garaj"]);
  const [customYardInput, setCustomYardInput] = useState("");
  const [polygonCoords, setPolygonCoords] = useState<string>("");
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);

  // 4D Noturar & 4E Tijorat
  const [nonResFloor, setNonResFloor] = useState<number>(1);
  const [commercialFeatures, setCommercialFeatures] = useState<string[]>([
    "Birinchi qatorda (Первая линия)",
    "Alohida kirish (Отдельный вход)",
  ]);

  // Utilities state
  const [utilities, setUtilities] = useState<{
    gas: boolean;
    electricity: boolean;
    cold_water: boolean;
    hot_water: boolean;
    heating: boolean;
    internet: boolean;
    custom?: string[];
  }>({
    gas: true,
    electricity: true,
    cold_water: true,
    hot_water: true,
    heating: true,
    internet: true,
    custom: [],
  });

  // STEP 5: Preview, Badges, Realtor & Contacts
  const [isTop, setIsTop] = useState<boolean>(false);
  const [isArzon, setIsArzon] = useState<boolean>(false);
  const [isFastSale, setIsFastSale] = useState<boolean>(false);
  const [isHamyonbop, setIsHamyonbop] = useState<boolean>(false);
  const [isPriceDropped, setIsPriceDropped] = useState<boolean>(false);

  const [selectedRealtorId, setSelectedRealtorId] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [contactPhone, setContactPhone] = useState("+998 90 123 45 67");
  const [contactTelegram, setContactTelegram] = useState("@angrenestate_admin");

  // UX & Validation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [draftAvailable, setDraftAvailable] = useState(false);

  // Dynamic price calculation
  const calculatedPrices = useMemo(() => {
    const rate = exchangeRate || 12850;
    if (currency === "USD") {
      const usd = Number(priceInput) || 0;
      const uzs = Math.round(usd * rate);
      return { priceUsd: usd, priceUzs: uzs };
    } else {
      const uzs = Number(priceInput) || 0;
      const usd = Math.round(uzs / rate);
      return { priceUsd: usd, priceUzs: uzs };
    }
  }, [priceInput, currency, exchangeRate]);

  // Facade x Depth automatic area calculation
  const calculatedFacadeArea = useMemo(() => {
    if (typeof facadeM === "number" && typeof depthM === "number" && facadeM > 0 && depthM > 0) {
      const sqm = Math.round(facadeM * depthM * 10) / 10;
      const sotikh = Math.round((sqm / 100) * 100) / 100;
      return { sqm, sotikh };
    }
    return null;
  }, [facadeM, depthM]);

  // Live nearby infrastructure calculation based on map coordinates (strict 1km)
  const [liveNearbyInfrastructure, setLiveNearbyInfrastructure] = useState<InfrastructureSummary[]>([]);
  const [isSearchingInfra, setIsSearchingInfra] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!lat || !lng) {
      setLiveNearbyInfrastructure([]);
      return;
    }
    // Instant initial 1km calculation
    setLiveNearbyInfrastructure(getInfrastructureAround(lat, lng, MAX_INFRASTRUCTURE_RADIUS_METERS, locale));
    setIsSearchingInfra(true);

    fetchNearbyInfrastructure(lat, lng, locale)
      .then((res) => {
        if (isMounted && res && Array.isArray(res.summaries)) {
          setLiveNearbyInfrastructure(res.summaries);
        }
      })
      .catch((err) => {
        console.warn("[Admin Step 3] Infrastructure search error:", err);
      })
      .finally(() => {
        if (isMounted) setIsSearchingInfra(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lat, lng, locale]);

  // Prompt delete with usage check
  const handlePromptDeleteHudud = async (h: HududItem) => {
    if (PROTECTED_HUDUDS.includes(h.id.toLowerCase().trim())) {
      alert(locale === "uz" ? "Ushbu asosiy shahar hududini o‘chirib bo‘lmaydi." : "Этот основной район города нельзя удалить.");
      return;
    }
    setIsCheckingUsage(true);
    try {
      const res = await fetch(`/api/admin/hududs?check_usage=${encodeURIComponent(h.id)}`);
      const data = await res.json();
      setHududUsageCount(data.count || 0);
      setHududToDelete(h);
    } catch {
      setHududUsageCount(0);
      setHududToDelete(h);
    } finally {
      setIsCheckingUsage(false);
    }
  };

  // Delete custom hudud handler
  const handleDeleteHudud = async (h: HududItem) => {
    if (PROTECTED_HUDUDS.includes(h.id.toLowerCase().trim())) {
      alert(locale === "uz" ? "Ushbu asosiy shahar hududini o‘chirib bo‘lmaydi." : "Этот основной район города нельзя удалить.");
      return;
    }
    setIsDeletingHudud(true);
    try {
      const res = await fetch(`/api/admin/hududs?id=${encodeURIComponent(h.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setHududList((prev) => prev.filter((item) => item.id !== h.id));
        if (hududId === h.id || district === h.name_uz) {
          setHududId("markaz");
          setDistrict("Markaz");
        }
        setHududToDelete(null);
      } else {
        alert(data.message || (locale === "uz" ? "Hududni o‘chirishda xatolik yuz berdi" : "Ошибка при удалении района"));
      }
    } catch (err: any) {
      console.error("Delete hudud error:", err);
      alert(err?.message || "Xatolik");
    } finally {
      setIsDeletingHudud(false);
    }
  };

  // Fetch hududs list on mount
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

  // Check for unsaved draft on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.titleUz || parsed.addressUz || parsed.priceInput)) {
            setDraftAvailable(true);
          }
        }
      } catch (e) {}
    }
  }, []);

  // Save draft periodically
  useEffect(() => {
    if (typeof window === "undefined" || isSubmitting) return;
    const timer = setTimeout(() => {
      try {
        const draftData = {
          transactionType,
          propertyType,
          currency,
          priceInput,
          priceNegotiable,
          imageUrls,
          mainImage,
          titleUz,
          titleRu,
          descUz,
          descRu,
          additionalNote,
      noteUz,
      noteRu,
          videoUrl,
          district,
          addressUz,
          addressRu,
          lat,
          lng,
          hududId,
          extraObjects,
          customExtraObjects,
          hasParking,
          hasElevator,
          customAdvantages,
          propertyFeatures,
          totalFloors,
          floor,
          rooms,
          areaSqm,
          hasAc,
          heatingType,
          renovation,
          furniture,
          areaSotikh,
          houseAreaSqm,
          facadeM,
          depthM,
          yardObjects,
          commercialFeatures,
          utilities,
          isTop,
          isArzon,
          isFastSale,
          isHamyonbop,
          isPriceDropped,
          selectedRealtorId,
          ownerPhone,
          contactPhone,
          contactTelegram,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      } catch (e) {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    transactionType,
    propertyType,
    currency,
    priceInput,
    priceNegotiable,
    imageUrls,
    mainImage,
    titleUz,
    titleRu,
    descUz,
    descRu,
    additionalNote,
    videoUrl,
    district,
    addressUz,
    addressRu,
    lat,
    lng,
    hududId,
    extraObjects,
    customExtraObjects,
    hasParking,
    hasElevator,
    customAdvantages,
    propertyFeatures,
    totalFloors,
    floor,
    rooms,
    areaSqm,
    hasAc,
    heatingType,
    renovation,
    furniture,
    areaSotikh,
    houseAreaSqm,
    facadeM,
    depthM,
    yardObjects,
    commercialFeatures,
    utilities,
    isTop,
    isArzon,
    isFastSale,
    isHamyonbop,
    isPriceDropped,
    selectedRealtorId,
    ownerPhone,
    contactPhone,
    contactTelegram,
    isSubmitting,
  ]);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.transactionType) setTransactionType(d.transactionType);
      if (d.propertyType) setPropertyType(d.propertyType);
      if (d.currency) setCurrency(d.currency);
      if (d.priceInput) setPriceInput(d.priceInput);
      if (d.priceNegotiable !== undefined) setPriceNegotiable(d.priceNegotiable);
      if (Array.isArray(d.imageUrls)) setImageUrls(d.imageUrls);
      if (d.mainImage) setMainImage(d.mainImage);
      if (d.titleUz) setTitleUz(d.titleUz);
      if (d.titleRu) setTitleRu(d.titleRu);
      if (d.descUz) setDescUz(d.descUz);
      if (d.descRu) setDescRu(d.descRu);
      if (d.additionalNote) setAdditionalNote(d.additionalNote);
      if (d.noteUz) setNoteUz(d.noteUz);
      if (d.noteRu) setNoteRu(d.noteRu);
      if (d.videoUrl) setVideoUrl(d.videoUrl);
      if (d.district) setDistrict(d.district);
      if (d.addressUz) setAddressUz(d.addressUz);
      if (d.addressRu) setAddressRu(d.addressRu);
      if (d.lat) setLat(d.lat);
      if (d.lng) setLng(d.lng);
      if (d.hududId) setHududId(d.hududId);
      if (Array.isArray(d.extraObjects)) setExtraObjects(d.extraObjects);
      if (Array.isArray(d.customExtraObjects)) setCustomExtraObjects(d.customExtraObjects);
      if (d.hasParking !== undefined) setHasParking(d.hasParking);
      if (d.hasElevator !== undefined) setHasElevator(d.hasElevator);
      if (Array.isArray(d.customAdvantages)) setCustomAdvantages(d.customAdvantages);
      if (Array.isArray(d.propertyFeatures) && !d.extraObjects) {
        setExtraObjects(d.propertyFeatures);
      }
      if (d.totalFloors) setTotalFloors(d.totalFloors);
      if (d.floor) setFloor(d.floor);
      if (d.rooms) setRooms(d.rooms);
      if (d.areaSqm) setAreaSqm(d.areaSqm);
      if (d.hasAc !== undefined) setHasAc(d.hasAc);
      if (d.heatingType) setHeatingType(d.heatingType);
      if (d.renovation) setRenovation(d.renovation);
      if (d.furniture !== undefined) setFurniture(d.furniture);
      if (d.areaSotikh) setAreaSotikh(d.areaSotikh);
      if (d.houseAreaSqm) setHouseAreaSqm(d.houseAreaSqm);
      if (d.facadeM) setFacadeM(d.facadeM);
      if (d.depthM) setDepthM(d.depthM);
      if (Array.isArray(d.yardObjects)) setYardObjects(d.yardObjects);
      if (Array.isArray(d.commercialFeatures)) setCommercialFeatures(d.commercialFeatures);
      if (d.utilities) setUtilities(d.utilities);
      if (d.isTop !== undefined) setIsTop(d.isTop);
      if (d.isArzon !== undefined) setIsArzon(d.isArzon);
      if (d.isFastSale !== undefined) setIsFastSale(d.isFastSale);
      if (d.isHamyonbop !== undefined) setIsHamyonbop(d.isHamyonbop);
      if (d.isPriceDropped !== undefined) setIsPriceDropped(d.isPriceDropped);
      if (d.selectedRealtorId) setSelectedRealtorId(d.selectedRealtorId);
      if (d.ownerPhone) setOwnerPhone(d.ownerPhone);
      if (d.contactPhone) setContactPhone(d.contactPhone);
      if (d.contactTelegram) setContactTelegram(d.contactTelegram);

      setDraftAvailable(false);
    } catch (e) {}
  };

  const discardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setDraftAvailable(false);
  };

  // Auto-translate helper
  // On-blur automatic translation for a single field
  const handleFieldBlur = async (
    field: "title" | "desc" | "note",
    fromLang: "uz" | "ru"
  ) => {
    const toLang = fromLang === "uz" ? "ru" : "uz";
    let sourceText = "";
    let targetHasManualEdit = false;

    if (field === "title") {
      sourceText = fromLang === "uz" ? titleUz : titleRu;
      targetHasManualEdit = toLang === "ru" ? titleRuManual : titleUzManual;
    } else if (field === "desc") {
      sourceText = fromLang === "uz" ? descUz : descRu;
      targetHasManualEdit = toLang === "ru" ? descRuManual : descUzManual;
    } else if (field === "note") {
      sourceText = fromLang === "uz" ? noteUz : noteRu;
      targetHasManualEdit = toLang === "ru" ? noteRuManual : noteUzManual;
    }

    // Translate on blur ONLY if source is non-empty AND target was not manually customized
    if (!sourceText.trim() || targetHasManualEdit) {
      return;
    }

    const fieldKey = `${field}_${fromLang}_${toLang}`;
    setTranslatingField(fieldKey);

    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          from: fromLang,
          to: toLang,
        }),
      });

      const data = await res.json();
      if (data?.success && data.translatedText) {
        if (field === "title") {
          if (toLang === "ru") setTitleRu(data.translatedText);
          else setTitleUz(data.translatedText);
        } else if (field === "desc") {
          if (toLang === "ru") setDescRu(data.translatedText);
          else setDescUz(data.translatedText);
        } else if (field === "note") {
          if (toLang === "ru") setNoteRu(data.translatedText);
          else setNoteUz(data.translatedText);
        }
      }
    } catch (err) {
      console.error("Auto-translate on blur failed:", err);
    } finally {
      setTranslatingField(null);
    }
  };

  // Explicit batch translation action button
  const handleAutoTranslate = async (direction: "uz_to_ru" | "ru_to_uz") => {
    setIsTranslating(true);
    setTranslationNotice(null);
    try {
      const from = direction === "uz_to_ru" ? "uz" : "ru";
      const to = direction === "uz_to_ru" ? "ru" : "uz";
      const sourceTitle = from === "uz" ? titleUz : titleRu;
      const sourceDesc = from === "uz" ? descUz : descRu;
      const sourceNote = from === "uz" ? noteUz : noteRu;

      if (!sourceTitle.trim() && !sourceDesc.trim() && !sourceNote.trim()) {
        setTranslationNotice({
          type: "info",
          msg:
            locale === "uz"
              ? "Avval manba tilida sarlavha, tavsif yoki eslatmani kiriting."
              : "Сначала введите заголовок, описание или заметку на исходном языке.",
        });
        setIsTranslating(false);
        return;
      }

      const items = [];
      if (sourceTitle.trim()) items.push({ key: "title", text: sourceTitle, from, to });
      if (sourceDesc.trim()) items.push({ key: "desc", text: sourceDesc, from, to });
      if (sourceNote.trim()) items.push({ key: "note", text: sourceNote, from, to });

      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      let hasSuccess = false;
      if (data?.success && Array.isArray(data.results)) {
        for (const item of data.results) {
          if (item.result?.success && item.result?.translatedText) {
            hasSuccess = true;
            if (item.key === "title") {
              if (to === "ru") setTitleRu(item.result.translatedText);
              else setTitleUz(item.result.translatedText);
            }
            if (item.key === "desc") {
              if (to === "ru") setDescRu(item.result.translatedText);
              else setDescUz(item.result.translatedText);
            }
            if (item.key === "note") {
              if (to === "ru") setNoteRu(item.result.translatedText);
              else setNoteUz(item.result.translatedText);
            }
          }
        }
      }

      if (hasSuccess) {
        setTranslationNotice({
          type: "success",
          msg:
            locale === "uz"
              ? "Kontent muvaffaqiyatli tarjima qilindi. Natijani tahrirlashingiz mumkin."
              : "Контент успешно переведен. Вы можете отредактировать результат.",
        });
      } else {
        setTranslationNotice({
          type: "error",
          msg:
            locale === "uz"
              ? "Tarjima xizmati javob bermadi. Matnni qo‘lda kiritishingiz mumkin."
              : "Сервис перевода недоступен. Вы можете ввести перевод вручную.",
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

  // Step validation
  const validateStep = (step: number): boolean => {
    setStepError(null);

    if (step === 1) {
      if (!priceInput || priceInput <= 0) {
        setStepError(
          locale === "uz"
            ? "Iltimos, obyekt narxini to‘g‘ri kiriting."
            : "Пожалуйста, укажите корректную стоимость объекта."
        );
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (imageUrls.length === 0) {
        setStepError(
          locale === "uz"
            ? "Iltimos, kamida bitta 3:4 vertikal rasm yuklang."
            : "Пожалуйста, загрузите хотя бы одну вертикальную фотографию (формат 3:4)."
        );
        return false;
      }
      if (!titleUz.trim() && !titleRu.trim()) {
        setStepError(
          locale === "uz"
            ? "Iltimos, e'lon sarlavhasini kiriting."
            : "Пожалуйста, укажите заголовок объявления."
        );
        return false;
      }
      if (titleUz.trim() && /[а-яёўқғҳ]/i.test(titleUz)) {
        setStepError(
          locale === "uz"
            ? "O‘zbekcha sarlavha faqat lotin alifbosida bo‘lishi shart. Iltimos, lotin harflarida kiriting."
            : "Заголовок на узбекском должен быть строго на латинице."
        );
        return false;
      }
      if (videoUrl.trim()) {
        const isHttp = videoUrl.startsWith("http://") || videoUrl.startsWith("https://");
        if (!isHttp) {
          setStepError(
            locale === "uz"
              ? "Video havola formati noto‘g‘ri (http:// yoki https:// bilan boshlanishi kerak)."
              : "Некорректная ссылка на видео (должна начинаться с http:// или https://)."
          );
          return false;
        }
      }
      return true;
    }

    if (step === 3) {
      if (!addressUz.trim() && !addressRu.trim()) {
        setStepError(
          locale === "uz"
            ? "Iltimos, obyekt manzilini kiriting."
            : "Пожалуйста, укажите точный адрес объекта."
        );
        return false;
      }
      if (!lat || !lng) {
        setStepError(
          locale === "uz"
            ? "Iltimos, xaritada obyekt lokatsiyasini belgilang."
            : "Пожалуйста, отметьте точку объекта на карте."
        );
        return false;
      }
      return true;
    }

    if (step === 4) {
      if (propertyType === "apartment" || propertyType === "other" || propertyType === "commercial") {
        if (!areaSqm || areaSqm <= 0) {
          setStepError(
            locale === "uz"
              ? "Iltimos, obyekt maydonini m² da kiriting."
              : "Пожалуйста, укажите площадь объекта в м²."
          );
          return false;
        }
      } else if (propertyType === "house_yard") {
        if ((!areaSotikh || areaSotikh <= 0) && (!houseAreaSqm || houseAreaSqm <= 0)) {
          setStepError(
            locale === "uz"
              ? "Iltimos, yer yoki uy maydonini kiriting."
              : "Пожалуйста, укажите площадь дома или участка."
          );
          return false;
        }
      } else if (propertyType === "land") {
        if (!areaSotikh || areaSotikh <= 0) {
          setStepError(
            locale === "uz"
              ? "Iltimos, yer maydonini sotixda kiriting."
              : "Пожалуйста, укажите площадь земельного участка в сотках."
          );
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => Math.min(prev + 1, totalSteps));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    setStepError(null);
    setActiveStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Save / Publish handler
  const handleSave = async (statusToSave: PropertyStatus) => {
    if (isSubmitting) return;

    // Validate all steps
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);

    // Prepare badges
    const activeBadges: PropertyBadge[] = [];
    if (isTop) activeBadges.push("top");
    if (isArzon) activeBadges.push("arzon");
    if (isFastSale) activeBadges.push("tez_sotiladi");
    if (isHamyonbop) activeBadges.push("hamyonbop");
    if (isPriceDropped) activeBadges.push("narxi_tushirildi");

    // Dimensions
    const dimensions =
      facadeM && depthM ? `${facadeM} × ${depthM} m` : undefined;

    // Active area
    const effectiveAreaSqm =
      propertyType === "house_yard"
        ? houseAreaSqm || (calculatedFacadeArea?.sqm ?? 100)
        : propertyType === "land"
        ? (areaSotikh * 100) || (calculatedFacadeArea?.sqm ?? 600)
        : areaSqm;

    // Auto-detected nearby infrastructure list (strict 1km)
    const autoInfrastructure = liveNearbyInfrastructure.flatMap((s) =>
      s.items.map((i) => (locale === "uz" ? i.nameUz : i.nameRu))
    );

    try {
      const created = await addProperty({
        slug: `angren-${propertyType}-${Date.now().toString().slice(-6)}`,
        title_uz: titleUz.trim() || (propertyType === "apartment" ? "Kvartira" : "Ko‘chmas mulk"),
        title_ru: titleRu.trim() || (propertyType === "apartment" ? "Квартира" : "Объект недвижимости"),
        description_uz: descUz.trim(),
        description_ru: descRu.trim(),
        note_uz: noteUz.trim() || undefined,
        note_ru: noteRu.trim() || undefined,
        address_uz: addressUz.trim(),
        address_ru: addressRu.trim() || addressUz.trim(),
        district_name_uz: district,
        district_name_ru: district,
        hudud_id: hududId || undefined,
        transaction_type: transactionType,
        deal_type: transactionType,
        property_type: propertyType,
        status: statusToSave,
        price_uzs: calculatedPrices.priceUzs,
        price_usd: calculatedPrices.priceUsd,
        currency,
        price_negotiable: priceNegotiable,
        area_sqm: effectiveAreaSqm,
        area_sotikh:
          propertyType === "house_yard" || propertyType === "land"
            ? areaSotikh || (calculatedFacadeArea?.sotikh ?? 0)
            : undefined,
        living_area_sqm: propertyType === "house_yard" ? houseAreaSqm : undefined,
        rooms: propertyType === "land" ? 1 : rooms,
        floor: propertyType === "house_yard" || propertyType === "land" ? 1 : floor,
        total_floors: propertyType === "apartment" ? totalFloors : 1,
        renovation,
        furniture,
        facade_m: facadeM ? Number(facadeM) : undefined,
        depth_m: depthM ? Number(depthM) : undefined,
        dimensions,
        images: imageUrls,
        photos: imageUrls,
        main_image: mainImage || imageUrls[0] || "",
        video_url: videoUrl.trim() || undefined,
        coordinates: { lat, lng },
        latitude: lat,
        longitude: lng,
        polygon: polygonPoints.length > 0 ? polygonPoints : undefined,
        utilities: {
          gas: utilities.gas,
          electricity: utilities.electricity,
          cold_water: utilities.cold_water,
          hot_water: utilities.hot_water,
          heating: utilities.heating,
          internet: utilities.internet,
          custom: utilities.custom || [],
        },
        amenities: {
          furniture,
          parking: hasParking,
          elevator: hasElevator || (propertyType === "apartment" && floor > 4),
          ac: hasAc,
          balcony: extraObjects.includes("Balkon") || propertyType === "apartment",
          internet: utilities.internet,
          green_zone: extraObjects.includes("Yashil hudud"),
          garage: extraObjects.includes("Garaj"),
          barn: extraObjects.includes("Molxona"),
          storage: extraObjects.includes("Ombor"),
          pool: extraObjects.includes("Basseyn"),
          summer_kitchen: extraObjects.includes("Yozgi oshxona") || extraObjects.includes("Qo‘shimcha bino"),
          garden: extraObjects.includes("Bog‘"),
          property_features: [...extraObjects, ...customExtraObjects],
          yard_objects: extraObjects,
          custom_extra_objects: customExtraObjects,
          custom_advantages: customAdvantages,
          ...((commercialFeatures.length > 0 ? { commercialFeatures } : {}) as any),
          ...((autoInfrastructure.length > 0 ? { infrastructure: autoInfrastructure } : {}) as any),
          ...((additionalNote ? { customNote: additionalNote } : {}) as any),
        },
        badges: activeBadges,
        is_top: isTop,
        is_fast_sale: isFastSale,
        is_good_deal: isHamyonbop,
        realtor_id: selectedRealtorId || undefined,
        owner_phone: ownerPhone.trim() || undefined,
        contact_phone: contactPhone.trim() || "+998 90 123 45 67",
        contact_telegram: contactTelegram.trim() || "@angrenestate_admin",
      });

      if (!created) {
        throw new Error(
          locale === "uz"
            ? "Obyektni saqlashda xatolik yuz berdi. Qayta urinib ko‘ring."
            : "Ошибка при сохранении объекта. Попробуйте еще раз."
        );
      }

      // Discard draft on successful save
      discardDraft();

      // Redirect to properties table
      router.push("/admin/properties");
    } catch (err: any) {
      console.error("[AddPropertyPage] Save error:", err);
      setSaveError(
        err?.message ||
          (locale === "uz"
            ? "Obyektni saqlab bo‘lmadi. Ma’lumotlarni tekshiring."
            : "Не удалось сохранить объект. Проверьте введенные данные.")
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/properties"
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {locale === "uz" ? "Yangi obyekt qo‘shish" : "Создание нового объекта"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {locale === "uz"
                ? `5-bosqichli wizard • ${activeStep}-bosqich`
                : `5-этапный мастер • Этап ${activeStep} из 5`}
            </p>
          </div>
        </div>

        {/* Action buttons on top */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave("draft")}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all disabled:opacity-50"
          >
            {isSubmitting
              ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
              : locale === "uz" ? "Qoralama sifatida saqlash" : "Сохранить черновик"}
          </button>
          {activeStep === 5 && (
            <button
              type="button"
              onClick={() => handleSave("published")}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#16543C] hover:bg-[#0E3324] text-white font-bold text-xs shadow-md shadow-emerald-950/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{locale === "uz" ? "Nashr qilish" : "Опубликовать"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {saveError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-900 text-xs font-bold shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Step Error Banner */}
      {stepError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900 text-xs font-bold shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{stepError}</span>
        </div>
      )}

      {/* Unsaved Draft Recovery Notice */}
      {draftAvailable && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{locale === "uz" ? "Saqlangan qoralama topildi." : "Обнаружен сохраненный черновик."}</strong>{" "}
              {locale === "uz"
                ? "Avval kiritilgan ma’lumotlarni formaga qaytarmoqchimisiz?"
                : "Восстановить ранее заполненные данные?"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={restoreDraft}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"
            >
              {locale === "uz" ? "Tiklash" : "Восстановить"}
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-3 py-1.5 rounded-xl border border-amber-300 text-amber-800 hover:bg-amber-100 font-semibold text-xs transition-colors"
            >
              {locale === "uz" ? "Bekor qilish" : "Отклонить"}
            </button>
          </div>
        </div>
      )}

      {/* Step Indicator (1 -> 2 -> 3 -> 4 -> 5) */}
      <div className="grid grid-cols-5 gap-2 select-none">
        {[
          { step: 1, title_uz: "Asosiy", title_ru: "Основное", desc_uz: "Tur & Narx", desc_ru: "Тип и цена" },
          { step: 2, title_uz: "Rasm & Kontent", title_ru: "Фото и контент", desc_uz: "3:4 & Matn", desc_ru: "3:4 и текст" },
          { step: 3, title_uz: "Manzil & Xarita", title_ru: "Адрес и карта", desc_uz: "Hudud & Nuqta", desc_ru: "Район и метка" },
          { step: 4, title_uz: "Parametrlar", title_ru: "Параметры", desc_uz: "Dinamik forma", desc_ru: "Динамическая" },
          { step: 5, title_uz: "Preview & Nashr", title_ru: "Превью и публикация", desc_uz: "Tekshirish", desc_ru: "Проверка" },
        ].map((item) => {
          const isActive = activeStep === item.step;
          const isPassed = activeStep > item.step;

          return (
            <button
              key={item.step}
              type="button"
              onClick={() => {
                if (item.step < activeStep || validateStep(activeStep)) {
                  setActiveStep(item.step);
                }
              }}
              className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all ${
                isActive
                  ? "bg-[#16543C] text-white border-emerald-800 shadow-md ring-2 ring-[#16543C]"
                  : isPassed
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] sm:text-xs font-black ${isActive ? "text-emerald-300" : isPassed ? "text-emerald-700" : "text-slate-400"}`}>
                  {locale === "uz" ? `${item.step}-bosqich` : `Этап ${item.step}`}
                </span>
                {isPassed && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
              </div>
              <div className={`text-xs sm:text-sm font-bold truncate mt-0.5 ${isActive ? "text-white" : isPassed ? "text-slate-800" : "text-slate-500"}`}>
                {locale === "uz" ? item.title_uz : item.title_ru}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Wizard Form Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-xs space-y-6">
        {/* ========================================================================= */}
        {/* 1-BOSQICH — ASOSIY MA'LUMOTLAR */}
        {/* ========================================================================= */}
        {activeStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900">
                {locale === "uz" ? "1. Asosiy ma’lumotlar" : "1. Основная информация"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {locale === "uz"
                  ? "Bitim turi, ko‘chmas mulk toifasi va narxini belgilang"
                  : "Выберите тип сделки, категорию объекта и стоимость"}
              </p>
            </div>

            {/* 1.1 Bitim turi (Required) */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                {locale === "uz" ? "Bitim turi *" : "Тип сделки *"}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTransactionType("sale")}
                  className={`p-4 rounded-2xl border text-center font-black text-sm transition-all ${
                    transactionType === "sale"
                      ? "border-[#16543C] bg-emerald-50 text-[#16543C] ring-2 ring-[#16543C] shadow-xs"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  {locale === "uz" ? "Sotuv (Продажа)" : "Продажа (Sotuv)"}
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType("rent")}
                  className={`p-4 rounded-2xl border text-center font-black text-sm transition-all ${
                    transactionType === "rent"
                      ? "border-[#16543C] bg-emerald-50 text-[#16543C] ring-2 ring-[#16543C] shadow-xs"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  {locale === "uz" ? "Ijara (Аренда)" : "Аренда (Ijara)"}
                </button>
              </div>
            </div>

            {/* 1.2 Ko‘chmas mulk turi (5 ta toifa) */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                {locale === "uz" ? "Ko‘chmas mulk turi *" : "Тип недвижимости *"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  {
                    key: "apartment" as PropertyType,
                    icon: Building2,
                    uz: "Kvartira",
                    ru: "Квартира",
                  },
                  {
                    key: "house_yard" as PropertyType,
                    icon: Home,
                    uz: "Hovli uy",
                    ru: "Дом",
                  },
                  {
                    key: "land" as PropertyType,
                    icon: Trees,
                    uz: "Bo‘sh yer uchastkasi",
                    ru: "Земельный участок",
                  },
                  {
                    key: "other" as PropertyType,
                    icon: Warehouse,
                    uz: "Noturar obyekt",
                    ru: "Нежилой объект",
                  },
                  {
                    key: "commercial" as PropertyType,
                    icon: Briefcase,
                    uz: "Tijorat obyekti",
                    ru: "Коммерческий объект",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = propertyType === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPropertyType(item.key)}
                      className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2.5 text-center transition-all ${
                        isSelected
                          ? "border-[#16543C] bg-emerald-50 text-[#16543C] ring-2 ring-[#16543C] shadow-xs font-black"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold"
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? "text-[#16543C]" : "text-slate-500"}`} />
                      <span className="text-xs leading-snug">
                        {locale === "uz" ? item.uz : item.ru}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {locale === "uz"
                  ? "💡 4-bosqichdagi forma aynan shu tanlangan toifaga qarab avtomatik moslashadi."
                  : "💡 Форма на 4-м этапе автоматически адаптируется под выбранный тип недвижимости."}
              </p>
            </div>

            {/* 1.3 Narx va Valyuta (Dynamic Currency) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                {locale === "uz" ? "Narxi va Valyutasi *" : "Стоимость и валюта *"}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Valyuta tanlash */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500">
                    {locale === "uz" ? "Asosiy valyuta" : "Основная валюта"}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currency !== "USD") {
                          setCurrency("USD");
                          setPriceInput(calculatedPrices.priceUsd);
                        }
                      }}
                      className={`py-2.5 rounded-xl border text-xs font-black transition-all ${
                        currency === "USD"
                          ? "bg-[#16543C] text-white border-emerald-800"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (currency !== "UZS") {
                          setCurrency("UZS");
                          setPriceInput(calculatedPrices.priceUzs);
                        }
                      }}
                      className={`py-2.5 rounded-xl border text-xs font-black transition-all ${
                        currency === "UZS"
                          ? "bg-[#16543C] text-white border-emerald-800"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      UZS (so‘m)
                    </button>
                  </div>
                </div>

                {/* Narx kiritish */}
                <div className="sm:col-span-2 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500">
                    {locale === "uz" ? `Narx (${currency})` : `Сумма (${currency})`}
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={priceInput || ""}
                      onChange={(e) => setPriceInput(Number(e.target.value))}
                      placeholder={currency === "USD" ? "Masalan: 35000" : "Masalan: 450000000"}
                      className="w-full pl-4 pr-16 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-black text-sm focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                    <span className="absolute right-4 top-2.5 text-xs font-black text-slate-400">
                      {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dinamik hisoblangan kurs natijasi */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-emerald-950">
                <div>
                  <span className="text-slate-500">{locale === "uz" ? "Ekvivalent: " : "Эквивалент: "}</span>
                  <strong className="text-slate-900">
                    {currency === "USD"
                      ? `${calculatedPrices.priceUzs.toLocaleString("uz-UZ")} UZS`
                      : `$${calculatedPrices.priceUsd.toLocaleString("en-US")} USD`}
                  </strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  {locale === "uz" ? "Joriy kurs: " : "Текущий курс: "}
                  <strong>1 USD = {exchangeRate.toLocaleString("uz-UZ")} UZS</strong>
                </div>
              </div>

              {/* Kelishiladi checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="priceNegotiable"
                  checked={priceNegotiable}
                  onChange={(e) => setPriceNegotiable(e.target.checked)}
                  className="w-4 h-4 rounded text-[#16543C] focus:ring-[#16543C] accent-[#16543C]"
                />
                <label htmlFor="priceNegotiable" className="text-xs font-bold text-slate-700 cursor-pointer">
                  {locale === "uz" ? "Narxi kelishiladi (savdolashish mumkin)" : "Цена договорная (торг уместен)"}
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2-BOSQICH — RASM VA E'LON KONTENTI */}
        {/* ========================================================================= */}
        {activeStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900">
                {locale === "uz" ? "2. Rasm va e’lon kontenti" : "2. Фотографии и контент объявления"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {locale === "uz"
                  ? "3:4 vertikal rasmlar, sarlavha, tavsif va ixtiyoriy video sharh"
                  : "Вертикальные фото 3:4, заголовок, описание и видеообзор"}
              </p>
            </div>

            {/* 2.1 Rasmlar (3:4 aspect ratio) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "Obyekt rasmlari (3:4 vertikal) *" : "Фотографии объекта (вертикальные 3:4) *"}
                </label>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                  3:4 Portrait
                </span>
              </div>
              <PropertyImageUploader
                images={imageUrls}
                mainImage={mainImage}
                onChangeImages={setImageUrls}
                onChangeMainImage={setMainImage}
                propertyId="new"
              />
            </div>

            {/* 2.2 & 2.3 Sarlavha va Tavsif (Bilingual UZ / RU) */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "E’lon sarlavhasi va tavsifi *" : "Заголовок и описание объявления *"}
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAutoTranslate("uz_to_ru")}
                    disabled={isTranslating}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1"
                  >
                    <Languages className="w-3 h-3" />
                    <span>UZ ➔ RU</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAutoTranslate("ru_to_uz")}
                    disabled={isTranslating}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1"
                  >
                    <Languages className="w-3 h-3" />
                    <span>RU ➔ UZ</span>
                  </button>
                </div>
              </div>

              {translationNotice && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                  {translationNotice.msg}
                </div>
              )}

              {/* Title Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>{locale === "uz" ? "Sarlavha (O‘zbekcha - Lotin) *" : "Заголовок (Узбекский латиница) *"}</span>
                    {translatingField === "title_ru_uz" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Tarjima qilinmoqda...</span>}
                  </span>
                  <input
                    type="text"
                    value={titleUz}
                    onChange={(e) => {
                      setTitleUz(e.target.value);
                      setTitleUzManual(true);
                    }}
                    onBlur={() => handleFieldBlur("title", "uz")}
                    placeholder="Masalan: 5/1 dahasida shinam 3 xonali kvartira"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>{locale === "uz" ? "Sarlavha (Ruscha) *" : "Заголовок (Русский) *"}</span>
                    {translatingField === "title_uz_ru" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Перевод...</span>}
                  </span>
                  <input
                    type="text"
                    value={titleRu}
                    onChange={(e) => {
                      setTitleRu(e.target.value);
                      setTitleRuManual(true);
                    }}
                    onBlur={() => handleFieldBlur("title", "ru")}
                    placeholder="Например: Уютная 3-комнатная квартира на 5/1 массиве"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                  />
                </div>
              </div>

              {/* Description Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>{locale === "uz" ? "Batafsil tavsif (O‘zbekcha)" : "Подробное описание (Узбекский)"}</span>
                    {translatingField === "desc_ru_uz" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Tarjima qilinmoqda...</span>}
                  </span>
                  <textarea
                    rows={4}
                    value={descUz}
                    onChange={(e) => {
                      setDescUz(e.target.value);
                      setDescUzManual(true);
                    }}
                    onBlur={() => handleFieldBlur("desc", "uz")}
                    placeholder="Mulk holati, qo‘shnilar, qulayliklar va afzalliklari haqida batafsil..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>{locale === "uz" ? "Batafsil tavsif (Ruscha)" : "Подробное описание (Русский)"}</span>
                    {translatingField === "desc_uz_ru" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Перевод...</span>}
                  </span>
                  <textarea
                    rows={4}
                    value={descRu}
                    onChange={(e) => {
                      setDescRu(e.target.value);
                      setDescRuManual(true);
                    }}
                    onBlur={() => handleFieldBlur("desc", "ru")}
                    placeholder="Подробности об объекте, состоянии, ремонте и преимуществах..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 2.4 Qo‘shimcha eslatma (Bilingual UZ / RU) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                {locale === "uz" ? "Qo‘shimcha eslatma (Ixtiyoriy)" : "Дополнительная заметка (Опционально)"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>{locale === "uz" ? "Eslatma (O‘zbekcha - Lotin)" : "Заметка (Узбекский латиница)"}</span>
                    {translatingField === "note_ru_uz" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Tarjima...</span>}
                  </span>
                  <input
                    type="text"
                    value={noteUz}
                    onChange={(e) => {
                      setNoteUz(e.target.value);
                      setNoteUzManual(true);
                      setAdditionalNote(e.target.value);
                    }}
                    onBlur={() => handleFieldBlur("note", "uz")}
                    placeholder={locale === "uz" ? "Masalan: Ipotekaga berilmaydi, faqat naqd pulga" : "Например: Не под ипотеку, только наличный расчет"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>{locale === "uz" ? "Eslatma (Ruscha)" : "Заметка (Русский)"}</span>
                    {translatingField === "note_uz_ru" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Перевод...</span>}
                  </span>
                  <input
                    type="text"
                    value={noteRu}
                    onChange={(e) => {
                      setNoteRu(e.target.value);
                      setNoteRuManual(true);
                    }}
                    onBlur={() => handleFieldBlur("note", "ru")}
                    placeholder={locale === "uz" ? "Masalan: Ipotekaga berilmaydi, faqat naqd pulga" : "Например: Не под ипотеку, только наличный расчет"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 2.5 Video sharh (Ixtiyoriy - Optional) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-rose-600" />
                  <span>{locale === "uz" ? "Video sharh havolasi (Ixtiyoriy)" : "Ссылка на видеообзор (Опционально)"}</span>
                </label>
                <span className="text-[11px] font-bold text-slate-400">
                  {locale === "uz" ? "Majburiy emas" : "Не обязательно"}
                </span>
              </div>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... yoki https://youtu.be/..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
              />
              <p className="text-[11px] text-slate-500">
                {locale === "uz"
                  ? "Agar video havola kiritilsa, e'lon sahifasida qizil «Video sharh» tugmasi paydo bo‘ladi. Bo‘sh qoldirilsa, hech qanday video bloki chiqmaydi."
                  : "Если указать ссылку, в объявлении появится кнопка «Видео обзор». Если оставить пустым, видео-блок не будет отображаться."}
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3-BOSQICH — MANZIL, HUDUD VA XARITA */}
        {/* ========================================================================= */}
        {activeStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900">
                {locale === "uz" ? "3. Manzil, Hudud va Xarita" : "3. Адрес, Район и Карта"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {locale === "uz"
                  ? "Obyekt manzili, mavjud yoki yangi chizilgan hudud hamda xaritada aniq nuqtasi"
                  : "Точный адрес, привязка к району или полигону и отметка на карте"}
              </p>
            </div>

            {/* 3.1 Manzil (Required) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "Manzil (O‘zbekcha) *" : "Адрес (Узбекский) *"}
                </label>
                <input
                  type="text"
                  value={addressUz}
                  onChange={(e) => setAddressUz(e.target.value)}
                  placeholder="Masalan: Angren sh., 5/1 dahasi, 12-uy"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "Manzil (Ruscha) *" : "Адрес (Русский) *"}
                </label>
                <input
                  type="text"
                  value={addressRu}
                  onChange={(e) => setAddressRu(e.target.value)}
                  placeholder="Например: г. Ангрен, массив 5/1, дом 12"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                />
              </div>
            </div>

            {/* 3.2 Hudud (Variant A: Mavjud hudud, Variant B: Yangi hudud poligon chizish) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "Hudud (Rayon / Mavze) *" : "Район (Массив / Локация) *"}
                </label>
                {/* Variant B tugmasi */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingHudud(null);
                    setIsHududModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#16543C] border border-emerald-200 text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{locale === "uz" ? "+ Yangi hudud chizish (Poligon)" : "+ Создать новый район (Полигон)"}</span>
                </button>
              </div>

              {/* Variant A: Mavjud hududlar ro'yxati */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {hududList.map((h) => {
                  const isSelected = hududId === h.id || district === h.name_uz;
                  const isProtected = PROTECTED_HUDUDS.includes(h.id.toLowerCase().trim());
                  return (
                    <div
                      key={h.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        isSelected
                          ? "border-[#16543C] bg-emerald-50 text-[#16543C] font-bold ring-1 ring-[#16543C]"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setHududId(h.id);
                          setDistrict(h.name_uz);
                          if (h.latitude && h.longitude) {
                            setLat(h.latitude);
                            setLng(h.longitude);
                          }
                        }}
                        className="flex-1 text-left truncate flex items-center justify-between mr-1"
                      >
                        <span className="truncate">{locale === "uz" ? h.name_uz : h.name_ru}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#16543C] shrink-0 ml-1" />}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingHudud(h);
                            setIsHududModalOpen(true);
                          }}
                          title={locale === "uz" ? "Hududni tahrirlash" : "Редактировать район"}
                          className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!isProtected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePromptDeleteHudud(h);
                            }}
                            title={locale === "uz" ? "Hududni o‘chirish" : "Удалить район"}
                            className="p-1 rounded-lg hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hudud deletion confirmation modal */}
              {hududToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                  <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                    <h3 className="text-base font-black text-slate-900">
                      {locale === "uz" ? "Hududni o‘chirishni tasdiqlaysizmi?" : "Вы действительно хотите удалить этот район?"}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {locale === "uz"
                        ? `«${hududToDelete.name_uz}» hududini o‘chirishni tasdiqlaysizmi?`
                        : `Вы действительно хотите удалить этот район «${hududToDelete.name_ru || hududToDelete.name_uz}»?`}
                    </p>
                    {hududUsageCount > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
                        <div className="font-bold">
                          {locale === "uz"
                            ? "Bu hududga biriktirilgan obyektlar mavjud."
                            : "К этому району привязаны объекты."}
                        </div>
                        <div>
                          {locale === "uz"
                            ? `${hududUsageCount} ta obyekt mavjud. Hudud o‘chirilganda obyektlar o‘chirilmaydi, ularning hududi bo‘shatiladi (hudud_id olib tashlanadi).`
                            : `Привязано ${hududUsageCount} шт. При удалении района сами объекты НЕ удаляются, снимается только их привязка к району.`}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        disabled={isDeletingHudud}
                        onClick={() => setHududToDelete(null)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                      >
                        {locale === "uz" ? "Bekor qilish" : "Отмена"}
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingHudud}
                        onClick={() => handleDeleteHudud(hududToDelete)}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        {isDeletingHudud && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{locale === "uz" ? "O‘chirish" : "Удалить"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3.3 Xaritadan nuqta belgilash (Exact coordinates) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "Xaritada joylashuvi *" : "Местоположение на карте *"}
                </label>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200">
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

              {/* Automatic nearby infrastructure detection & calculation (strict 1km) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-emerald-700" />
                    <span>{locale === "uz" ? "Yaqin infratuzilma" : "Ближайшая инфраструктура"}</span>
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700">
                    {locale === "uz" ? "Maksimum 1 km" : "В радиусе 1 км"}
                  </span>
                </div>

                {/* Loading indicator */}
                {isSearchingInfra && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-emerald-800 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>
                      {locale === "uz"
                        ? "Atrofdagi infratuzilma aniqlanmoqda..."
                        : "Определяем инфраструктуру рядом..."}
                    </span>
                  </div>
                )}

                {/* Empty State */}
                {!isSearchingInfra && liveNearbyInfrastructure.length === 0 && (
                  <div className="p-3 rounded-xl bg-white/80 border border-emerald-100 text-center text-xs font-semibold text-slate-500">
                    {locale === "uz"
                      ? "1 km radiusda infratuzilma topilmadi."
                      : "В радиусе 1 км инфраструктура не найдена."}
                  </div>
                )}

                {/* Categories count badges */}
                {liveNearbyInfrastructure.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {liveNearbyInfrastructure.slice(0, 8).map((s) => (
                      <div
                        key={s.category}
                        className="p-2 rounded-xl bg-white border border-emerald-100 text-xs shadow-2xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 truncate">
                            {locale === "uz" ? s.labelUz : s.labelRu}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {s.closestDistance}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {s.count} {locale === "uz" ? "ta maskan" : "объекта"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Real nearby objects list */}
                {liveNearbyInfrastructure.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold text-emerald-900">
                      {locale === "uz" ? "1 km ichidagi aniq obyektlar:" : "Точные объекты в радиусе 1 км:"}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {liveNearbyInfrastructure
                        .flatMap((s) => s.items)
                        .sort((a, b) => a.distanceMeters - b.distanceMeters)
                        .slice(0, 12)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-100/80 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-1.5">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-slate-800 truncate">
                                {locale === "uz" ? item.nameUz : item.nameRu}
                              </span>
                            </div>
                            <span className="font-black text-[#16543C] shrink-0 text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded">
                              {item.formattedDistance}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4-BOSQICH — MULK TURI BO'YICHA DINAMIK FORMA */}
        {/* ========================================================================= */}
        {activeStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {locale === "uz" ? "4. Xususiyatlar va Parametrlar" : "4. Характеристики и параметры"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {locale === "uz"
                    ? `Toifa: ${getPropertyTypeLabel(propertyType, locale)} uchun maxsus forma`
                    : `Категория: специальная форма для «${getPropertyTypeLabel(propertyType, locale)}»`}
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-emerald-50 text-[#16543C] border border-emerald-200 text-xs font-black">
                {getPropertyTypeLabel(propertyType, locale)}
              </span>
            </div>

            {/* 4A — KVARTIRA */}
            {propertyType === "apartment" && (
              <div className="space-y-5">
                {/* Qavatlar dinamik ko'rsatkichi (Badge) */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#16543C]" />
                    <span className="text-xs font-bold text-slate-800">
                      {locale === "uz" ? "Tanlangan qavat holati:" : "Выбранный этаж:"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#16543C] text-white text-xs font-black">
                      {floor} / {totalFloors} {locale === "uz" ? "- qavat" : "этаж"}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    {locale === "uz"
                      ? `${totalFloors} qavatli binoning ${floor}-qavati`
                      : `${floor}-й этаж из ${totalFloors} этажей`}
                  </span>
                </div>

                {/* Range Slider 1: Bino qavatlari soni (1-25) */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {locale === "uz" ? "Bino qavatlari soni (1 — 25) *" : "Этажность здания (1 — 25) *"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-[#16543C]">
                        {totalFloors} {locale === "uz" ? "qavat" : "эт."}
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={totalFloors}
                    onChange={(e) => {
                      const newTotal = Number(e.target.value);
                      setTotalFloors(newTotal);
                      if (floor > newTotal) {
                        setFloor(newTotal);
                      }
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#16543C]"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                    <span>1</span>
                    <span>5</span>
                    <span>9</span>
                    <span>16</span>
                    <span>25</span>
                  </div>
                </div>

                {/* Range Slider 2: Kvartira qavati (1 — totalFloors) */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {locale === "uz" ? `Kvartira qavati (1 — ${totalFloors}) *` : `Этаж квартиры (1 — ${totalFloors}) *`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-[#16543C]">
                        {floor}-qavat
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, totalFloors)}
                    value={floor}
                    onChange={(e) => {
                      const newFloor = Number(e.target.value);
                      setFloor(Math.min(newFloor, totalFloors));
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#16543C]"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                    <span>1</span>
                    <span>{Math.round(totalFloors / 2) || 1}</span>
                    <span>{totalFloors}</span>
                  </div>
                </div>

                {/* Xonalar soni va Maydon */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Xonalar soni *" : "Количество комнат *"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={rooms}
                      onChange={(e) => setRooms(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Maydon (m²) *" : "Площадь (м²) *"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={areaSqm}
                      onChange={(e) => setAreaSqm(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                </div>

                {/* Sovutish & Isitish */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-sky-600" />
                      <span>{locale === "uz" ? "Sovutish tizimi" : "Система охлаждения"}</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHasAc(true)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          hasAc
                            ? "bg-emerald-50 border-[#16543C] text-[#16543C]"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        {locale === "uz" ? "Konditsioner bor" : "Есть кондиционер"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasAc(false)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          !hasAc
                            ? "bg-emerald-50 border-[#16543C] text-[#16543C]"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        {locale === "uz" ? "Yo‘q" : "Нет"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      <span>{locale === "uz" ? "Isitish turi" : "Тип отопления"}</span>
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "individual" as const, uz: "Ikki konturli", ru: "2-контурное" },
                        { key: "central" as const, uz: "Shahar tizimi", ru: "Городское" },
                        { key: "other" as const, uz: "Boshqa", ru: "Другое" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setHeatingType(item.key)}
                          className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                            heatingType === item.key
                              ? "bg-emerald-50 border-[#16543C] text-[#16543C]"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          {locale === "uz" ? item.uz : item.ru}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ta'mir & Jihoz */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Ta’mir holati" : "Состояние ремонта"}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "none" as RenovationType, uz: "Ta’mirsiz", ru: "Без ремонта" },
                        { key: "cosmetic" as RenovationType, uz: "O‘rta ta’mir", ru: "Средний" },
                        { key: "euro" as RenovationType, uz: "Yangi ta’mir", ru: "Евроремонт" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setRenovation(item.key)}
                          className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                            renovation === item.key
                              ? "bg-emerald-50 border-[#16543C] text-[#16543C]"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          {locale === "uz" ? item.uz : item.ru}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Jihozlar (Mebel & Texnika)" : "Меблировка"}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFurniture(true)}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                          furniture
                            ? "bg-emerald-50 border-[#16543C] text-[#16543C]"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        {locale === "uz" ? "Jihozlangan" : "С мебелью"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFurniture(false)}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                          !furniture
                            ? "bg-emerald-50 border-[#16543C] text-[#16543C]"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        {locale === "uz" ? "Jihozlanmagan" : "Без мебели"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4B — HOVLI UY */}
            {propertyType === "house_yard" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Yer maydoni (sotix) *" : "Площадь участка (соток) *"}
                    </span>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={areaSotikh || ""}
                      onChange={(e) => setAreaSotikh(Number(e.target.value))}
                      placeholder="Masalan: 6"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Uy maydoni (m²)" : "Площадь дома (м²)"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={houseAreaSqm || ""}
                      onChange={(e) => setHouseAreaSqm(Number(e.target.value))}
                      placeholder="Masalan: 120"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Fasad (metr)" : "Фасад (метров)"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={facadeM || ""}
                      onChange={(e) => setFacadeM(e.target.value ? Number(e.target.value) : "")}
                      placeholder="10"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Chuqurlik (metr)" : "Глубина (метров)"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={depthM || ""}
                      onChange={(e) => setDepthM(e.target.value ? Number(e.target.value) : "")}
                      placeholder="30"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                </div>

                {/* Avtomatik Fasad x Chuqurlik kalkulyatori banneri */}
                {calculatedFacadeArea && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950 font-bold">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {locale === "uz" ? "Fasad × Chuqurlik hisobi: " : "Расчет фасад × глубина: "}
                        <strong>{facadeM}m × {depthM}m = {calculatedFacadeArea.sqm} m² ({calculatedFacadeArea.sotikh} sotix)</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAreaSotikh(calculatedFacadeArea.sotikh);
                      }}
                      className="px-3 py-1 rounded-lg bg-[#16543C] text-white text-[11px] font-bold hover:bg-[#0E3324]"
                    >
                      {locale === "uz" ? "Qabul qilish" : "Применить"}
                    </button>
                  </div>
                )}


              </div>
            )}

            {/* 4C — BO'SH UCHASTKA */}
            {propertyType === "land" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Yer maydoni (sotix) *" : "Площадь участка (соток) *"}
                    </span>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={areaSotikh || ""}
                      onChange={(e) => setAreaSotikh(Number(e.target.value))}
                      placeholder="Masalan: 10"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Fasad (metr)" : "Фасад (метров)"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={facadeM || ""}
                      onChange={(e) => setFacadeM(e.target.value ? Number(e.target.value) : "")}
                      placeholder="20"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Chuqurlik (metr)" : "Глубина (метров)"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={depthM || ""}
                      onChange={(e) => setDepthM(e.target.value ? Number(e.target.value) : "")}
                      placeholder="50"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                </div>

                {calculatedFacadeArea && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950 font-bold">
                    <span>
                      {locale === "uz" ? "Avtomatik hisob: " : "Авторасчет: "}
                      <strong>{facadeM}m × {depthM}m = {calculatedFacadeArea.sqm} m² ({calculatedFacadeArea.sotikh} sotix)</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAreaSotikh(calculatedFacadeArea.sotikh)}
                      className="px-3 py-1 rounded-lg bg-[#16543C] text-white text-[11px] font-bold"
                    >
                      {locale === "uz" ? "Qabul qilish" : "Применить"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 4D — NOTURAR VA 4E — TIJORAT */}
            {(propertyType === "other" || propertyType === "commercial") && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Umumiy maydon (m²) *" : "Общая площадь (м²) *"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={areaSqm}
                      onChange={(e) => setAreaSqm(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Qavat" : "Этаж"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={nonResFloor}
                      onChange={(e) => setNonResFloor(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Xonalar soni" : "Помещений"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={rooms}
                      onChange={(e) => setRooms(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-600">
                      {locale === "uz" ? "Fasad (m)" : "Фасад (м)"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={facadeM || ""}
                      onChange={(e) => setFacadeM(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#16543C] outline-none"
                    />
                  </div>
                </div>

                {/* Tijorat afzalliklari */}
                {propertyType === "commercial" && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      {locale === "uz" ? "Tijorat afzalliklari va xususiyatlari" : "Преимущества коммерческого объекта"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        "Birinchi qatorda (Первая линия)",
                        "Alohida kirish (Отдельный вход)",
                        "Mijozlar avtoturargohi (Парковка)",
                        "Katta vitrina oynalar (Витрины)",
                        "Yuk tushirish zonasi (Зона разгрузки)",
                        "3-faza elektr quvvati (3-фазы)",
                      ].map((feat) => {
                        const isChecked = commercialFeatures.includes(feat);
                        return (
                          <button
                            key={feat}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setCommercialFeatures(commercialFeatures.filter((f) => f !== feat));
                              } else {
                                setCommercialFeatures([...commercialFeatures, feat]);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                              isChecked
                                ? "bg-emerald-50 border-[#16543C] text-[#16543C] font-bold"
                                : "bg-slate-50 border-slate-200 text-slate-600 text-xs"
                            }`}
                          >
                            <span className="text-xs truncate">{feat}</span>
                            {isChecked ? <CheckSquare className="w-4 h-4 text-[#16543C]" /> : <Square className="w-4 h-4 text-slate-300" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* 1. KOMMUNIKATSIYALAR / КОММУНИКАЦИИ */}
            {/* ================================================================= */}
            <div className="space-y-3 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#16543C]" />
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {locale === "uz" ? "Kommunikatsiyalar" : "Коммуникации"}
                  </label>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#16543C]">
                  {[
                    utilities.gas,
                    utilities.electricity,
                    utilities.cold_water,
                    utilities.hot_water,
                    utilities.heating,
                    utilities.internet,
                  ].filter(Boolean).length} / 6
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { key: "gas", uz: "Gaz", ru: "Газ", icon: Flame },
                  { key: "electricity", uz: "Elektr", ru: "Электричество", icon: Zap },
                  { key: "cold_water", uz: "Sovuq suv", ru: "Холодная вода", icon: Droplets },
                  { key: "hot_water", uz: "Issiq suv", ru: "Горячая вода", icon: Thermometer },
                  { key: "heating", uz: "Shahar isitish tizimi", ru: "Городское отопление", icon: Flame },
                  { key: "internet", uz: "Internet / Wi-Fi", ru: "Интернет / Wi-Fi", icon: Wifi },
                ].map((item) => {
                  const Icon = item.icon;
                  const isChecked = Boolean((utilities as any)[item.key]);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setUtilities((prev) => ({
                          ...prev,
                          [item.key]: !isChecked,
                        }));
                      }}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                        isChecked
                          ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                          : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs truncate">{locale === "uz" ? item.uz : item.ru}</span>
                      </div>
                      {isChecked ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ================================================================= */}
            {/* 2. QO‘SHIMCHA OBYEKTLAR / ДОПОЛНИТЕЛЬНЫЕ ОБЪЕКТЫ */}
            {/* ================================================================= */}
            <div className="space-y-3 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#16543C]" />
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {locale === "uz" ? "Qo‘shimcha obyektlar" : "Дополнительные объекты"}
                  </label>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#16543C]">
                  {extraObjects.length + customExtraObjects.length} {locale === "uz" ? "ta" : "ед."}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { uz: "Garaj", ru: "Гараж", icon: Warehouse },
                  { uz: "Yashil hudud", ru: "Зелёная зона", icon: Trees },
                  { uz: "Ombor", ru: "Склад", icon: Archive },
                  { uz: "Molxona", ru: "Хлев / хозпостройка", icon: Home },
                  { uz: "Basseyn", ru: "Бассейн", icon: Waves },
                  { uz: "Qo‘shimcha bino", ru: "Дополнительное строение", icon: Building },
                  { uz: "Balkon", ru: "Балкон", icon: DoorClosed },
                  { uz: "Bog‘", ru: "Сад", icon: Trees },
                ].map((item) => {
                  const isChecked = extraObjects.includes(item.uz);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.uz}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setExtraObjects(extraObjects.filter((o) => o !== item.uz));
                        } else {
                          setExtraObjects([...extraObjects, item.uz]);
                        }
                      }}
                      className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isChecked
                          ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                          : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs truncate">{locale === "uz" ? item.uz : item.ru}</span>
                      </div>
                      {isChecked ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                    </button>
                  );
                })}

                {/* Custom extra objects */}
                {customExtraObjects.map((customObj) => (
                  <div
                    key={customObj}
                    className="p-2.5 rounded-2xl border bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold flex items-center justify-between text-xs"
                  >
                    <span className="truncate">{customObj}</span>
                    <button
                      type="button"
                      onClick={() => setCustomExtraObjects(customExtraObjects.filter((o) => o !== customObj))}
                      className="text-red-500 hover:text-red-700 ml-1 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add custom extra object */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newExtraObjectInput}
                  onChange={(e) => setNewExtraObjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newExtraObjectInput.trim()) {
                      e.preventDefault();
                      setCustomExtraObjects([...customExtraObjects, newExtraObjectInput.trim()]);
                      setNewExtraObjectInput("");
                    }
                  }}
                  placeholder={locale === "uz" ? "Boshqa qo‘shimcha obyekt qo‘shish (masalan: Sauna, Terasa)..." : "Добавить другой объект (например: Сауна, Терраса)..."}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#16543C] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newExtraObjectInput.trim()) {
                      setCustomExtraObjects([...customExtraObjects, newExtraObjectInput.trim()]);
                      setNewExtraObjectInput("");
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#16543C] hover:bg-[#0E3324] text-white text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{locale === "uz" ? "Qo‘shish" : "Добавить"}</span>
                </button>
              </div>
            </div>

            {/* ================================================================= */}
            {/* 3. AFZALLIKLAR / ПРЕИМУЩЕСТВА */}
            {/* ================================================================= */}
            <div className="space-y-3 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#16543C]" />
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {locale === "uz" ? "Afzalliklar" : "Преимущества"}
                  </label>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#16543C]">
                  {[hasAc, furniture, hasParking, renovation === "euro", hasElevator].filter(Boolean).length + customAdvantages.length} {locale === "uz" ? "ta" : "ед."}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* Konditsioner */}
                <button
                  type="button"
                  onClick={() => setHasAc(!hasAc)}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    hasAc
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Wind className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Konditsioner" : "Кондиционер"}</span>
                  </div>
                  {hasAc ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>

                {/* Mebel */}
                <button
                  type="button"
                  onClick={() => setFurniture(!furniture)}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    furniture
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Home className="w-4 h-4 text-amber-800 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Mebel" : "Мебель"}</span>
                  </div>
                  {furniture ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>

                {/* Avtoturargoh */}
                <button
                  type="button"
                  onClick={() => setHasParking(!hasParking)}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    hasParking
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Car className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Avtoturargoh" : "Парковка"}</span>
                  </div>
                  {hasParking ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>

                {/* Yangi ta’mir */}
                <button
                  type="button"
                  onClick={() => setRenovation(renovation === "euro" ? "cosmetic" : "euro")}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    renovation === "euro"
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Yangi ta’mir" : "Новый ремонт"}</span>
                  </div>
                  {renovation === "euro" ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>

                {/* Lift */}
                <button
                  type="button"
                  onClick={() => setHasElevator(!hasElevator)}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    hasElevator
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Lift" : "Лифт"}</span>
                  </div>
                  {hasElevator ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>

                {/* Custom advantages */}
                {customAdvantages.map((customAdv) => (
                  <div
                    key={customAdv}
                    className="p-3 rounded-2xl border bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold flex items-center justify-between text-xs"
                  >
                    <span className="truncate">{customAdv}</span>
                    <button
                      type="button"
                      onClick={() => setCustomAdvantages(customAdvantages.filter((a) => a !== customAdv))}
                      className="text-red-500 hover:text-red-700 ml-1 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add custom advantage */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newAdvantageInput}
                  onChange={(e) => setNewAdvantageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newAdvantageInput.trim()) {
                      e.preventDefault();
                      setCustomAdvantages([...customAdvantages, newAdvantageInput.trim()]);
                      setNewAdvantageInput("");
                    }
                  }}
                  placeholder={locale === "uz" ? "Boshqa afzallik qo‘shish (masalan: Smart Home, Panoramik oyna)..." : "Добавить другое преимущество (например: Умный дом, Панорамные окна)..."}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#16543C] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newAdvantageInput.trim()) {
                      setCustomAdvantages([...customAdvantages, newAdvantageInput.trim()]);
                      setNewAdvantageInput("");
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#16543C] hover:bg-[#0E3324] text-white text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{locale === "uz" ? "Qo‘shish" : "Добавить"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5-BOSQICH — PREVIEW + BADGES + PUBLISH */}
        {/* ========================================================================= */}
        {activeStep === 5 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-900">
                {locale === "uz" ? "5. Tekshirish, Nishonlar (Badges) va Nashr" : "5. Превью, Бейджи и Публикация"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {locale === "uz"
                  ? "Barcha ma’lumotlarni ko‘rib chiqing, nishonlarni sozlang va e’lonni nashr qiling"
                  : "Проверьте все данные, настройте бейджи и опубликуйте объявление"}
              </p>
            </div>

            {/* Badges boshqaruvi (5 ta qo'lda o'rnatiladigan badge) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                {locale === "uz" ? "Marketing nishonlari (Badges - Qo‘lda boshqarish)" : "Маркетинговые бейджи (Ручное управление)"}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {[
                  {
                    id: "top",
                    active: isTop,
                    toggle: () => setIsTop(!isTop),
                    uz: "TOP",
                    ru: "TOP",
                    bg: "bg-amber-500 text-white",
                  },
                  {
                    id: "arzon",
                    active: isArzon,
                    toggle: () => setIsArzon(!isArzon),
                    uz: "Arzon",
                    ru: "Недорого",
                    bg: "bg-teal-600 text-white",
                  },
                  {
                    id: "tez_sotiladi",
                    active: isFastSale,
                    toggle: () => setIsFastSale(!isFastSale),
                    uz: "Tezda sotilishi kerak",
                    ru: "Срочно продать",
                    bg: "bg-rose-600 text-white",
                  },
                  {
                    id: "hamyonbop",
                    active: isHamyonbop,
                    toggle: () => setIsHamyonbop(!isHamyonbop),
                    uz: "Hamyonbop",
                    ru: "Выгодная цена",
                    bg: "bg-blue-600 text-white",
                  },
                  {
                    id: "narxi_tushirildi",
                    active: isPriceDropped,
                    toggle: () => setIsPriceDropped(!isPriceDropped),
                    uz: "Narxi tushirildi",
                    ru: "Цена снижена",
                    bg: "bg-purple-600 text-white",
                  },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={b.toggle}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      b.active
                        ? `${b.bg} font-black shadow-xs ring-2 ring-slate-900/10`
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {b.active && <Check className="w-3.5 h-3.5" />}
                      <span>{locale === "uz" ? b.uz : b.ru}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Automatic "New" Badge Notice */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {locale === "uz"
                    ? "«Yangi» nishoni nashr qilingan vaqtdan boshlab 3 kun davomida avtomatik ko‘rinadi va 3 kundan so‘ng avtomatik yo‘qoladi."
                    : "Бейдж «Новинка» активируется автоматически на 3 дня после публикации и исчезнет по истечении срока."}
                </span>
              </div>
            </div>

            {/* Rieltor va Aloqa (Instagram & Owner Phone) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              {/* Rieltor biriktirish */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "Rieltor biriktirish" : "Назначить риелтора"}
                </label>
                <select
                  value={selectedRealtorId}
                  onChange={(e) => {
                    setSelectedRealtorId(e.target.value);
                    const r = realtors.find((item) => item.id === e.target.value);
                    if (r && r.phone) setContactPhone(r.phone);
                    if (r && r.telegram) setContactTelegram(r.telegram);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                >
                  <option value="">{locale === "uz" ? "Rieltor tanlanmagan (Agentlik mutaxassisi)" : "Без привязки (Специалист агентства)"}</option>
                  {realtors.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.phone}) {r.instagram_url || r.instagram ? "• Instagram bor" : ""}
                    </option>
                  ))}
                </select>

                {/* Selected realtor preview */}
                {(() => {
                  const r = realtors.find((item) => item.id === selectedRealtorId);
                  if (!r) return null;
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-slate-900">{r.name}</strong>
                        <div className="text-slate-500">{r.phone} • {r.telegram}</div>
                      </div>
                      {(r.instagram_url || r.instagram) && (
                        <span className="flex items-center gap-1 text-pink-600 font-bold">
                          <Instagram className="w-3.5 h-3.5" />
                          <span>Instagram</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Mulk egasi telefoni (Faqat admin uchun alohida, ixtiyoriy, maxfiy) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-900">
                    {locale === "uz" ? "Mulk egasi telefoni (Maxfiy)" : "Телефон владельца (Конфиденциально)"}
                  </label>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                    {locale === "uz" ? "Faqat Admin • Maxfiy" : "Только Админ • Скрыто"}
                  </span>
                </div>
                <input
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+998 90 000 00 00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 text-xs font-black text-amber-950 focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <p className="text-[11px] text-amber-800 font-medium">
                  {locale === "uz"
                    ? "Mulk egasining raqami mijozlarga ko‘rsatilmaydi. Saytda faqat biriktirilgan rieltor kontaktlari ko‘rinadi."
                    : "Номер владельца не показывается клиентам. На сайте отображаются только контакты риелтора."}
                </p>
              </div>
            </div>

            {/* PREVIEW CARD (Faqat kiritilgan ma'lumotlarni ko'rsatish) */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#16543C]" />
                <span>{locale === "uz" ? "E’lonning haqiqiy ko‘rinishi (Jonli Preview)" : "Живое превью объявления"}</span>
              </h3>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 space-y-6">
                {/* Image Gallery Preview (3:4 Vertical Aspect) */}
                {imageUrls.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                      {imageUrls.map((img, i) => (
                        <div
                          key={i}
                          className={`relative w-28 aspect-[3/4] rounded-2xl overflow-hidden shrink-0 border ${
                            i === 0 ? "border-[#16543C] ring-2 ring-[#16543C]" : "border-slate-200"
                          }`}
                        >
                          <Image src={img} alt={`Preview ${i + 1}`} fill className="object-cover" />
                          {i === 0 && (
                            <span className="absolute top-1.5 left-1.5 bg-[#16543C] text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                              3:4 Main
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Badges & Deal Type in Preview */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-xl bg-[#16543C] text-white px-3 py-1 text-xs font-black shadow-xs">
                    {transactionType === "sale" ? (locale === "uz" ? "Sotuv" : "Продажа") : (locale === "uz" ? "Ijara" : "Аренда")}
                  </span>
                  <span className="rounded-xl bg-slate-200 text-slate-800 px-3 py-1 text-xs font-bold">
                    {getPropertyTypeLabel(propertyType, locale)}
                  </span>
                  {/* Automatic new preview indicator */}
                  <span className="rounded-xl bg-emerald-600 text-white px-3 py-1 text-xs font-black shadow-xs">
                    {locale === "uz" ? "Yangi" : "Новинка"}
                  </span>
                  {isTop && <span className="rounded-xl bg-amber-500 text-white px-3 py-1 text-xs font-black">★ TOP</span>}
                  {isArzon && <span className="rounded-xl bg-teal-600 text-white px-3 py-1 text-xs font-bold">{locale === "uz" ? "Arzon" : "Недорого"}</span>}
                  {isFastSale && <span className="rounded-xl bg-rose-600 text-white px-3 py-1 text-xs font-bold">⚡ {locale === "uz" ? "Tezda sotilishi kerak" : "Срочно продать"}</span>}
                  {isHamyonbop && <span className="rounded-xl bg-blue-600 text-white px-3 py-1 text-xs font-bold">% {locale === "uz" ? "Hamyonbop" : "Выгодная цена"}</span>}
                  {isPriceDropped && <span className="rounded-xl bg-purple-600 text-white px-3 py-1 text-xs font-bold">↓ {locale === "uz" ? "Narxi tushirildi" : "Цена снижена"}</span>}
                </div>

                {/* Title & Price */}
                <div className="space-y-1">
                  <div className="text-2xl sm:text-3xl font-black text-slate-900">
                    {currency === "USD"
                      ? `$${calculatedPrices.priceUsd.toLocaleString("en-US")} USD`
                      : `${calculatedPrices.priceUzs.toLocaleString("uz-UZ")} UZS`}
                    <span className="text-xs font-semibold text-slate-500 ml-2">
                      ({currency === "USD"
                        ? `${calculatedPrices.priceUzs.toLocaleString("uz-UZ")} UZS`
                        : `$${calculatedPrices.priceUsd.toLocaleString("en-US")} USD`})
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 leading-snug">
                    {locale === "uz" ? (titleUz || titleRu) : (titleRu || titleUz)}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-[#16543C]" />
                    <span>{locale === "uz" ? (addressUz || addressRu) : (addressRu || addressUz)}</span>
                    <span>•</span>
                    <span>{district}</span>
                  </div>
                </div>

                {/* Specs Pill Grid (Only entered values) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {propertyType === "apartment" && (
                    <>
                      <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Maydon" : "Площадь"}</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">{areaSqm} m²</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Xonalar" : "Комнаты"}</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">{rooms}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Qavat" : "Этаж"}</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">{floor} / {totalFloors}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Ta’mir" : "Ремонт"}</div>
                        <div className="text-sm font-black text-[#16543C] mt-0.5">{getRenovationLabel(renovation, locale)}</div>
                      </div>
                    </>
                  )}

                  {(propertyType === "house_yard" || propertyType === "land") && (
                    <>
                      {areaSotikh > 0 && (
                        <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Yer maydoni" : "Участок"}</div>
                          <div className="text-sm font-black text-slate-900 mt-0.5">{areaSotikh} {locale === "uz" ? "sotix" : "соток"}</div>
                        </div>
                      )}
                      {propertyType === "house_yard" && houseAreaSqm > 0 && (
                        <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Uy maydoni" : "Дом"}</div>
                          <div className="text-sm font-black text-slate-900 mt-0.5">{houseAreaSqm} m²</div>
                        </div>
                      )}
                      {facadeM && depthM && (
                        <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center col-span-2 sm:col-span-2">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "O‘lchamlari" : "Габариты"}</div>
                          <div className="text-sm font-black text-slate-900 mt-0.5">{facadeM}m × {depthM}m</div>
                        </div>
                      )}
                    </>
                  )}

                  {(propertyType === "other" || propertyType === "commercial") && (
                    <>
                      <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Maydon" : "Площадь"}</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">{areaSqm} m²</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Qavat" : "Этаж"}</div>
                        <div className="text-sm font-black text-slate-900 mt-0.5">{nonResFloor}</div>
                      </div>
                      {rooms > 0 && (
                        <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">{locale === "uz" ? "Xonalar" : "Помещения"}</div>
                          <div className="text-sm font-black text-slate-900 mt-0.5">{rooms}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Description in Preview */}
                {(descUz || descRu) && (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800">{locale === "uz" ? "Tavsif" : "Описание"}</div>
                    <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                      {locale === "uz" ? (descUz || descRu) : (descRu || descUz)}
                    </p>
                  </div>
                )}

                {/* Video Review Button (Only if URL exists) */}
                {videoUrl && (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="w-5 h-5 text-rose-600" />
                      <span className="text-xs font-bold text-slate-800">{locale === "uz" ? "Video sharh mavjud" : "Видеообзор доступен"}</span>
                    </div>
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
                    >
                      {locale === "uz" ? "Tomosha qilish" : "Смотреть"}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wizard Bottom Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div>
            {activeStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{locale === "uz" ? "Orqaga" : "Назад"}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {activeStep < totalSteps ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-6 py-2.5 rounded-xl bg-[#16543C] hover:bg-[#0E3324] text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>{locale === "uz" ? "Keyingi bosqich" : "Далее"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave("draft")}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-xs transition-all disabled:opacity-50"
                >
                  {locale === "uz" ? "Qoralama sifatida saqlash" : "Сохранить черновик"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave("published")}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#16543C] hover:bg-[#0E3324] text-white font-black text-xs shadow-lg shadow-emerald-950/20 transition-all active:scale-98 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? (locale === "uz" ? "Nashr qilinmoqda..." : "Публикация...") : (locale === "uz" ? "Obyektni nashr qilish" : "Опубликовать объект")}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal for Variant B: Drawing New Hudud Polygon or Editing existing */}
      {isHududModalOpen && (
        <HududPolygonDrawerModal
          isOpen={isHududModalOpen}
          editingHudud={editingHudud}
          onClose={() => {
            setIsHududModalOpen(false);
            setEditingHudud(null);
          }}
          onHududCreated={(updatedHudud) => {
            setHududList((prev) => {
              const exists = prev.some((h) => h.id === updatedHudud.id);
              if (exists) {
                return prev.map((h) => (h.id === updatedHudud.id ? updatedHudud : h));
              }
              return [updatedHudud, ...prev];
            });
            setHududId(updatedHudud.id);
            setDistrict(updatedHudud.name_uz);
            if (updatedHudud.latitude && updatedHudud.longitude) {
              setLat(updatedHudud.latitude);
              setLng(updatedHudud.longitude);
            }
            setEditingHudud(null);
          }}
        />
      )}
    </div>
  );
}
