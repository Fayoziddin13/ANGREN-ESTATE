"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CMSContent,
  CMSFullPayload,
  CMSHeroSection,
  CMSAboutSection,
  CMSContactsSection,
  CMSAnnouncementSection,
  CMSSEOSection,
  CMSSiteSettingsSection,
} from "./types";

export const defaultCMSContent: CMSContent = {
  hero_title_uz: "Angrendagi ko‘chmas mulk — bir xaritada",
  hero_title_ru: "Недвижимость Ангрена — на одной карте",
  hero_subtitle_uz: "Kvartiralar, hovlilar va tijorat binolarini shahar xaritasida qulay toping",
  hero_subtitle_ru: "Удобный поиск квартир, домов и коммерческой недвижимости на карте города",
  about_headline_uz: "Angren ko‘chmas mulk bozorining yangi standarti",
  about_headline_ru: "Новый стандарт рынка недвижимости Ангрена",
  about_p1_uz: "ANGREN ESTATE — Angren shahridagi ko‘chmas mulkni topish, sotish va ijaraga berishni qulay, tushunarli va ishonchli qilish uchun yaratilgan zamonaviy platforma.",
  about_p1_ru: "ANGREN ESTATE — современная платформа, созданная для того, чтобы сделать поиск, продажу и аренду недвижимости в Ангрене удобным, понятным и надежным.",
  about_p2_uz: "Platformada asosan tajribali va mahalliy ko‘chmas mulk bozorini yaxshi biladigan rieltorlar hamda mutaxassislar tomonidan taqdim etilgan dolzarb obyektlar joylashtiriladi.",
  about_p2_ru: "На платформе размещаются актуальные объекты от проверенных специалистов, досконально знающих локальный рынок Ангрена.",
  about_mission_uz: "Bizning vazifamiz — Angren shahrida ko‘chmas mulk izlashni maksimal darajada aniq, qulay va shaffof qilishdir.",
  about_mission_ru: "Наша миссия — сделать поиск недвижимости в городе Ангрен максимально точным, комфортным и прозрачным.",
  announcement_active: false,
  announcement_uz: "ANGREN ESTATE platformasida yangi tumanlar va mavzelar xaritasi qo‘shildi!",
  announcement_ru: "На платформе ANGREN ESTATE добавлена карта новых районов и массивов!",
  announcement_type: "info",
};

export const defaultFullPayload: CMSFullPayload = {
  hero: {
    badge_uz: "ANGREN KO‘CHMAS MULKI",
    badge_ru: "НЕДВИЖИМОСТЬ АНГРЕНА",
    title_uz: "Angrendagi ko‘chmas mulk — bir xaritada",
    title_ru: "Недвижимость Ангрена — на одной карте",
    subtitle_uz: "Kvartiralar, hovlilar va tijorat binolarini shahar xaritasida qulay toping",
    subtitle_ru: "Удобный поиск квартир, домов и коммерческой недвижимости на карте города",
  },
  about: {
    badge_uz: "Angren ko‘chmas mulk bozorining rasmiy axborot maydoni",
    badge_ru: "Официальная информационная площадка рынка недвижимости Ангрена",
    headline_uz: "Angren ko‘chmas mulk bozorining yangi standarti",
    headline_ru: "Новый стандарт рынка недвижимости Ангрена",
    intro_p1_uz: "ANGREN ESTATE — Angren shahridagi ko‘chmas mulkni topish, sotish va ijaraga berishni qulay, tushunarli va ishonchli qilish uchun yaratilgan zamonaviy platforma.",
    intro_p1_ru: "ANGREN ESTATE — современная платформа, созданная для того, чтобы сделать поиск, продажу и аренду недвижимости в Ангрене удобным, понятным и надежным.",
    intro_p2_uz: "Platformada asosan tajribali va mahalliy ko‘chmas mulk bozorini yaxshi biladigan rieltorlar hamda mutaxassislar tomonidan taqdim etilgan dolzarb obyektlar joylashtiriladi.",
    intro_p2_ru: "На платформе размещаются актуальные объекты от проверенных специалистов, досконально знающих локальный рынок Ангрена.",
    intro_p3_uz: "Bizning vazifamiz — Angren shahrida ko‘chmas mulk izlashni maksimal darajada aniq, qulay va shaffof qilishdir.",
    intro_p3_ru: "Наша миссия — сделать поиск недвижимости в городе Ангрен максимально точным, комфортным и прозрачным.",
    mission_uz: "Angren shahrida ko‘chmas mulk bozorini shaffof, qulay va xavfsiz qilish.",
    mission_ru: "Сделать рынок недвижимости города Ангрен прозрачным, удобным и безопасным.",
    advantages: [
      {
        id: "adv_1",
        title_uz: "Zamonaviy qulaylik",
        title_ru: "Современный комфорт",
        desc_uz: "Shahar xaritasida barcha e'lonlarni tezkor ko‘rish va solishtirish imkoniyati.",
        desc_ru: "Быстрый просмотр и сравнение всех объявлений на интерактивной карте города.",
      },
      {
        id: "adv_2",
        title_uz: "Rasmiy va ishonchli",
        title_ru: "Официально и надежно",
        desc_uz: "Faqat tekshirilgan va haqiqiy ko‘chmas mulk ma'lumotlari.",
        desc_ru: "Только проверенные и реальные объекты недвижимости.",
      },
      {
        id: "adv_3",
        title_uz: "Shahar bo‘yicha to‘liq qamrov",
        title_ru: "Полный охват города",
        desc_uz: "Angrenning barcha mavzelari va hududlari bo‘yicha qulay filtrlash.",
        desc_ru: "Удобная фильтрация по всем массивам и районам Ангрена.",
      },
      {
        id: "adv_4",
        title_uz: "Aniq geolokatsiya",
        title_ru: "Точная geolokatsiya",
        desc_uz: "Har bir xonadon va bino Angren xaritasida aniq koordinatalari bilan ko‘rsatilgan.",
        desc_ru: "Каждая квартира и дом отмечены на карте Ангрена с точными координатами.",
      },
      {
        id: "adv_5",
        title_uz: "Tezkor aloqa",
        title_ru: "Быстрая связь",
        desc_uz: "Telefon va Telegram orqali mas'ul mutaxassislar bilan bir zumda bog‘lanish.",
        desc_ru: "Мгновенная связь со специалистами по телефону и Telegram.",
      },
    ],
  },
  contacts: {
    company_name: "ANGREN ESTATE",
    office_title_uz: "Angren Estate Bosh Ofis",
    office_title_ru: "Главный офис Angren Estate",
    phone: "+998 70 665 00 11",
    phone_secondary: "+998 90 123 45 67",
    telegram: "@angrenestate_admin",
    telegram_url: "https://t.me/angrenestate_admin",
    email: "info@angrenestate.uz",
    instagram: "@angrenestate.uz",
    instagram_url: "https://instagram.com/angrenestate.uz",
    address_uz: "Angren sh., Mustaqillik ko‘chasi, 14-uy",
    address_ru: "г. Ангрен, ул. Мустакиллик, д. 14",
    working_hours_uz: "Dush - Shan: 09:00 - 18:00",
    working_hours_ru: "Пн - Сб: 09:00 - 18:00",
    map_coordinates: {
      lat: 41.0167,
      lng: 70.1436,
    },
    is_configured: true,
  },
  announcement: {
    is_active: false,
    type: "info",
    text_uz: "ANGREN ESTATE platformasida yangi tumanlar va mavzelar xaritasi qo‘shildi!",
    text_ru: "На платформе ANGREN ESTATE добавлена карта новых районов и массивов!",
    link_url: "/sotib-olish",
    link_text_uz: "Batafsil",
    link_text_ru: "Подробнее",
  },
  seo: {
    site_title_uz: "ANGREN ESTATE — Angren ko‘chmas mulki yagona xaritada",
    site_title_ru: "ANGREN ESTATE — Недвижимость Ангрена на единой карте",
    meta_description_uz: "Angren shahrining eng yaxshi kvartira, hovli va tijorat binolari. Sotuv va ijara.",
    meta_description_ru: "Лучшие квартиры, дома и коммерческая недвижимость в Ангрене. Продажа и аренда.",
    keywords_uz: "angren ko‘chmas mulk, kvartira, hovli, ijara, sotuv, angren estate",
    keywords_ru: "недвижимость ангрен, квартиры, дома, аренда, продажа, ангрен эстейт",
    og_image: "/logo.png",
  },
  settings: {
    site_name: "ANGREN ESTATE",
    logo_url: "/logo.png",
    favicon_url: "/logo.png",
    default_city: "Angren",
    default_currency: "UZS",
    default_language: "uz",
    map_center_lat: 41.0167,
    map_center_lng: 70.1436,
    map_default_zoom: 13,
    map_default_style: "standard",
  },
};

