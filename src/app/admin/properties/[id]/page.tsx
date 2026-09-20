"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
  Pencil,
  Archive,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Globe,
  Languages,
  Loader2,
  Instagram,
  Compass,
  Building,
  Trees,
  Warehouse,
  Home,
  Waves,
  DoorClosed,
  Wind,
  Car,
  Thermometer,
  Wifi,
  Droplets,
  CheckSquare,
  Square,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useProperties } from "@/lib/propertyStore";
import { useRealtors } from "@/lib/realtorStore";
import { PropertyImageUploader } from "@/components/admin/PropertyImageUploader";
import {
  PropertyType,
  TransactionType,
  RenovationType,
  PropertyStatus,
  Property,
  HududItem,
  PropertyBadge,
  InfrastructureSummary,
} from "@/lib/types";
import {
  getPropertyTypeLabel,
  getDealTypeLabel,
  getBadgeLabel,
  getPropertyStatusLabel,
} from "@/lib/propertyFormatters";
import { HududPolygonDrawerModal } from "@/components/admin/HududPolygonDrawerModal";
import {
  getInfrastructureAround,
  fetchNearbyInfrastructure,
  MAX_INFRASTRUCTURE_RADIUS_METERS,
} from "@/lib/infrastructureService";

const PROTECTED_HUDUDS = ["markaz", "5-mavze", "6-mavze", "7-mavze", "dukent", "geolog", "yangiobod"];

