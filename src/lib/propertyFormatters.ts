import { PropertyType, TransactionType, PropertyStatus, Locale } from "./types";

/**
 * Centralized Localized Formatters for ANGREN ESTATE
 * Single Source of Truth for:
 * - Property Types
 * - Deal / Transaction Types
 * - Property Statuses
 * - Badges
 * - Units & Metrics (area, rooms, floor, views, dates)
 */

export function getPropertyTypeLabel(
  type: PropertyType | string | undefined | null,
  locale: Locale = "uz"
): string {
  const norm = (type || "").toLowerCase().trim();

  if (locale === "ru") {
    switch (norm) {
      case "apartment":
      case "kvartira":
        return "Квартира";
      case "house_yard":
      case "house":
      case "hovli":
      case "cottage":
        return "Дом";
      case "new_build":
      case "new_building":
      case "yangi_qurilish":
      case "novostroyka":
        return "Новостройка";
      case "land":
      case "yer":
      case "uchastka":
        return "Земельный участок";
      case "commercial":
      case "commercial_property":
      case "tijorat":
        return "Коммерческий объект";
      case "other":
      case "noturar":
      case "non_residential":
        return "Нежилой объект";
      default:
        return "Другое";
    }
  }

  // UZ (Latin)
  switch (norm) {
    case "apartment":
    case "kvartira":
      return "Kvartira";
    case "house_yard":
    case "house":
    case "hovli":
    case "cottage":
      return "Hovli uy";
    case "new_build":
    case "new_building":
    case "yangi_qurilish":
    case "novostroyka":
      return "Yangi bino";
    case "land":
    case "yer":
    case "uchastka":
      return "Bo‘sh yer uchastkasi";
    case "commercial":
    case "commercial_property":
    case "tijorat":
      return "Tijorat obyekti";
    case "other":
    case "noturar":
    case "non_residential":
      return "Noturar obyekt";
    default:
      return "Boshqa";
  }
}

export function getDealTypeLabel(
  type: TransactionType | string | undefined | null,
  locale: Locale = "uz"
): string {
  const norm = (type || "").toLowerCase().trim();
  if (norm === "rent" || norm === "ijara") {
    return locale === "ru" ? "Аренда" : "Ijara";
  }
  return locale === "ru" ? "Продажа" : "Sotuv";
}

export function getPropertyStatusLabel(
  status: PropertyStatus | string | undefined | null,
  locale: Locale = "uz"
): string {
  const norm = (status || "").toLowerCase().trim();

  if (locale === "ru") {
    switch (norm) {
      case "published":
      case "active":
        return "Опубликовано";
      case "draft":
        return "Черновик";
      case "sold":
        return "Продано";
      case "rented":
        return "Сдано";
      case "archived":
        return "В архиве";
      default:
        return "Черновик";
    }
  }

  // UZ (Latin)
  switch (norm) {
    case "published":
    case "active":
      return "Nashr qilingan";
    case "draft":
      return "Qoralama";
    case "sold":
      return "Sotildi";
    case "rented":
      return "Ijaraga berilgan";
    case "archived":
      return "Arxivda";
    default:
      return "Qoralama";
  }
}

export function getBadgeLabel(
  badge: string | undefined | null,
  locale: Locale = "uz"
): string {
  const norm = (badge || "").toLowerCase().trim();

  if (locale === "ru") {
    switch (norm) {
      case "top":
        return "TOP";
      case "arzon":
      case "cheap":
      case "nedorogo":
        return "Недорого";
      case "tez_sotiladi":
      case "fast_sale":
      case "urgent":
        return "Срочно продать";
      case "hamyonbop":
      case "good_deal":
      case "yaxshi_taklif":
        return "Выгодная цена";
      case "narxi_tushirildi":
      case "price_dropped":
        return "Цена снижена";
      case "new":
      case "yangi":
        return "Новинка";
      default:
        return norm.toUpperCase();
    }
  }

  // UZ (Latin)
  switch (norm) {
    case "top":
      return "TOP";
    case "arzon":
    case "cheap":
    case "nedorogo":
      return "Arzon";
    case "tez_sotiladi":
    case "fast_sale":
    case "urgent":
      return "Tezda sotilishi kerak";
    case "hamyonbop":
    case "good_deal":
    case "yaxshi_taklif":
      return "Hamyonbop";
    case "narxi_tushirildi":
    case "price_dropped":
      return "Narxi tushirildi";
    case "new":
    case "yangi":
      return "Yangi";
    default:
      return norm.toUpperCase();
  }
}

/**
 * Check whether a property qualifies for the automatic "New" ("Yangi" / "Новинка") badge.
 * Rule: Active for 3 days from published_at (or created_at).
 * Not displayed in draft, sold, or rented status.
 */
export function isPropertyNew(property?: {
  status?: string | null;
  published_at?: string | null;
  created_at?: string | null;
}): boolean {
  if (!property || property.status !== "published") return false;
  const pubDateStr = property.published_at || property.created_at;
  if (!pubDateStr) return false;
  const pubTime = new Date(pubDateStr).getTime();
  if (isNaN(pubTime)) return false;
  const now = Date.now();
  const diffDays = (now - pubTime) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 3;
}

