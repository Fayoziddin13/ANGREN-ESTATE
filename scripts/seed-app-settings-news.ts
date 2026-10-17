import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvLocal();

async function testAppSettingsStore() {
  const { getSupabaseAdmin } = await import("../src/lib/supabaseServer");
  const sb = getSupabaseAdmin();

  // Load current local news_store.json
  const localFile = path.resolve(process.cwd(), "data", "news_store.json");
  const localData = JSON.parse(fs.readFileSync(localFile, "utf-8"));

  // Remove the mock publications with fake message_id 991122
  localData.publications = localData.publications.filter(
    (p: any) => p.telegram_message_id !== 991122
  );

  // Set mock news to "ready" and ensure translations exist
  const mockNews = localData.news.find((n: any) => n.id === "news-7fe90a7adc59");
  if (mockNews) {
    mockNews.status = "ready";
  }

  // Ensure mock news has translations
  const hasUz = localData.translations.some((t: any) => t.news_id === "news-7fe90a7adc59" && t.language === "uz");
  if (!hasUz) {
    localData.translations.push({
      id: "trans-mock-uz",
      news_id: "news-7fe90a7adc59",
      language: "uz",
      title: "Ko‘chmas mulk sohasida yangi huquqiy tartib va talablar tasdiqlandi",
      summary: "O‘zbekiston Respublikasida ko‘chmas mulk obʼyektlarini davlat ro‘yxatidan o‘tkazish va kadastr hujjatlarini rasmiylashtirish bo‘yicha yangi reglament joriy etildi.",
      practical_takeaway: "Mulkdorlar va xaridorlar davlat ro‘yxatidan o‘tish va huquqiy kafolatlarni mustahkamlash tartibidan xabardor bo‘lishlari lozim.",
      is_reviewed_by_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const hasRu = localData.translations.some((t: any) => t.news_id === "news-7fe90a7adc59" && t.language === "ru");
  if (!hasRu) {
    localData.translations.push({
      id: "trans-mock-ru",
      news_id: "news-7fe90a7adc59",
      language: "ru",
      title: "Утверждены новые правила и требования в сфере недвижимости",
      summary: "В Республике Узбекистан введен обновленный регламент государственной регистрации прав на недвижимое имущество и кадастрового учета.",
      practical_takeaway: "Собственникам и покупателям важно знать обновленный порядок регистрации и правовые гарантии на имущество.",
      is_reviewed_by_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`Writing ${localData.news.length} news items, ${localData.sources.length} sources to app_settings...`);
  const { error } = await sb.from("app_settings").upsert({
    key: "news_store_registry",
    value: localData,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  if (error) {
    console.error("Failed to seed app_settings:", error.message);
  } else {
    console.log("Successfully seeded news_store_registry into Supabase app_settings!");
  }

  // Update local file too
  fs.writeFileSync(localFile, JSON.stringify(localData, null, 2), "utf-8");
  console.log("Updated local data/news_store.json.");
}

testAppSettingsStore().catch(console.error);