// Pure backward-compatible stubs (zero localStorage in production)
export function getStoredCMS(): CMSContent {
  return defaultCMSContent;
}

export function setStoredCMS(_content: CMSContent): void {
  // Purge legacy storage key if present in browser
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("angren_estate_cms_v1");
    } catch {}
  }
}

/**
 * Modern Hook for Canonical Supabase CMS Content
 */
export function useCMS() {
  const [fullPayload, setFullPayload] = useState<CMSFullPayload>(defaultFullPayload);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Purge obsolete legacy localStorage key if present
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("angren_estate_cms_v1");
        } catch {}
      }

      const res = await fetch("/api/content", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.content) {
        setFullPayload(data.content);
      }
    } catch (err: any) {
      console.warn("[useCMS] Failed to fetch content, using canonical fallbacks:", err);
      setError(err.message || "Failed to fetch content");
    } finally {
      setIsLoaded(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Derive legacy CMSContent for backwards compatibility
  const legacyContent: CMSContent = {
    hero_title_uz: fullPayload.hero.title_uz,
    hero_title_ru: fullPayload.hero.title_ru,
    hero_subtitle_uz: fullPayload.hero.subtitle_uz,
    hero_subtitle_ru: fullPayload.hero.subtitle_ru,
    about_headline_uz: fullPayload.about.headline_uz,
    about_headline_ru: fullPayload.about.headline_ru,
    about_p1_uz: fullPayload.about.intro_p1_uz,
    about_p1_ru: fullPayload.about.intro_p1_ru,
    about_p2_uz: fullPayload.about.intro_p2_uz,
    about_p2_ru: fullPayload.about.intro_p2_ru,
    about_mission_uz: fullPayload.about.mission_uz,
    about_mission_ru: fullPayload.about.mission_ru,
    announcement_active: fullPayload.announcement.is_active,
    announcement_uz: fullPayload.announcement.text_uz,
    announcement_ru: fullPayload.announcement.text_ru,
    announcement_type: fullPayload.announcement.type,
  };

  const updateContent = async (updates: Partial<CMSContent>) => {
    // If in admin mode, trigger refresh after mutation
    await fetchContent();
  };

  const resetContent = () => {
    // No-op stub for backward compatibility
  };

  return {
    content: legacyContent,
    fullPayload,
    hero: fullPayload.hero,
    about: fullPayload.about,
    contacts: fullPayload.contacts,
    announcement: fullPayload.announcement,
    seo: fullPayload.seo,
    settings: fullPayload.settings,
    isLoaded,
    isLoading,
    error,
    refresh: fetchContent,
    updateContent,
    resetContent,
  };
}