export function formatArea(
  sqm?: number | null,
  sotikh?: number | null,
  locale: Locale = "uz"
): string {
  const parts: string[] = [];
  if (sqm && sqm > 0) {
    parts.push(`${sqm} ${locale === "ru" ? "м²" : "m²"}`);
  }
  if (sotikh && sotikh > 0) {
    parts.push(`${sotikh} ${locale === "ru" ? "соток" : "sotix"}`);
  }
  return parts.join(" / ") || (locale === "ru" ? "0 м²" : "0 m²");
}

export function formatRooms(
  rooms?: number | null,
  locale: Locale = "uz"
): string {
  if (!rooms) return "";
  if (locale === "ru") {
    return `${rooms}-комн.`;
  }
  return `${rooms} xona`;
}

export function formatFloor(
  floor?: number | null,
  totalFloors?: number | null,
  locale: Locale = "uz"
): string {
  if (!floor) return "";
  if (locale === "ru") {
    return totalFloors ? `${floor}/${totalFloors} этаж` : `${floor} этаж`;
  }
  return totalFloors ? `${floor}/${totalFloors} qavat` : `${floor}-qavat`;
}

export function formatViews(
  views: number,
  locale: Locale = "uz"
): string {
  const count = views || 0;
  if (locale === "ru") {
    return `${count.toLocaleString("ru-RU")} просмотров`;
  }
  return `${count.toLocaleString("uz-UZ")} ta ko‘rish`;
}

export function formatDaysOnMarket(
  days: number,
  locale: Locale = "uz"
): string {
  const count = days || 0;
  if (locale === "ru") {
    return `${count} дней`;
  }
  return `${count} kun`;
}

export function getPropertyTitle(
  property: { title_uz?: string; title_ru?: string },
  locale: Locale = "uz"
): string {
  if (locale === "ru") {
    return property.title_ru?.trim() || property.title_uz?.trim() || "Объект недвижимости в Ангрене";
  }
  return property.title_uz?.trim() || property.title_ru?.trim() || "Angrenda ko‘chmas mulk";
}

export function getPropertyDescription(
  property: { description_uz?: string; description_ru?: string },
  locale: Locale = "uz"
): string {
  if (locale === "ru") {
    return property.description_ru?.trim() || property.description_uz?.trim() || "";
  }
  return property.description_uz?.trim() || property.description_ru?.trim() || "";
}

export function getPropertyNote(
  property?: {
    note_uz?: string | null;
    note_ru?: string | null;
    additional_note_uz?: string | null;
    additional_note_ru?: string | null;
    amenities?: any;
  } | null,
  locale: Locale = "uz"
): string {
  if (!property) return "";
  if (locale === "ru") {
    return (
      property.note_ru?.trim() ||
      property.additional_note_ru?.trim() ||
      (property.amenities as any)?.customNoteRu?.trim() ||
      property.note_uz?.trim() ||
      property.additional_note_uz?.trim() ||
      (property.amenities as any)?.customNote?.trim() ||
      ""
    );
  }
  return (
    property.note_uz?.trim() ||
    property.additional_note_uz?.trim() ||
    (property.amenities as any)?.customNoteUz?.trim() ||
    property.note_ru?.trim() ||
    property.additional_note_ru?.trim() ||
    (property.amenities as any)?.customNote?.trim() ||
    ""
  );
}

export function getPropertyAddress(
  property: { address_uz?: string; address_ru?: string; district_name_uz?: string; district_name_ru?: string },
  locale: Locale = "uz"
): string {
  if (locale === "ru") {
    const d = property.district_name_ru?.trim() || property.district_name_uz?.trim();
    const a = property.address_ru?.trim() || property.address_uz?.trim();
    if (d && a && !a.includes(d)) return `${d}, ${a}`;
    return a || d || "г. Ангрен";
  }
  const d = property.district_name_uz?.trim() || property.district_name_ru?.trim();
  const a = property.address_uz?.trim() || property.address_ru?.trim();
  if (d && a && !a.includes(d)) return `${d}, ${a}`;
  return a || d || "Angren shahri";
}

export function getPropertyDistrict(
  property: { district_name_uz?: string; district_name_ru?: string },
  locale: Locale = "uz"
): string {
  if (locale === "ru") {
    return property.district_name_ru?.trim() || property.district_name_uz?.trim() || "г. Ангрен";
  }
  return property.district_name_uz?.trim() || property.district_name_ru?.trim() || "Angren shahri";
}

export function getRenovationLabel(
  renovation?: string | null,
  locale: Locale = "uz"
): string {
  const norm = (renovation || "").toLowerCase().trim();
  if (locale === "ru") {
    switch (norm) {
      case "designer":
        return "Дизайнерский ремонт";
      case "euro":
        return "Евроремонт";
      case "cosmetic":
        return "Косметический ремонт";
      case "repair_required":
      case "needs_repair":
        return "Требует ремонта";
      case "rough":
        return "Черновая отделка";
      case "none":
      case "without":
      case "without_renovation":
        return "Без ремонта";
      default:
        return norm ? "Ремонт" : "Без ремонта";
    }
  }

  // UZ
  switch (norm) {
    case "designer":
      return "Dizaynerlik ta’miri";
    case "euro":
      return "Yevro ta’mirlangan";
    case "cosmetic":
      return "Kosmetik ta’mir";
    case "repair_required":
    case "needs_repair":
      return "Ta’mir talab";
    case "rough":
      return "Qora suvoq";
    case "none":
    case "without":
    case "without_renovation":
      return "Ta’mirsiz";
    default:
      return norm ? "Ta’mirlangan" : "Ta’mirsiz";
  }
}

