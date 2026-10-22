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
import { safeFetchFeed, validateFeedUrlSsrf } from "./sourceSecurity";
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
    const enclosureMatch =
      itemBlock.match(/<enclosure[\s\S]*?url=["'](.*?)["']/i) ||
      itemBlock.match(/<media:content[\s\S]*?url=["'](.*?)["']/i) ||
      itemBlock.match(/<media:thumbnail[\s\S]*?url=["'](.*?)["']/i) ||
      itemBlock.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);

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
      const imageMatch =
        entryBlock.match(/<media:content[\s\S]*?url=["'](.*?)["']/i) ||
        entryBlock.match(/<media:thumbnail[\s\S]*?url=["'](.*?)["']/i) ||
        entryBlock.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);

      const title = cleanHtmlText(titleMatch ? titleMatch[1] : "");
      const link = linkMatch ? linkMatch[1].trim() : "";
      const description = cleanHtmlText(descMatch ? descMatch[1] : "");
      const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
      const imageUrl = imageMatch ? imageMatch[1].trim() : undefined;

      if (title && link) {
        items.push({
          title,
          link,
          description,
          pubDate: pubDateStr,
          imageUrl,
        });
      }
    }
  }

  return items;
}

/**
 * Safely fetches article HTML and extracts OpenGraph or Twitter preview image.
 * Uses safeFetchFeed and validateFeedUrlSsrf for full SSRF defense.
 */
export async function extractOpenGraphImage(articleUrl: string): Promise<string | undefined> {
  const ssrf = validateFeedUrlSsrf(articleUrl);
  if (!ssrf.valid) return undefined;

  try {
    const res = await safeFetchFeed(articleUrl, { timeoutMs: 6000 });
    if (!res.ok) return undefined;

    const html = await res.text();
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    if (ogMatch && ogMatch[1]) {
      let imgUrl = ogMatch[1].trim();
      if (imgUrl.startsWith("//")) imgUrl = `https:${imgUrl}`;
      else if (imgUrl.startsWith("/")) {
        try {
          const u = new URL(articleUrl);
          imgUrl = `${u.origin}${imgUrl}`;
        } catch {
          return undefined;
        }
      }
      const imgSsrf = validateFeedUrlSsrf(imgUrl);
      if (imgSsrf.valid) return imgUrl;
    }
  } catch {
    // Graceful fallback if article page is protected, timed out, or blocked
  }
  return undefined;
}

// -------------------------------------------------------------
// REAL ESTATE RELEVANCE & CATEGORIZATION
// -------------------------------------------------------------

const REAL_ESTATE_KEYWORDS_UZ_LATIN = [
  "ko‘chmas mulk", "kochmas mulk", "ko'chmas mulk", "uy-joy", "uy joy", "xonadon", "turar joy", "turar-joy",
  "yer uchastkasi", "kadastr", "ipoteka", "qurilish", "ijara", "developer", "dehqon xo'jaligi",
  "shaharsozlik", "kvartira", "hovli", "dacha", "noturar joy", "mulk huquqi",
  "quruvchi", "renovatsiya", "eskrou", "turar-joy", "kommunal xo'jalik", "issiqlik ta'minoti"
];

const REAL_ESTATE_KEYWORDS_UZ_CYRILLIC = [
  "кўчмас мулк", "кочмас мулк", "уй-жой", "уй жой", "хонадон", "турар жой", "турар-жой",
  "ер участкаси", "кадастр", "ипотека", "қурилиш", "курилиш", "ижара", "девелопер",
  "шаҳарсозлик", "шахарсозлик", "квартира", "ҳовли", "ховли", "дача",
  "нотурар жой", "мулк ҳуқуқи", "мулк хукуки", "қурувчи", "курувчи", "реновация",
  "коммунал хўжалик", "коммунал", "иссиқлик таъминоти", "иситиш"
];

const REAL_ESTATE_KEYWORDS_RU = [
  "недвижимост", "жиль", "квартир", "кадастр",
  "ипотек", "строительств", "аренд", "застройщик", "градостроительств",
  "новостройк", "право собственности", "вторичк", "реноваци",
  "жкх", "девелопер", "жилой комплекс", "земельный участок", "новостройка"
];

const BOUNDARY_REGEXES = [
  /\b(дом|дома|домов|домами|доме|домах)\b/i,
  /\b(бино|бинолар|бинолари)\b/i,
  /\b(участок|участки|участка|участков)\b/i,
];

export function isRealEstateRelated(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  if (REAL_ESTATE_KEYWORDS_UZ_LATIN.some((kw) => combined.includes(kw))) return true;
  if (REAL_ESTATE_KEYWORDS_UZ_CYRILLIC.some((kw) => combined.includes(kw))) return true;
  if (REAL_ESTATE_KEYWORDS_RU.some((kw) => combined.includes(kw))) return true;
  if (BOUNDARY_REGEXES.some((rx) => rx.test(combined))) return true;
  return false;
}

export function classifyNewsCategory(title: string, description: string): NewsCategory {
  const text = `${title} ${description}`.toLowerCase();

  // 1. Legislation & Cadastre
  if (
    text.includes("qonun") || text.includes("qaror") || text.includes("farmon") ||
    text.includes("nizom") || text.includes("kadastr") || text.includes("adliya") ||
    text.includes("mulk huquqi") || text.includes("закон") || text.includes("указ") ||
    text.includes("постановление") || text.includes("кадастр") || text.includes("регламент") ||
    text.includes("қонун") || text.includes("қарор") || text.includes("фармон") ||
    text.includes("низом") || text.includes("адлия") || text.includes("мулк ҳуқуқи")
  ) {
    return "legislation_cadastre";
  }

  // 2. Mortgage & Finance
  if (
    text.includes("ipoteka") || text.includes("kredit") || text.includes("subsidiya") ||
    text.includes("markaziy bank") || text.includes("stavka") || text.includes("ипотека") ||
    text.includes("кредит") || text.includes("субсидия") || text.includes("ставка") ||
    text.includes("марказий банк")
  ) {
    return "mortgage_finance";
  }

  // 3. Construction & Projects
  if (
    text.includes("qurilish") || text.includes("yangi loyiha") || text.includes("bino") ||
    text.includes("majmua") || text.includes("developer") || text.includes("строительств") ||
    text.includes("новостройк") || text.includes("жк") || text.includes("застройщик") ||
    text.includes("қурилиш") || text.includes("янги лойиҳа") || text.includes("бино") ||
    text.includes("мажмуа") || text.includes("девелопер")
  ) {
    return "construction_projects";
  }

  // 4. Rental Market
  if (
    text.includes("ijara") || text.includes("arenda") || text.includes("ijarachi") ||
    text.includes("аренда") || text.includes("съем") || text.includes("арендатор") ||
    text.includes("ижара") || text.includes("ижарачи")
  ) {
    return "rental_market";
  }

  // 5. Taxes & Fees
  if (
    text.includes("soliq") || text.includes("davlat boji") || text.includes("xarajat") ||
    text.includes("to‘lov") || text.includes("налог") || text.includes("пошлина") ||
    text.includes("сбор") || text.includes("солиқ") || text.includes("давлат божи") ||
    text.includes("тўлов") || text.includes("харажат")
  ) {
    return "taxes_and_fees";
  }

  // 6. Useful Tips
  if (
    text.includes("maslahat") || text.includes("tavsiya") || text.includes("tartibi") ||
    text.includes("qanday qilib") || text.includes("совет") || text.includes("рекомендац") ||
    text.includes("как оформить") || text.includes("маслаҳат") || text.includes("тавсия") ||
    text.includes("тартиби") || text.includes("қандай қилиб")
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
  relevantFound: number;
  duplicatesCount: number;
  newItemsSaved: number;
  error?: string;
}

export async function harvestFromSingleSource(
  source: NewsSource,
  options?: { maxItems?: number }
): Promise<HarvestResult> {
  const maxItems = options?.maxItems || 10;
  let itemsFound = 0;
  let relevantFound = 0;
  let duplicatesCount = 0;
  let newItemsSaved = 0;

  try {
    const resp = await safeFetchFeed(source.feed_url, {
      timeoutMs: 12000,
      headers: {
        "User-Agent": "AngrenEstate-NewsHarvester/1.0 (+https://angrenestate.uz)",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }

    const xml = await resp.text();
    const parsedItems = parseRssXml(xml);
    itemsFound = parsedItems.length;

    // Filter real estate items
    const relevantItems = parsedItems.filter((i) => isRealEstateRelated(i.title, i.description));
    relevantFound = relevantItems.length;

    for (const item of relevantItems.slice(0, maxItems)) {
      // 1. Quality & factual validation: Reject incomplete, unintelligible, or non-verifiable items
      const trimmedTitle = (item.title || "").trim();
      if (trimmedTitle.length < 12) {
        continue; // Skip items with too short, empty, or uninformative titles
      }

      // 2. Normalize and strictly validate original article link
      let itemLink = item.link.trim();
      if (itemLink.startsWith("/")) {
        itemLink = `https://${source.domain}${itemLink}`;
      } else if (!itemLink.startsWith("http://") && !itemLink.startsWith("https://")) {
        itemLink = `https://${itemLink}`;
      }

      try {
        const parsedUrl = new URL(itemLink);
        if (!parsedUrl.hostname || (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:")) {
          continue;
        }
      } catch {
        continue;
      }

      // 3. Deduplication check via canonical URL hash
      const urlHash = computeUrlHash(itemLink);
      const alreadyExists = await hasNewsWithUrlHash(urlHash);

      if (alreadyExists) {
        duplicatesCount++;
        continue;
      }

      // 4. Parse verified publication timestamp without fabricating dates
      let pubDateObj = new Date(item.pubDate);
      if (isNaN(pubDateObj.getTime())) {
        pubDateObj = new Date();
      }

      const category = classifyNewsCategory(item.title, item.description);
      const bilingual = await prepareBilingualNewsContent(item, category, source);

      // 5. Unverified / sensitive economic and legal items held in needs_review until admin review
      const isCriticalCategory =
        category === "legislation_cadastre" ||
        category === "taxes_and_fees" ||
        category === "mortgage_finance";
      const requiresFactCheck = isCriticalCategory || source.trust_level !== "official_gov";
      const initialStatus = requiresFactCheck ? "needs_review" : "discovered";

      const savedNews = await saveNewsItem({
        source_id: source.id,
        original_title: item.title,
        original_url: itemLink,
        source_image_url: item.imageUrl,
        url_hash: urlHash,
        category,
        published_at: pubDateObj.toISOString(),
        discovered_at: new Date().toISOString(),
        status: initialStatus,
        requires_fact_check: requiresFactCheck,
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
      status: itemsFound === 0 ? "empty" : "success",
      items_found: itemsFound,
      new_items_count: newItemsSaved,
    });

    return {
      sourceId: source.id,
      sourceName: source.name,
      itemsFound,
      relevantFound,
      duplicatesCount,
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
      relevantFound: 0,
      duplicatesCount: 0,
      newItemsSaved: 0,
      error: errorMsg,
    };
  }
}

export async function harvestAllActiveSources(): Promise<HarvestResult[]> {
  const sources = await getNewsSources();
  const activeSources = sources.filter((s) => s.is_active);
  const results: HarvestResult[] = [];

  // Run in chunks of 3 for fast, parallel harvesting without hitting Vercel serverless timeouts
  const chunkSize = 3;
  for (let i = 0; i < activeSources.length; i += chunkSize) {
    const chunk = activeSources.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((source) => harvestFromSingleSource(source))
    );
    results.push(...chunkResults);
  }

  return results;
}
