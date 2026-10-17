/**
 * ANGREN ESTATE — Real Estate News Harvester & Content Intelligence Engine
 * Automatically fetches, categorizes, deduplicates, and curates news from verified sources.
 */

import {
  getNewsSources,
  hasNewsWithUrlHash,
  saveNewsItem,
  saveNewsTranslation,
  recordSourceCheck,
  updateSourceLastChecked,
  computeUrlHash,
} from "./newsStore";
import { cyrillicToUzbekLatin, translateContent } from "./translationService";
import type { NewsCategory, NewsSource, RealEstateNews } from "./types/news";

export interface ParsedFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid?: string;
  imageUrl?: string;
}

// -------------------------------------------------------------
// TEXT SANITIZATION & XML PARSING
// -------------------------------------------------------------

export function cleanHtmlText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&laquo;|&raquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Robust XML RSS/Atom feed parser.
 * Handles standard RSS 2.0 <item> and Atom <entry> elements without heavy external dependencies.
 */
export function parseRssXml(xml: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];

  // Match RSS 2.0 <item> blocks
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemBlock of itemMatches) {
    const titleMatch = itemBlock.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
    const linkMatch = itemBlock.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i);
    const descMatch =
      itemBlock.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i) ||
      itemBlock.match(/<content:encoded[\s\S]*?>([\s\S]*?)<\/content:encoded>/i);
    const pubDateMatch = itemBlock.match(/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i);
    const guidMatch = itemBlock.match(/<guid[\s\S]*?>([\s\S]*?)<\/guid>/i);
    const enclosureMatch = itemBlock.match(/<enclosure[\s\S]*?url=["'](.*?)["']/i);

    const title = cleanHtmlText(titleMatch ? titleMatch[1] : "");
    const rawLink = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").trim() : "";
    const description = cleanHtmlText(descMatch ? descMatch[1] : "");
    const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
    const guid = guidMatch ? cleanHtmlText(guidMatch[1]) : undefined;
    const imageUrl = enclosureMatch ? enclosureMatch[1].trim() : undefined;

    if (title && rawLink) {
      items.push({
        title,
        link: rawLink,
        description,
        pubDate: pubDateStr,
        guid,
        imageUrl,
      });
    }
  }

  // Also support Atom <entry> if no RSS items found
  if (items.length === 0) {
    const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (const entryBlock of entryMatches) {
      const titleMatch = entryBlock.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
      const linkMatch = entryBlock.match(/<link[\s\S]*?href=["'](.*?)["']/i);
      const descMatch =
        entryBlock.match(/<summary[\s\S]*?>([\s\S]*?)<\/summary>/i) ||
        entryBlock.match(/<content[\s\S]*?>([\s\S]*?)<\/content>/i);
      const pubDateMatch =
        entryBlock.match(/<updated[\s\S]*?>([\s\S]*?)<\/updated>/i) ||
        entryBlock.match(/<published[\s\S]*?>([\s\S]*?)<\/published>/i);

      const title = cleanHtmlText(titleMatch ? titleMatch[1] : "");
      const link = linkMatch ? linkMatch[1].trim() : "";
      const description = cleanHtmlText(descMatch ? descMatch[1] : "");
      const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();

      if (title && link) {
        items.push({
          title,
          link,
          description,
          pubDate: pubDateStr,
        });
      }
    }
  }

  return items;
}

// -------------------------------------------------------------
// REAL ESTATE RELEVANCE & CATEGORIZATION
// -------------------------------------------------------------

const REAL_ESTATE_KEYWORDS = [
  // Uzbek
  "ko‘chmas mulk", "kochmas mulk", "uy-joy", "uy joy", "xonadon", "turar joy",
  "yer uchastkasi", "kadastr", "ipoteka", "qurilish", "ijara", "developer",
  "shaharsozlik", "bino", "kvartira", "hovli", "dacha", "noturar joy", "mulk huquqi",
  "quruvchi", "renovatsiya", "eskrou", "soliq", "kommunal",
  // Russian
  "недвижимость", "жилье", "жильё", "квартира", "дом", "участок", "кадастр",
  "ипотека", "строительство", "аренда", "застройщик", "градостроительство",
  "новостройка", "новостройки", "право собственности", "вторичка", "реновация",
  "коммунальные услуги", "жк", "стройк"
];

export function isRealEstateRelated(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  return REAL_ESTATE_KEYWORDS.some((kw) => combined.includes(kw));
}

export function classifyNewsCategory(title: string, description: string): NewsCategory {
  const text = `${title} ${description}`.toLowerCase();

  // 1. Legislation & Cadastre
  if (
    text.includes("qonun") || text.includes("qaror") || text.includes("farmon") ||
    text.includes("nizom") || text.includes("kadastr") || text.includes("adliya") ||
    text.includes("mulk huquqi") || text.includes("закон") || text.includes("указ") ||
    text.includes("постановление") || text.includes("кадастр") || text.includes("регламент")
  ) {
    return "legislation_cadastre";
  }

  // 2. Mortgage & Finance
  if (
    text.includes("ipoteka") || text.includes("kredit") || text.includes("subsidiya") ||
    text.includes("markaziy bank") || text.includes("stavka") || text.includes("ипотека") ||
    text.includes("кредит") || text.includes("субсидия") || text.includes("ставка")
  ) {
    return "mortgage_finance";
  }

  // 3. Construction & Projects
  if (
    text.includes("qurilish") || text.includes("yangi loyiha") || text.includes("bino") ||
    text.includes("majmua") || text.includes("developer") || text.includes("строительств") ||
    text.includes("новостройк") || text.includes("жк") || text.includes("застройщик")
  ) {
    return "construction_projects";
  }

  // 4. Rental Market
  if (
    text.includes("ijara") || text.includes("arenda") || text.includes("ijarachi") ||
    text.includes("аренда") || text.includes("съем") || text.includes("арендатор")
  ) {
    return "rental_market";
  }

  // 5. Taxes & Fees
  if (
    text.includes("soliq") || text.includes("davlat boji") || text.includes("xarajat") ||
    text.includes("to‘lov") || text.includes("налог") || text.includes("пошлина") ||
    text.includes("сбор")
  ) {
    return "taxes_and_fees";
  }

  // 6. Useful Tips
  if (
    text.includes("maslahat") || text.includes("tavsiya") || text.includes("tartibi") ||
    text.includes("qanday qilib") || text.includes("совет") || text.includes("рекомендац") ||
    text.includes("как оформить")
  ) {
    return "useful_tips";
  }

  // Default to market prices
  return "market_prices";
}

export function extractVerifiedStat(text: string): string | undefined {
  // Matches e.g. "17.5%", "+3.2%", "$850", "7 kun", "15 kun"
  const percentMatch = text.match(/([+-]?\d+(?:[.,]\d+)?\s*%)/);
  if (percentMatch) return percentMatch[1].trim();

  const priceSqMatch = text.match(/(\$\s*\d+(?:[.,]\d+)?(?:\s*\/\s*m²)?)/i);
  if (priceSqMatch) return priceSqMatch[1].trim();

  const daysMatch = text.match(/(\d+\s*(?:ish\s*kuni[a-z]*|kun[a-z]*|дней|дня|дн[а-я]*|рабочих\s*дней))/i);
  if (daysMatch) return daysMatch[1].trim();

  return undefined;
}

// -------------------------------------------------------------
// BILINGUAL CONTENT PREPARATION
// -------------------------------------------------------------

export async function prepareBilingualNewsContent(
  item: ParsedFeedItem,
  category: NewsCategory,
  source: NewsSource
): Promise<{
  uz: { title: string; summary: string; takeaway: string };
  ru: { title: string; summary: string; takeaway: string };
  statValue?: string;
}> {
  const isRussianSource =
    source.domain.endsWith(".ru") ||
    item.link.includes("/ru/") ||
    /[а-яё]/i.test(item.title.slice(0, 30));

  let uzTitle = "";
  let uzSummary = "";
  let ruTitle = "";
  let ruSummary = "";

  if (isRussianSource) {
    ruTitle = item.title;
    ruSummary = item.description.slice(0, 360);

    // Translate RU to UZ
    const titleTrans = await translateContent(ruTitle, "ru", "uz");
    uzTitle = titleTrans.success && titleTrans.translatedText ? titleTrans.translatedText : cyrillicToUzbekLatin(ruTitle);

    const descTrans = await translateContent(ruSummary, "ru", "uz");
    uzSummary = descTrans.success && descTrans.translatedText ? descTrans.translatedText : cyrillicToUzbekLatin(ruSummary);
  } else {
    // Source is Uzbek (might be Cyrillic or Latin)
    uzTitle = cyrillicToUzbekLatin(item.title);
    uzSummary = cyrillicToUzbekLatin(item.description.slice(0, 360));

    // Translate UZ to RU
    const titleTrans = await translateContent(uzTitle, "uz", "ru");
    ruTitle = titleTrans.success && titleTrans.translatedText ? titleTrans.translatedText : uzTitle;

    const descTrans = await translateContent(uzSummary, "uz", "ru");
    ruSummary = descTrans.success && descTrans.translatedText ? descTrans.translatedText : uzSummary;
  }

  // Derive practical takeaway based on category
  const takeawayMap: Record<NewsCategory, { uz: string; ru: string }> = {
    legislation_cadastre: {
      uz: "Mulkdorlar va xaridorlar davlat ro‘yxatidan o‘tish va huquqiy kafolatlarni mustahkamlash tartibidan xabardor bo‘lishlari lozim.",
      ru: "Собственникам и покупателям важно знать обновленный порядок регистрации и правовые гарантии на имущество.",
    },
    mortgage_finance: {
      uz: "Ipoteka oluvchilar oylik to‘lovlar va davlat subsidiyalari imkoniyatlarini oldindan hisob-kitob qilishlari tavsiya etiladi.",
      ru: "Заёмщикам рекомендуется заранее рассчитывать ежемесячные платежи и возможности господдержки по ипотеке.",
    },
    market_prices: {
      uz: "Bozordagi narx tendensiyalarini tahlil qilish obyektni foydali xarid qilish yoki sotish vaqtini to‘g‘ri tanlashga yordam beradi.",
      ru: "Анализ ценовых трендов помогает выбрать наиболее выгодный момент для покупки или продажи недвижимости.",
    },
    construction_projects: {
      uz: "Yangi loyihalarda investitsiya qilishdan oldin quruvchining ruxsatnomalari va shaharsozlik standartlariga muvofiqligini tekshirish muhim.",
      ru: "Перед инвестициями в новостройки важно проверять разрешительную документацию и репутацию девелопера.",
    },
    rental_market: {
      uz: "Ijara munosabatlarini rasmiy shartnoma asosida rasmiylashtirish tomonlarning moliyaviy va mulkiy xavfsizligini ta’minlaydi.",
      ru: "Официальный договор аренды защищает финансовые и имущественные интересы обеих сторон сделки.",
    },
    taxes_and_fees: {
      uz: "Mulk oldi-sotdisi va egalik qilish bilan bog‘liq soliq imtiyozlari to‘g‘risida ma’lumotga ega bo‘lish ortiqcha xarajatlarning oldini oladi.",
      ru: "Знание налоговых льгот и ставок при сделках с недвижимостью предотвращает лишние финансовые затраты.",
    },
    useful_tips: {
      uz: "Mulk xaridi yoki rasmiylashtirish jarayonida mutaxassis rieltor va huquqshunoslar tavsiyalariga tayanish xavflarni minimallashtiradi.",
      ru: "Следование рекомендациям профильных специалистов сводит к минимуму юридические и финансовые риски.",
    },
  };

  const stat = extractVerifiedStat(`${item.title} ${item.description}`);

  return {
    uz: {
      title: uzTitle,
      summary: uzSummary,
      takeaway: takeawayMap[category].uz,
    },
    ru: {
      title: ruTitle,
      summary: ruSummary,
      takeaway: takeawayMap[category].ru,
    },
    statValue: stat,
  };
}

// -------------------------------------------------------------
// HARVESTING CONTROLLER
// -------------------------------------------------------------

export interface HarvestResult {
  sourceId: string;
  sourceName: string;
  itemsFound: number;
  newItemsSaved: number;
  error?: string;
}

export async function harvestFromSingleSource(
  source: NewsSource,
  options?: { maxItems?: number }
): Promise<HarvestResult> {
  const maxItems = options?.maxItems || 10;
  let itemsFound = 0;
  let newItemsSaved = 0;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(source.feed_url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AngrenEstate-NewsHarvester/1.0 (+https://angrenestate.uz)",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }

    const xml = await resp.text();
    const parsedItems = parseRssXml(xml);
    itemsFound = parsedItems.length;

    // Filter real estate items
    const relevantItems = parsedItems.filter((i) => isRealEstateRelated(i.title, i.description));

    for (const item of relevantItems.slice(0, maxItems)) {
      const urlHash = computeUrlHash(item.link);
      const alreadyExists = await hasNewsWithUrlHash(urlHash);

      if (alreadyExists) {
        continue;
      }

      const category = classifyNewsCategory(item.title, item.description);
      const bilingual = await prepareBilingualNewsContent(item, category, source);

      const savedNews = await saveNewsItem({
        source_id: source.id,
        original_title: item.title,
        original_url: item.link,
        url_hash: urlHash,
        category,
        published_at: new Date(item.pubDate).toISOString(),
        discovered_at: new Date().toISOString(),
        status: "discovered",
        requires_fact_check: category === "legislation_cadastre" || category === "taxes_and_fees",
        verified_stat_value: bilingual.statValue,
      });

      // Save Uzbek translation
      await saveNewsTranslation({
        news_id: savedNews.id,
        language: "uz",
        title: bilingual.uz.title,
        summary: bilingual.uz.summary,
        practical_takeaway: bilingual.uz.takeaway,
        is_reviewed_by_admin: false,
      });

      // Save Russian translation
      await saveNewsTranslation({
        news_id: savedNews.id,
        language: "ru",
        title: bilingual.ru.title,
        summary: bilingual.ru.summary,
        practical_takeaway: bilingual.ru.takeaway,
        is_reviewed_by_admin: false,
      });

      newItemsSaved++;
    }

    await updateSourceLastChecked(source.id);
    await recordSourceCheck({
      source_id: source.id,
      status: "success",
      items_found: itemsFound,
      new_items_count: newItemsSaved,
    });

    return {
      sourceId: source.id,
      sourceName: source.name,
      itemsFound,
      newItemsSaved,
    };
  } catch (err: any) {
    const errorMsg = err?.message || "Feed check error";
    await recordSourceCheck({
      source_id: source.id,
      status: "failed",
      items_found: 0,
      new_items_count: 0,
      error_message: errorMsg,
    });

    return {
      sourceId: source.id,
      sourceName: source.name,
      itemsFound: 0,
      newItemsSaved: 0,
      error: errorMsg,
    };
  }
}

export async function harvestAllActiveSources(): Promise<HarvestResult[]> {
  const sources = await getNewsSources();
  const activeSources = sources.filter((s) => s.is_active);
  const results: HarvestResult[] = [];

  for (const source of activeSources) {
    const res = await harvestFromSingleSource(source);
    results.push(res);
  }

  return results;
}
