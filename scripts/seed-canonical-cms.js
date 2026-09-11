const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function getEnv() {
  const envFile = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  return Object.fromEntries(
    envFile
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
}

const env = getEnv();
const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const CANONICAL_SEEDS = {
  cms_hero: {
    badge_uz: "ANGREN KO‘CHMAS MULKI",
    badge_ru: "НЕДВИЖИМОСТЬ АНГРЕНА",
    title_uz: "Angrendagi ko‘chmas mulk — bir xaritada",
    title_ru: "Недвижимость Ангрена — на одной карте",
    subtitle_uz: "Kvartiralar, hovlilar va tijorat binolarini shahar xaritasida qulay toping",
    subtitle_ru: "Удобный поиск квартир, домов и коммерческой недвижимости на карте города",
  },
  cms_about: {
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
        title_ru: "Точная геолокация",
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
  cms_contacts: {
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
  cms_announcement: {
    is_active: false,
    type: "info",
    text_uz: "ANGREN ESTATE platformasida yangi tumanlar va mavzelar xaritasi qo‘shildi!",
    text_ru: "На платформе ANGREN ESTATE добавлена карта новых районов и массивов!",
    link_url: "/sotib-olish",
    link_text_uz: "Batafsil",
    link_text_ru: "Подробнее",
  },
  cms_seo: {
    site_title_uz: "ANGREN ESTATE — Angren ko‘chmas mulki yagona xaritada",
    site_title_ru: "ANGREN ESTATE — Недвижимость Ангрена на единой карте",
    meta_description_uz: "Angren shahrining eng yaxshi kvartira, hovli va tijorat binolari. Sotuv va ijara.",
    meta_description_ru: "Лучшие квартиры, дома и коммерческая недвижимость в Ангрене. Продажа и аренда.",
    keywords_uz: "angren ko‘chmas mulk, kvartira, hovli, ijara, sotuv, angren estate",
    keywords_ru: "недвижимость ангрен, квартиры, дома, аренда, продажа, ангрен эстейт",
    og_image: "/logo.png",
  },
  site_settings: {
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

async function seedCMS() {
  console.log("================================================================");
  console.log("ANGREN ESTATE — SEED CANONICAL CMS & SITE CONTENT");
  console.log("================================================================\n");

  const keys = Object.keys(CANONICAL_SEEDS);

  for (const key of keys) {
    // Check if key already exists
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("app_settings")
      .select("key, updated_at")
      .eq("key", key)
      .maybeSingle();

    if (fetchErr) {
      console.error(`Error querying key ${key}:`, fetchErr.message);
      continue;
    }

    if (existing) {
      console.log(`[PRESERVED] Key '${key}' already exists (updated_at: ${existing.updated_at}). Preserving.`);
    } else {
      const { error: insertErr } = await supabaseAdmin.from("app_settings").insert({
        key,
        value: CANONICAL_SEEDS[key],
        updated_at: new Date().toISOString(),
      });

      if (insertErr) {
        console.error(`[ERROR] Failed to seed '${key}':`, insertErr.message);
      } else {
        console.log(`[SEEDED] Key '${key}' inserted successfully.`);
      }
    }
  }

  // Verification: Query all keys back
  console.log("\n--- Verification: Checking Seeded Keys ---");
  const { data: allRows, error: verifyErr } = await supabaseAdmin
    .from("app_settings")
    .select("key, updated_at")
    .in("key", keys);

  if (verifyErr) {
    console.error("Verification query error:", verifyErr.message);
  } else {
    console.log(`Total canonical keys verified in Supabase: ${allRows.length} / ${keys.length}`);
    for (const r of allRows) {
      console.log(`  ✓ ${r.key} (${r.updated_at})`);
    }
  }

  // Public read check via anon client
  console.log("\n--- Verification: Anonymous Client Read Test ---");
  const { data: anonRows, error: anonErr } = await supabaseAnon
    .from("app_settings")
    .select("key, value")
    .in("key", keys);

  if (anonErr) {
    console.error("Anonymous client read error:", anonErr.message);
  } else {
    console.log(`Anonymous client successfully retrieved ${anonRows.length} CMS keys.`);
  }

  console.log("\n================================================================");
  console.log("SEEDING COMPLETED SUCCESSFULLY");
  console.log("================================================================");
}

seedCMS().catch(console.error);
