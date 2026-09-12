"use client";

import React, { useState, useEffect } from "react";
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
  Archive,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProperties } from "@/lib/propertyStore";
import { useRealtors } from "@/lib/realtorStore";
import { PropertyImageUploader } from "@/components/admin/PropertyImageUploader";
import {
  PropertyType,
  TransactionType,
  RenovationType,
  PropertyStatus,
  Property,
} from "@/lib/types";

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

  // Contact
  const [selectedRealtorId, setSelectedRealtorId] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [contactPhone, setContactPhone] = useState("+998 90 123 45 67");
  const [contactTelegram, setContactTelegram] = useState("@angrenestate_admin");

  const [currentStatus, setCurrentStatus] = useState<PropertyStatus>("draft");
  const [notFound, setNotFound] = useState(false);

  // Load existing property data
  useEffect(() => {
    if (!propertyId || !isLoaded) return;
    const found = properties.find((p) => p.id === propertyId);
    if (!found) {
      setNotFound(true);
      return;
    }

    setTransactionType(found.transaction_type);
    setPropertyType(found.property_type);
    setTitleUz(found.title_uz || "");
    setTitleRu(found.title_ru || "");
    setDescUz(found.description_uz || "");
    setDescRu(found.description_ru || "");
    setPriceUzs(found.price_uzs || 0);
    setPriceUsd(found.price_usd || Math.round((found.price_uzs || 0) / 12850));
    setDistrict(found.district_name_uz || "Markaz");
    setAddressUz(found.address_uz || "");
    setAddressRu(found.address_ru || "");
    setLat(found.coordinates.lat);
    setLng(found.coordinates.lng);
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
    if (found.amenities) setAmenities(found.amenities);
    if (found.images && found.images.length > 0) {
      setImageUrls(found.images);
      setMainImage(found.main_image || found.images[0]);
    }
    if (found.video_url) setVideoUrl(found.video_url);
    if (found.contact_phone) setContactPhone(found.contact_phone);
    if (found.contact_telegram) setContactTelegram(found.contact_telegram);
    if (found.realtor_id) setSelectedRealtorId(found.realtor_id);
    setInitialDataLoaded(true);
  }, [propertyId, isLoaded, properties]);

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

    let parsedPolygon: [number, number][] | undefined = undefined;
    if (polygonPoints.length > 0) {
      parsedPolygon = polygonPoints;
    } else if (polygonCoords.trim()) {
      try {
        parsedPolygon = JSON.parse(polygonCoords);
      } catch {}
    }

    try {
      await updateProperty(propertyId, {
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
        owner_phone: ownerPhone || undefined,
        contact_phone: contactPhone,
        contact_telegram: contactTelegram,
        realtor_id: selectedRealtorId || undefined,
      });

      router.push("/admin/properties");
    } catch (e) {
      console.error("Error updating property:", e);
      setIsUpdating(false);
    }
  };

  if (notFound) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <h2 className="text-xl font-black text-slate-900">Obyekt topilmadi</h2>
        <p className="text-xs text-slate-500">Bunday ID ga ega obyekt mavjud emas yoki o‘chirilgan.</p>
        <Link href="/admin/properties" className="inline-block px-4 py-2 rounded-xl bg-[#16543C] text-white text-xs font-bold">
          Ro‘yxatga qaytish
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
                {currentStatus}
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
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
          >
            {locale === "uz" ? "Qoralama sifatida saqlash" : "Сохранить как черновик"}
          </button>
          <button
            type="button"
            onClick={() => handleUpdate("published")}
            className="px-4 py-2 rounded-xl bg-[#16543C] text-white hover:bg-[#0E3324] font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{locale === "uz" ? "Nashr qilish (Publish)" : "Опубликовать"}</span>
          </button>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold">
        {[
          { num: 1, label: "Asosiy" },
          { num: 2, label: "Sarlavha" },
          { num: 3, label: "Xarita & Manzil" },
          { num: 4, label: "Xususiyatlar" },
          { num: 5, label: "Rasmlar" },
          { num: 6, label: "Kontakt" },
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
            <div className="text-[10px] opacity-70">Bosqich {step.num}</div>
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
              1. Bitim va Obyekt turi
            </h2>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Bitim turi</label>
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
                  Sotuv (Sale)
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
                  Ijara (Rent)
                </button>
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Ko‘chmas mulk turi</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { key: "apartment", label: "Kvartira" },
                  { key: "house_yard", label: "Hovli / Kottej" },
                  { key: "new_build", label: "Yangi bino" },
                  { key: "commercial", label: "Tijorat" },
                  { key: "land", label: "Yer" },
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
                <label className="text-xs font-bold text-slate-700">Narx (USD $)</label>
                <input
                  type="number"
                  value={priceUsd}
                  onChange={(e) => {
                    const usd = Number(e.target.value);
                    setPriceUsd(usd);
                    setPriceUzs(usd * 12850);
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
                    setPriceUsd(Math.round(uzs / 12850));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-sm font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Sarlavha & Tavsif */}
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Sarlavha (Русский)</label>
              <input
                type="text"
                value={titleRu}
                onChange={(e) => setTitleRu(e.target.value)}
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Описание объекта (RU)</label>
                <textarea
                  rows={4}
                  value={descRu}
                  onChange={(e) => setDescRu(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#16543C] outline-none text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Xarita, Joylashuv & Poligon */}
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
                  <option value="5-mavze">5-mavze</option>
                  <option value="6-mavze">6-mavze</option>
                  <option value="7-mavze">7-mavze</option>
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

            {/* Polygon JSON fallback */}
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
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-700">Qulayliklar</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-bold">
                {[
                  { key: "furniture", label: "Mebel bilan" },
                  { key: "parking", label: "Avtoturargoh" },
                  { key: "elevator", label: "Lift" },
                  { key: "ac", label: "Konditsioner" },
                  { key: "balcony", label: "Balkon / Lodjiya" },
                  { key: "internet", label: "Tezkor Internet" },
                ].map((a) => (
                  <label
                    key={a.key}
                    className={`flex items-center gap-2 p-3 rounded-2xl border cursor-pointer transition-all ${
                      amenities[a.key as keyof typeof amenities]
                        ? "bg-emerald-50 border-emerald-500 text-[#16543C]"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={amenities[a.key as keyof typeof amenities]}
                      onChange={(e) =>
                        setAmenities({ ...amenities, [a.key]: e.target.checked })
                      }
                      className="rounded text-[#16543C] focus:ring-[#16543C]"
                    />
                    <span>{a.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Rasmlar va Media */}
        {activeStep === 5 && (
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 border-b pb-2">
              5. Fotosuratlar va Video
            </h2>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700">Obyekt suratlari</label>
              <PropertyImageUploader
                images={imageUrls}
                mainImage={mainImage}
                onChangeImages={setImageUrls}
                onChangeMainImage={setMainImage}
                propertyId={propertyId}
              />
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold text-slate-700">Video havola (YouTube / Vimeo)</label>
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
              6. Aloqa va Rieltor biriktirish
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Aloqa telefoni</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Telegram foydalanuvchi nomi</label>
                <input
                  type="text"
                  value={contactTelegram}
                  onChange={(e) => setContactTelegram(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Rieltor / Agent</label>
              <select
                value={selectedRealtorId}
                onChange={(e) => setSelectedRealtorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
              >
                <option value="">(Риелторсиз — Ангрен Эстейт маъмурияти)</option>
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
            Orqaga
          </button>

          <div className="flex items-center gap-2">
            {activeStep < totalSteps ? (
              <button
                type="button"
                onClick={() => setActiveStep(activeStep + 1)}
                className="px-5 py-2 rounded-xl bg-[#16543C] text-white font-bold text-xs hover:bg-[#0E3324] transition-colors flex items-center gap-1.5"
              >
                <span>Keyingisi</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleUpdate("published")}
                className="px-5 py-2 rounded-xl bg-[#16543C] text-white font-bold text-xs hover:bg-[#0E3324] transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>O‘zgarishlarni nashr qilish</span>
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
    </div>
  );
}