const AdminLocationPicker = dynamic(
  () =>
    import("@/components/admin/AdminLocationPicker").then(
      (mod) => mod.AdminLocationPicker
    ),
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

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params?.id as string;

  const { locale } = useLanguage();
  const { exchangeRate } = useCurrency();
  const { properties, updateProperty, updatePropertyStatus, isLoaded } = useProperties();
  const { realtors } = useRealtors();

  const [activeStep, setActiveStep] = useState(1);
  const totalSteps = 6;
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const s = Number(urlParams.get("step"));
      if (s >= 1 && s <= 6) {
        setActiveStep(s);
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
  const [noteUz, setNoteUz] = useState("");
  const [noteRu, setNoteRu] = useState("");
  const [titleUzManual, setTitleUzManual] = useState(false);
  const [titleRuManual, setTitleRuManual] = useState(false);
  const [descUzManual, setDescUzManual] = useState(false);
  const [descRuManual, setDescRuManual] = useState(false);
  const [noteUzManual, setNoteUzManual] = useState(false);
  const [noteRuManual, setNoteRuManual] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);
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

  // Badges state (5 manual badges + 3-day automatic "new")
  const [selectedBadges, setSelectedBadges] = useState<PropertyBadge[]>([]);
  const toggleBadge = (badge: PropertyBadge) => {
    setSelectedBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]
    );
  };

  // Hudud state
  const [hududId, setHududId] = useState("");
  const [hududList, setHududList] = useState<HududItem[]>([]);
  const [isHududModalOpen, setIsHududModalOpen] = useState(false);
  const [hududToDelete, setHududToDelete] = useState<HududItem | null>(null);
  const [isDeletingHudud, setIsDeletingHudud] = useState(false);
  const [editingHudud, setEditingHudud] = useState<HududItem | null>(null);
  const [hududUsageCount, setHududUsageCount] = useState<number>(0);
  const [isCheckingUsage, setIsCheckingUsage] = useState<boolean>(false);

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
        console.warn("[Admin [id] Step 3] Infrastructure search error:", err);
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

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationNotice, setTranslationNotice] = useState<{
    type: "success" | "error" | "info";
    msg: string;
  } | null>(null);

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
  const [extraObjects, setExtraObjects] = useState<string[]>(["Yashil hudud", "Garaj"]);
  const [customExtraObjects, setCustomExtraObjects] = useState<string[]>([]);
  const [newExtraObjectInput, setNewExtraObjectInput] = useState("");
  const [customAdvantages, setCustomAdvantages] = useState<string[]>([]);
  const [newAdvantageInput, setNewAdvantageInput] = useState("");

  // Media
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [mainImage, setMainImage] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState("");

  // Contact
  const [selectedRealtorId, setSelectedRealtorId] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [contactPhone, setContactPhone] = useState("+998 90 123 45 67");
  const [contactTelegram, setContactTelegram] = useState("@angrenestate_admin");

  const [currentStatus, setCurrentStatus] = useState<PropertyStatus>("draft");
  const [notFound, setNotFound] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const populateForm = useCallback((found: Property) => {
    setTransactionType(found.transaction_type);
    setPropertyType(found.property_type);
    setTitleUz(found.title_uz || "");
    setTitleRu(found.title_ru || "");
    setDescUz(found.description_uz || "");
    setDescRu(found.description_ru || "");
    setNoteUz(found.note_uz || (found.amenities as any)?.customNoteUz || (found.amenities as any)?.customNote || "");
    setNoteRu(found.note_ru || (found.amenities as any)?.customNoteRu || "");
    setPriceUzs(found.price_uzs || 0);
    setPriceUsd(found.price_usd || Math.round((found.price_uzs || 0) / exchangeRate));
    setDistrict(found.district_name_uz || "Markaz");
    setAddressUz(found.address_uz || "");
    setAddressRu(found.address_ru || "");
    if (found.coordinates) {
      setLat(found.coordinates.lat);
      setLng(found.coordinates.lng);
    }
    setCurrentStatus(found.status);

    if (found.polygon && found.polygon.length > 0) {
      setPolygonPoints(found.polygon);
      setPolygonCoords(JSON.stringify(found.polygon));
    }

    setAreaSqm(found.area_sqm || 0);
    setLivingAreaSqm(found.living_area_sqm || Math.round((found.area_sqm || 0) * 0.75));
    setAreaSotikh(found.area_sotikh || 0);
    if (found.facade_m) setFacadeM(found.facade_m);
    if (found.depth_m) setDepthM(found.depth_m);
    setRooms(found.rooms || 1);
    setFloor(found.floor || 1);
    setTotalFloors(found.total_floors || 1);
    setRenovation(found.renovation || "euro");

    if (found.utilities) {
      setUtilities({
        electricity: found.utilities.electricity ?? true,
        gas: found.utilities.gas ?? true,
        cold_water: found.utilities.cold_water ?? (found.utilities as any).water ?? true,
        hot_water: found.utilities.hot_water ?? true,
        heating: found.utilities.heating ?? true,
        internet: found.utilities.internet ?? true,
        custom: found.utilities.custom || [],
      });
    }
    if (found.owner_phone) setOwnerPhone(found.owner_phone);
    if (found.amenities) {
      setAmenities(found.amenities);

      const loadedExtra: string[] = [];
      if (found.amenities.garage || (found as any).garage) loadedExtra.push("Garaj");
      if (found.amenities.green_zone || (found as any).green_zone) loadedExtra.push("Yashil hudud");
      if (found.amenities.storage) loadedExtra.push("Ombor");
      if (found.amenities.barn) loadedExtra.push("Molxona");
      if (found.amenities.pool) loadedExtra.push("Basseyn");
      if (found.amenities.summer_kitchen) loadedExtra.push("Qo‘shimcha bino");
      if (found.amenities.balcony) loadedExtra.push("Balkon");
      if (found.amenities.garden) loadedExtra.push("Bog‘");
      setExtraObjects(Array.from(new Set(loadedExtra)));

      const customExtra = Array.isArray((found.amenities as any)?.custom_extra_objects)
        ? (found.amenities as any).custom_extra_objects
        : [];
      setCustomExtraObjects(customExtra);

      const customAdv = Array.isArray((found.amenities as any)?.custom_advantages)
        ? (found.amenities as any).custom_advantages
        : [];
      setCustomAdvantages(customAdv);
    }
    if (found.images && found.images.length > 0) {
      setImageUrls(found.images);
      setMainImage(found.main_image || found.images[0]);
    }
    if (found.video_url) setVideoUrl(found.video_url);
    if (found.contact_phone) setContactPhone(found.contact_phone);
    if (found.contact_telegram) setContactTelegram(found.contact_telegram);
    if (found.realtor_id) setSelectedRealtorId(found.realtor_id);
    if (found.badges && Array.isArray(found.badges)) {
      setSelectedBadges(found.badges.filter((b) => b !== "new"));
    } else {
      const b: PropertyBadge[] = [];
      if (found.is_top) b.push("top");
      if (found.is_fast_sale) b.push("tez_sotiladi");
      if (found.is_good_deal) b.push("hamyonbop");
      setSelectedBadges(b);
    }
    if (found.hudud_id) setHududId(found.hudud_id);
    setInitialDataLoaded(true);
  }, []);

  // Load existing property data
  useEffect(() => {
    if (!propertyId) return;
    if (isLoaded) {
      const found = properties.find((p) => p.id === propertyId);
      if (found) {
        populateForm(found);
        return;
      }
    }

    // Direct API fallback fetch if not present in memory
    fetch(`/api/admin/properties/${propertyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.property) {
          populateForm(data.property);
        } else if (isLoaded) {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (isLoaded) setNotFound(true);
      });
  }, [propertyId, isLoaded, properties, populateForm]);

  const [isUpdating, setIsUpdating] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const isFormDirty = Boolean(
    initialDataLoaded &&
      (titleUz !== (properties.find((p) => p.id === propertyId)?.title_uz || "") ||
        addressUz !== (properties.find((p) => p.id === propertyId)?.address_uz || "") ||
        priceUzs !== (properties.find((p) => p.id === propertyId)?.price_uzs || 0) ||
        rooms !== (properties.find((p) => p.id === propertyId)?.rooms || 1) ||
        selectedRealtorId !== (properties.find((p) => p.id === propertyId)?.realtor_id || ""))
  );

  // Warn on exit when form is modified
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormDirty && !isUpdating) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isFormDirty, isUpdating]);

  const handleUpdate = async (status: PropertyStatus) => {
    if (isUpdating) return;
    setIsUpdating(true);
    setSaveError(null);

    let parsedPolygon: [number, number][] | undefined = undefined;
    if (polygonPoints.length > 0) {
      parsedPolygon = polygonPoints;
    } else if (polygonCoords.trim()) {
      try {
        parsedPolygon = JSON.parse(polygonCoords);
      } catch {}
    }

    try {
      const updated = await updateProperty(propertyId, {
        title_uz: titleUz || "Angren ko‘chmas mulk obyekti",
        title_ru: titleRu || "Объект недвижимости в Ангрене",
        description_uz: descUz || "Angren shahrida joylashgan qulay ko‘chmas mulk.",
        description_ru: descRu || "Удобный объект недвижимости в городе Ангрен.",
        note_uz: noteUz.trim() || undefined,
        note_ru: noteRu.trim() || undefined,
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
        is_top: selectedBadges.includes("top"),
        is_fast_sale: selectedBadges.includes("tez_sotiladi"),
        is_good_deal: selectedBadges.includes("hamyonbop") || selectedBadges.includes("arzon"),
        badges: selectedBadges,
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
          ...amenities,
          green_zone: extraObjects.includes("Yashil hudud"),
          garage: extraObjects.includes("Garaj"),
          barn: extraObjects.includes("Molxona"),
          storage: extraObjects.includes("Ombor"),
          pool: extraObjects.includes("Basseyn"),
          summer_kitchen: extraObjects.includes("Qo‘shimcha bino") || extraObjects.includes("Yozgi oshxona"),
          balcony: extraObjects.includes("Balkon") || Boolean(amenities.balcony),
          garden: extraObjects.includes("Bog‘"),
          property_features: [...extraObjects, ...customExtraObjects],
          yard_objects: extraObjects,
          custom_extra_objects: customExtraObjects,
          custom_advantages: customAdvantages,
        },
        facade_m: facadeM ? Number(facadeM) : undefined,
        depth_m: depthM ? Number(depthM) : undefined,
        dimensions: facadeM && depthM ? `${facadeM} × ${depthM} m` : undefined,
        owner_phone: ownerPhone || undefined,
        contact_phone: contactPhone || "+998 90 123 45 67",
        contact_telegram: contactTelegram,
        realtor_id: selectedRealtorId || undefined,
      });

      if (!updated) {
        throw new Error(
          locale === "uz"
            ? "Obyektni yangilashda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring."
            : "Ошибка при обновлении объекта. Пожалуйста, попробуйте снова."
        );
      }

      router.push("/admin/properties");
    } catch (e: any) {
      console.error("Error updating property:", e);
      setSaveError(e?.message || (locale === "uz" ? "Obyektni yangilashda xatolik yuz berdi" : "Ошибка при обновлении"));
      setIsUpdating(false);
    }
  };

  if (notFound) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <h2 className="text-xl font-black text-slate-900">
          {locale === "uz" ? "Obyekt topilmadi" : "Объект не найден"}
        </h2>
        <p className="text-xs text-slate-500">
          {locale === "uz"
            ? "Bunday ID ga ega obyekt mavjud emas yoki o‘chirilgan."
            : "Объект с таким ID не существует или был удален."}
        </p>
        <Link
          href="/admin/properties"
          className="inline-block px-4 py-2 rounded-xl bg-[#16543C] text-white text-xs font-bold"
        >
          {locale === "uz" ? "Ro‘yxatga qaytish" : "Вернуться к списку"}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/properties"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {locale === "uz" ? "Obyektni tahrirlash" : "Редактирование объекта"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                {getPropertyStatusLabel(currentStatus, locale)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ID: <span className="font-mono">{propertyId}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleUpdate("draft")}
            disabled={isUpdating}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors disabled:opacity-50"
          >
            {locale === "uz" ? "Qoralama sifatida saqlash" : "Сохранить как черновик"}
          </button>
          <button
            type="button"
            onClick={() => handleUpdate("published")}
            disabled={isUpdating}
            className="px-4 py-2 rounded-xl bg-[#16543C] text-white hover:bg-[#0E3324] font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {isUpdating
                ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
                : locale === "uz" ? "Nashr qilish" : "Опубликовать"}
            </span>
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

      {/* Step Indicators */}
      <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold">
        {[
          { num: 1, label: locale === "uz" ? "Turi & Narxi" : "Тип и цена" },
          { num: 2, label: locale === "uz" ? "Sarlavha & Matn" : "Заголовок и текст" },
          { num: 3, label: locale === "uz" ? "Manzil & Xarita" : "Адрес и карта" },
          { num: 4, label: locale === "uz" ? "Parametrlar" : "Параметры" },
          { num: 5, label: locale === "uz" ? "Rasmlar" : "Фотографии" },
          { num: 6, label: locale === "uz" ? "Aloqa & Rieltor" : "Контакты и риелтор" },
        ].map((step) => (
          <button
            key={step.num}
            type="button"
            onClick={() => setActiveStep(step.num)}
            className={`p-2.5 rounded-2xl border transition-all ${
              activeStep === step.num
                ? "bg-[#16543C] text-white border-[#16543C] shadow-sm"
                : activeStep > step.num
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="text-[10px] opacity-70">
              {locale === "uz" ? `Bosqich ${step.num}` : `Этап ${step.num}`}
            </div>
            <div className="truncate text-xs">{step.label}</div>
          </button>
        ))}
      </div>

      {/* STEP FORMS CONTAINER */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        {/* STEP 1: Asosiy ma’lumotlar */}
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
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setTransactionType("sale")}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                    transactionType === "sale"
                      ? "bg-emerald-50 text-[#16543C] border-[#16543C] ring-2 ring-[#16543C]/20"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {locale === "uz" ? "Sotuv (Ko‘chmas mulkni sotish)" : "Продажа (Продажа недвижимости)"}
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType("rent")}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                    transactionType === "rent"
                      ? "bg-blue-50 text-blue-800 border-blue-600 ring-2 ring-blue-600/20"
                      : "border-slate-200 hover:bg-slate-50"
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
                ].map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setPropertyType(type.key as PropertyType)}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                      propertyType === type.key
                        ? "bg-[#16543C] text-white border-[#16543C] shadow-sm"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Fields */}
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

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { id: "top" as PropertyBadge, labelUz: "TOP", labelRu: "ТОП", icon: "★", color: "amber" },
                  { id: "arzon" as PropertyBadge, labelUz: "Arzon", labelRu: "Недорого", icon: "🏷️", color: "emerald" },
                  { id: "tez_sotiladi" as PropertyBadge, labelUz: "Tezda sotilishi kerak", labelRu: "Срочно продать", icon: "⚡", color: "rose" },
                  { id: "hamyonbop" as PropertyBadge, labelUz: "Hamyonbop", labelRu: "Выгодная цена", icon: "%", color: "blue" },
                  { id: "narxi_tushirildi" as PropertyBadge, labelUz: "Narxi tushirildi", labelRu: "Цена снижена", icon: "📉", color: "purple" },
                ].map((b) => {
                  const active = selectedBadges.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBadge(b.id)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        active
                          ? "border-[#16543C] bg-emerald-50/70 shadow-sm ring-2 ring-[#16543C]"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-base">{b.icon}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-bold ${
                            active
                              ? "bg-[#16543C] text-white border-[#16543C]"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {active && "✓"}
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-800 leading-tight">
                        {locale === "uz" ? b.labelUz : b.labelRu}
                      </span>
                    </button>
                  );
                })}
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

        {/* STEP 2: Sarlavha & Tavsif */}
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
                  <span className="text-[11px] text-slate-500 font-medium">
                    {locale === "uz" ? "Asosiy sayt tili" : "Основной язык сайта"}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      {locale === "uz" ? "Sarlavha (UZ)" : "Заголовок (UZ)"}
                    </label>
                    {translatingField === "title_ru_uz" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Tarjima qilinmoqda...</span>}
                  </div>
                  <input
                    type="text"
                    value={titleUz}
                    onChange={(e) => {
                      setTitleUz(e.target.value);
                      setTitleUzManual(true);
                    }}
                    onBlur={() => handleFieldBlur("title", "uz")}
                    placeholder={locale === "uz" ? "Masalan: Shinam 3 xonali kvartira, 6-mavze" : "Например: Уютная 3-комнатная квартира, 6-й микрорайон"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      {locale === "uz" ? "Batafsil tavsif (UZ)" : "Подробное описание (UZ)"}
                    </label>
                    {translatingField === "desc_ru_uz" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Tarjima qilinmoqda...</span>}
                  </div>
                  <textarea
                    rows={4}
                    value={descUz}
                    onChange={(e) => {
                      setDescUz(e.target.value);
                      setDescUzManual(true);
                    }}
                    onBlur={() => handleFieldBlur("desc", "uz")}
                    placeholder={locale === "uz" ? "Kvartira yoki uy haqida to‘liq ma’lumot..." : "Полная информация о квартире или доме..."}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      {locale === "uz" ? "Qo‘shimcha eslatma (UZ)" : "Дополнительная заметка (UZ)"}
                    </label>
                    {translatingField === "note_ru_uz" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Tarjima qilinmoqda...</span>}
                  </div>
                  <input
                    type="text"
                    value={noteUz}
                    onChange={(e) => {
                      setNoteUz(e.target.value);
                      setNoteUzManual(true);
                    }}
                    onBlur={() => handleFieldBlur("note", "uz")}
                    placeholder={locale === "uz" ? "Masalan: Ipotekaga berilmaydi, faqat naqd pulga" : "Например: Не под ипотеку, только наличный расчет"}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                  />
                </div>
              </div>

              {/* RU Language Card */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    🇷🇺 Русский язык
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {locale === "uz" ? "Rusiyzabon foydalanuvchilar uchun" : "Для русскоязычных пользователей"}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      {locale === "uz" ? "Sarlavha (RU)" : "Заголовок (RU)"}
                    </label>
                    {translatingField === "title_uz_ru" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Перевод...</span>}
                  </div>
                  <input
                    type="text"
                    value={titleRu}
                    onChange={(e) => {
                      setTitleRu(e.target.value);
                      setTitleRuManual(true);
                    }}
                    onBlur={() => handleFieldBlur("title", "ru")}
                    placeholder={locale === "uz" ? "Masalan: Shinam 3 xonali kvartira, 6-mavze" : "Например: Уютная 3-комнатная квартира, 6-й микрорайон"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      {locale === "uz" ? "Obyekt tavsifi (RU)" : "Описание объекта (RU)"}
                    </label>
                    {translatingField === "desc_uz_ru" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Перевод...</span>}
                  </div>
                  <textarea
                    rows={4}
                    value={descRu}
                    onChange={(e) => {
                      setDescRu(e.target.value);
                      setDescRuManual(true);
                    }}
                    onBlur={() => handleFieldBlur("desc", "ru")}
                    placeholder={locale === "uz" ? "Kvartira yoki uy haqida to‘liq ma’lumot..." : "Полная информация о квартире или доме..."}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      {locale === "uz" ? "Qo‘shimcha eslatma (RU)" : "Дополнительная заметка (RU)"}
                    </label>
                    {translatingField === "note_uz_ru" && <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Перевод...</span>}
                  </div>
                  <input
                    type="text"
                    value={noteRu}
                    onChange={(e) => {
                      setNoteRu(e.target.value);
                      setNoteRuManual(true);
                    }}
                    onBlur={() => handleFieldBlur("note", "ru")}
                    placeholder={locale === "uz" ? "Masalan: Ipotekaga berilmaydi, faqat naqd pulga" : "Например: Не под ипотеку, только наличный расчет"}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Xarita, Joylashuv & Poligon */}
        {activeStep === 3 && (
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              {locale === "uz" ? "3. Joylashuv va xarita (Koordinatalar & Poligon)" : "3. Расположение и карта (Координаты и полигон)"}
            </h2>

            {/* 3.1 Manzil (Required) */}
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                {locale === "uz" ? "Aniq manzil (Ko‘cha va uy) *" : "Точный адрес (Улица и дом) *"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={addressUz}
                  onChange={(e) => setAddressUz(e.target.value)}
                  placeholder={locale === "uz" ? "Mustaqillik shoh ko‘chasi, 12-uy" : "ул. Мустакиллик, д. 12"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                />
                <input
                  type="text"
                  value={addressRu}
                  onChange={(e) => setAddressRu(e.target.value)}
                  placeholder={locale === "uz" ? "Mustaqillik shoh ko‘chasi, 12-uy (RU)" : "ул. Мустакиллик, д. 12"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#16543C] outline-none"
                />
              </div>
            </div>

            {/* 3.2 Hudud (Mavjud hududlar va yangi hudud chizish) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "Hudud (Rayon / Mavze) *" : "Район (Массив / Локация) *"}
                </label>
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

              {/* Mavjud hududlar ro'yxati */}
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

            {/* Polygon JSON fallback */}
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
                <div className="space-y-1 sm:col-span-4">
                  {/* Qavatlar dinamik ko'rsatkichi (Badge) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 mb-3">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>
                </div>
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
                  {[amenities.ac, amenities.furniture, amenities.parking, renovation === "euro", amenities.elevator].filter(Boolean).length + customAdvantages.length} {locale === "uz" ? "ta" : "ед."}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* Konditsioner */}
                <button
                  type="button"
                  onClick={() => setAmenities((prev) => ({ ...prev, ac: !prev.ac }))}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    amenities.ac
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Wind className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Konditsioner" : "Кондиционер"}</span>
                  </div>
                  {amenities.ac ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>

                {/* Mebel */}
                <button
                  type="button"
                  onClick={() => setAmenities((prev) => ({ ...prev, furniture: !prev.furniture }))}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    amenities.furniture
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Home className="w-4 h-4 text-amber-800 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Mebel" : "Мебель"}</span>
                  </div>
                  {amenities.furniture ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                </button>

                {/* Avtoturargoh */}
                <button
                  type="button"
                  onClick={() => setAmenities((prev) => ({ ...prev, parking: !prev.parking }))}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    amenities.parking
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Car className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Avtoturargoh" : "Парковка"}</span>
                  </div>
                  {amenities.parking ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
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
                  onClick={() => setAmenities((prev) => ({ ...prev, elevator: !prev.elevator }))}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    amenities.elevator
                      ? "bg-emerald-50/80 border-[#16543C] text-[#16543C] font-bold shadow-2xs"
                      : "bg-slate-50/70 border-slate-200 text-slate-600 text-xs"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-xs truncate">{locale === "uz" ? "Lift" : "Лифт"}</span>
                  </div>
                  {amenities.elevator ? <CheckSquare className="w-4 h-4 text-[#16543C] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
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

        {/* STEP 5: Rasmlar va Media */}
        {activeStep === 5 && (
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              {locale === "uz" ? "5-bosqich: Fotosuratlar va Video" : "Этап 5: Фотографии и Видео"}
            </h2>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700">
                {locale === "uz" ? "Obyekt suratlari" : "Фотографии объекта"}
              </label>
              <PropertyImageUploader
                images={imageUrls}
                mainImage={mainImage}
                onChangeImages={setImageUrls}
                onChangeMainImage={setMainImage}
                propertyId={propertyId}
              />
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-slate-700">
                {locale === "uz" ? "Video sharh havolasi (YouTube / Vimeo / MP4)" : "Ссылка на видеообзор (YouTube / Vimeo / MP4)"}
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>
        )}

        {/* STEP 6: Kontakt & Rieltor */}
        {activeStep === 6 && (
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              {locale === "uz" ? "6-bosqich: Aloqa va Mas’ul Rieltor" : "Этап 6: Контакты и Ответственный Риелтор"}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {locale === "uz" ? "E’londagi ommaviy telefon" : "Публичный телефон для связи"}
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {locale === "uz" ? "Telegram foydalanuvchi nomi" : "Имя пользователя в Telegram"}
                </label>
                <input
                  type="text"
                  value={contactTelegram}
                  onChange={(e) => setContactTelegram(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {locale === "uz" ? "Mas’ul rieltorni biriktirish" : "Назначить ответственного риелтора"}
              </label>
              <select
                value={selectedRealtorId}
                onChange={(e) => {
                  const rId = e.target.value;
                  setSelectedRealtorId(rId);
                  const found = realtors.find((r) => r.id === rId);
                  if (found && found.phone) setContactPhone(found.phone);
                  if (found && found.telegram) setContactTelegram(found.telegram);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
              >
                <option value="">
                  {locale === "uz"
                    ? "(Rieltorsiz — Angren Estate ma’muriyati)"
                    : "(Без риелтора — Администрация Angren Estate)"}
                </option>
                {realtors.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phone}) {r.instagram_url || r.instagram ? "• Instagram bor" : ""} — {locale === "uz" ? r.specialization_uz : r.specialization_ru}
                  </option>
                ))}
              </select>
            </div>

            {/* Owner Direct Phone (Dedicated Field, Optional & Confidential) */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>{locale === "uz" ? "Mulk egasining telefoni (Maxfiy)" : "Телефон владельца (Конфиденциально)"}</span>
                <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                  {locale === "uz" ? "Faqat Admin • Maxfiy" : "Только Админ • Скрыто"}
                </span>
              </label>
              <input
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder={locale === "uz" ? "+998 90 123 45 67 (Ixtiyoriy)" : "+998 90 123 45 67 (Необязательно)"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 text-xs font-bold bg-amber-50/20 text-amber-950 focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <p className="text-[11px] text-amber-800 font-medium">
                {locale === "uz"
                  ? "Mulk egasining raqami mijozlarga ko‘rsatilmaydi. Saytda faqat biriktirilgan rieltor kontaktlari ko‘rinadi."
                  : "Номер владельца не показывается клиентам. На сайте отображаются только контакты риелтора."}
              </p>
            </div>
          </div>
        )}

        {/* Navigation Step Buttons */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
          <button
            type="button"
            disabled={activeStep === 1}
            onClick={() => setActiveStep(activeStep - 1)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs disabled:opacity-40 transition-colors"
          >
            {locale === "uz" ? "Orqaga" : "Назад"}
          </button>

          <div className="flex items-center gap-2">
            {activeStep < totalSteps ? (
              <button
                type="button"
                onClick={() => setActiveStep(activeStep + 1)}
                className="px-5 py-2 rounded-xl bg-[#16543C] text-white font-bold text-xs hover:bg-[#0E3324] transition-colors flex items-center gap-1.5"
              >
                <span>{locale === "uz" ? "Keyingisi" : "Далее"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleUpdate("published")}
                className="px-5 py-2 rounded-xl bg-[#16543C] text-white font-bold text-xs hover:bg-[#0E3324] transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{locale === "uz" ? "O‘zgarishlarni saqlash va nashr qilish" : "Сохранить изменения и опубликовать"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Admin Management / Safe Archive Zone */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {locale === "uz" ? "Obyekt holati va arxivlash" : "Статус объекта и управление"}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    currentStatus === "published"
                      ? "bg-emerald-100 text-emerald-800"
                      : currentStatus === "archived"
                      ? "bg-slate-200 text-slate-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {currentStatus === "published"
                    ? (locale === "uz" ? "Faol (Nashr qilingan)" : "Опубликовано")
                    : currentStatus === "archived"
                    ? (locale === "uz" ? "Arxivlangan" : "В архиве")
                    : (locale === "uz" ? "Qoralama" : "Черновик")}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {currentStatus === "archived"
                  ? (locale === "uz"
                      ? "Bu obyekt arxivda. Ommaviy saytda ko‘rinmaydi. Istalgan vaqtda qayta nashr qilishingiz mumkin."
                      : "Этот объект находится в архиве и скрыт с сайта. Вы можете восстановить его в любое время.")
                  : (locale === "uz"
                      ? "Obyektni arxivga o‘tkazsangiz, u ommaviy saytdan olib tashlanadi, lekin bazada saqlanadi."
                      : "При архивации объект скрывается из публичного доступа, но сохраняется в базе.")}
              </p>
            </div>

            <div className="shrink-0">
              {currentStatus === "archived" ? (
                <button
                  type="button"
                  disabled={isArchiving}
                  onClick={async () => {
                    setIsArchiving(true);
                    try {
                      const ok = await updatePropertyStatus(propertyId, "published");
                      if (ok) {
                        setCurrentStatus("published");
                      }
                    } finally {
                      setIsArchiving(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>
                    {isArchiving
                      ? (locale === "uz" ? "Tiklanmoqda..." : "Восстановление...")
                      : (locale === "uz" ? "Arxivdan chiqarish (Qayta nashr)" : "Восстановить из архива")}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setArchiveModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Archive className="h-3.5 w-3.5 text-amber-700" />
                  <span>{locale === "uz" ? "Arxivga o‘tkazish" : "В архив"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safe Archive Confirmation Modal */}
      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Archive className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {locale === "uz" ? "Obyektni arxivga o‘tkazish" : "Архивировать объект"}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">
                  ID: {propertyId}
                </p>
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-amber-900 line-clamp-1">
                {titleUz || titleRu || "Angren ko‘chmas mulk obyekti"}
              </p>
              <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
                {locale === "uz"
                  ? "Ushbu obyekt arxivlanadi va ommaviy sayt (xarita, katalog, qidiruv)dan darhol yashiriladi. Barcha parametrlar, fotosuratlar va statistika bazada saqlanadi. Istalgan vaqtda uni yana qayta nashr qilishingiz mumkin."
                  : "Объект будет перемещен в архив и скрыт из публичного доступа (карты, каталога, поиска). Все данные, фотографии и статистика сохранятся в базе. Вы сможете в любой момент восстановить его."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => setArchiveModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                {locale === "uz" ? "Bekor qilish" : "Отмена"}
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={async () => {
                  setIsArchiving(true);
                  try {
                    const ok = await updatePropertyStatus(propertyId, "archived");
                    if (ok) {
                      setCurrentStatus("archived");
                      setArchiveModalOpen(false);
                    }
                  } finally {
                    setIsArchiving(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>
                  {isArchiving
                    ? locale === "uz" ? "Arxivlanmoqda..." : "Архивация..."
                    : locale === "uz" ? "Ha, arxivlash" : "Да, в архив"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Drawing New Hudud Polygon or Editing existing */}
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
