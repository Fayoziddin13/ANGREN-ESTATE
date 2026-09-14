import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { CMSFullPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const CANONICAL_FALLBACKS: CMSFullPayload = {
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

const WHITELISTED_KEYS = [
  "cms_hero",
  "cms_about",
  "cms_contacts",
  "cms_announcement",
  "cms_seo",
  "site_settings",
];

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("key, value, updated_at")
      .in("key", WHITELISTED_KEYS);

    if (error) {
      console.warn("[/api/content] Database read error, using canonical fallbacks:", error.message);
      return NextResponse.json(
        { success: true, content: CANONICAL_FALLBACKS, source: "fallback" },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const payload: CMSFullPayload = { ...CANONICAL_FALLBACKS };
    let latestUpdatedAt = "";

    if (Array.isArray(data)) {
      for (const row of data) {
        if (row.updated_at && row.updated_at > latestUpdatedAt) {
          latestUpdatedAt = row.updated_at;
        }

        if (row.key === "cms_hero" && row.value) {
          payload.hero = { ...payload.hero, ...row.value };
        } else if (row.key === "cms_about" && row.value) {
          payload.about = { ...payload.about, ...row.value };
        } else if (row.key === "cms_contacts" && row.value) {
          payload.contacts = { ...payload.contacts, ...row.value };
        } else if (row.key === "cms_announcement" && row.value) {
          payload.announcement = { ...payload.announcement, ...row.value };
        } else if (row.key === "cms_seo" && row.value) {
          payload.seo = { ...payload.seo, ...row.value };
        } else if (row.key === "site_settings" && row.value) {
          payload.settings = { ...payload.settings, ...row.value };
          if (row.value.admin_phone) {
            payload.contacts.phone = row.value.admin_phone;
          }
          if (row.value.admin_telegram) {
            payload.contacts.telegram = row.value.admin_telegram;
            payload.contacts.telegram_url = row.value.admin_telegram.startsWith("http")
              ? row.value.admin_telegram
              : `https://t.me/${row.value.admin_telegram.replace("@", "")}`;
          }
          if (row.value.admin_email) {
            payload.contacts.email = row.value.admin_email;
          }
          if (row.value.instagram) {
            payload.contacts.instagram = row.value.instagram;
            payload.contacts.instagram_url = row.value.instagram.startsWith("http")
              ? row.value.instagram
              : `https://instagram.com/${row.value.instagram.replace("@", "")}`;
          }
        }
      }
    }

    payload.updated_at = latestUpdatedAt;

    return NextResponse.json(
      { success: true, content: payload, source: "database" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: any) {
    console.error("[/api/content] Fatal error:", err);
    return NextResponse.json(
      { success: true, content: CANONICAL_FALLBACKS, source: "fallback_error" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}
