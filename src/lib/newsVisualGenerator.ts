/**
 * ANGREN ESTATE — Brand Visual Card Generator
 * Programmatically generates high-resolution, premium branded news cards
 * in strict accordance with corporate identity (Emerald #0b3824, #167d4f, #2db477).
 */

import crypto from "crypto";
import { supabaseAdmin, isSupabaseConfigured } from "./supabaseServer";
import { saveNewsAsset } from "./newsStore";
import { safeFetchFeed, validateFeedUrlSsrf } from "./sourceSecurity";
import { extractOpenGraphImage } from "./newsHarvester";
import { NEWS_CATEGORIES } from "./types/news";
import type { NewsAsset, RealEstateNews, NewsCategory } from "./types/news";

export interface VisualCardOptions {
  title: string;
  category: keyof typeof NEWS_CATEGORIES;
  sourceName: string;
  language: "uz" | "ru";
  statValue?: string;
  publishedDate?: string;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTextToLines(text: string, maxCharsPerLine: number = 38, maxLines: number = 4): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) {
        break;
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // If text was cut off, add ellipsis to last line
  if (lines.length === maxLines && words.length > lines.join(" ").split(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:!?]?$/, "...");
  }

  return lines;
}

/**
 * Generate standalone SVG string for the branded news card.
 */
export function generateBrandCardSvg(options: VisualCardOptions): string {
  const isUz = options.language === "uz";
  const categoryMeta = NEWS_CATEGORIES[options.category] || NEWS_CATEGORIES.market_prices;
  const categoryLabel = (isUz ? categoryMeta.uz : categoryMeta.ru).toUpperCase();
  const sourceLabel = `${isUz ? "Manba" : "Источник"}: ${options.sourceName}`;

  const titleLines = wrapTextToLines(options.title, 42, 3);
  const titleYStart = options.statValue ? 290 : 310;
  const lineHeight = 54;

  const titleSvgSpans = titleLines
    .map(
      (line, idx) =>
        `<tspan x="80" y="${titleYStart + idx * lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("");

  const statBoxSvg = options.statValue
    ? `
      <g transform="translate(80, 480)">
        <rect width="320" height="74" rx="14" fill="#062416" stroke="#2db477" stroke-width="1.5" stroke-opacity="0.6"/>
        <text x="24" y="32" fill="#2db477" font-size="13" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="700" letter-spacing="1.2">
          ${isUz ? "MUHIM RAQAM" : "КЛЮЧЕВОЙ ПОКАЗАТЕЛЬ"}
        </text>
        <text x="24" y="60" fill="#ffffff" font-size="26" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="800">
          ${escapeXml(options.statValue)}
        </text>
      </g>
    `
    : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#051f13"/>
      <stop offset="50%" stop-color="#0b3824"/>
      <stop offset="100%" stop-color="#072b1c"/>
    </linearGradient>

    <!-- Radial Glow -->
    <radialGradient id="glowGrad" cx="85%" cy="15%" r="65%">
      <stop offset="0%" stop-color="#167d4f" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="#0b3824" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#0b3824" stop-opacity="0"/>
    </radialGradient>

    <!-- Pattern -->
    <pattern id="archGrid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#2db477" stroke-width="1" stroke-opacity="0.05"/>
      <circle cx="60" cy="60" r="1.5" fill="#2db477" fill-opacity="0.12"/>
    </pattern>

    <!-- Card Glow Filter -->
    <filter id="subtleShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Background Layer -->
  <rect width="1200" height="675" fill="url(#bgGrad)"/>
  <rect width="1200" height="675" fill="url(#glowGrad)"/>
  <rect width="1200" height="675" fill="url(#archGrid)"/>

  <!-- Top Accent Stripe -->
  <rect x="0" y="0" width="1200" height="6" fill="#167d4f"/>
  <rect x="0" y="0" width="280" height="6" fill="#2db477"/>

  <!-- Geometric Luxury Border Accent -->
  <rect x="30" y="30" width="1140" height="615" rx="20" fill="none" stroke="#2db477" stroke-width="1.5" stroke-opacity="0.2"/>

  <!-- Header Section -->
  <g transform="translate(80, 80)">
    <!-- Brand Crest Emblem -->
    <g transform="translate(0, 0)">
      <rect width="48" height="48" rx="12" fill="#167d4f" fill-opacity="0.9"/>
      <path d="M12 36 L24 14 L36 36 Z" fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
      <path d="M19 28 L29 28" stroke="#2db477" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="24" cy="22" r="2" fill="#ffffff"/>
    </g>

    <!-- Brand Typography -->
    <text x="64" y="24" fill="#ffffff" font-size="20" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="900" letter-spacing="2.5">
      ANGREN ESTATE
    </text>
    <text x="64" y="42" fill="#2db477" font-size="11" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="700" letter-spacing="3.5">
      ${isUz ? "RASMIY KO‘CHMAS MULK MARKAZI" : "ОФИЦИАЛЬНЫЙ ЦЕНТР НЕДВИЖИМОСТИ"}
    </text>
  </g>

  <!-- Category Badge -->
  <g transform="translate(80, 185)">
    <rect width="${categoryLabel.length * 11 + 44}" height="38" rx="10" fill="#145d3c" stroke="#2db477" stroke-width="1.5"/>
    <circle cx="20" cy="19" r="4.5" fill="#2db477"/>
    <text x="34" y="24" fill="#ffffff" font-size="13" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="800" letter-spacing="1.2">
      ${escapeXml(categoryLabel)}
    </text>
  </g>

  <!-- Headline -->
  <text font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="38" font-weight="800" fill="#ffffff" line-height="54" filter="url(#subtleShadow)">
    ${titleSvgSpans}
  </text>

  <!-- Key Stat Box -->
  ${statBoxSvg}

  <!-- Footer Divider Line -->
  <line x1="80" y1="585" x2="1120" y2="585" stroke="#2db477" stroke-width="1" stroke-opacity="0.25"/>

  <!-- Footer Credits -->
  <g transform="translate(80, 618)">
    <text x="0" y="0" fill="#9dcbb4" font-size="14" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="600">
      ${escapeXml(sourceLabel)}
    </text>
  </g>

  <g transform="translate(1120, 618)">
    <text text-anchor="end" x="0" y="0" fill="#ffffff" font-size="14" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="700">
      <tspan fill="#2db477">angrenestate.uz</tspan>  |  @angren_estate
    </text>
  </g>
</svg>
  `.trim();
}

/**
 * Verified curated high-resolution editorial real estate photography per category.
 * Used as reliable fallback if AI generation times out or is temporarily unavailable.
 */
export const CATEGORY_EDITORIAL_IMAGES: Record<keyof typeof NEWS_CATEGORIES, string> = {
  market_prices: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&h=675&q=85",
  mortgage_finance: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&h=675&q=85",
  legislation_cadastre: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&h=675&q=85",
  construction_projects: "https://images.unsplash.com/photo-1541888946425-d0fbb18615f3?auto=format&fit=crop&w=1200&h=675&q=85",
  rental_market: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&h=675&q=85",
  taxes_and_fees: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&h=675&q=85",
  useful_tips: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&h=675&q=85",
};

export const AI_PROMPT_TEMPLATES: Record<keyof typeof NEWS_CATEGORIES, string> = {
  market_prices: "modern luxury apartment buildings Tashkent Uzbekistan, real estate market architecture, professional exterior architectural photography, 4k, clean morning daylight, high detail",
  mortgage_finance: "modern real estate banking office, apartment loan contract, keys on desk, luxury interior, professional business photography, 4k, hyper-detailed",
  legislation_cadastre: "official cadastral floor plans and architectural blueprint, architect desk, real estate legal documents, professional photography, 4k",
  construction_projects: "contemporary residential complex construction site, cranes, modern glass facades, luxury towers, architectural photography, 4k",
  rental_market: "cozy modern apartment living room, designer furniture, warm ambient lighting, apartment keys on table, professional interior photography, 4k",
  taxes_and_fees: "real estate financial calculation, modern apartment model, documents and calculator, professional commercial photography, 4k",
  useful_tips: "modern interior design, apartment renovation, stylish living room, home improvement, architectural photography, 4k",
};

/**
 * Validates whether binary buffer contains a valid image (JPEG, PNG, or WEBP).
 */
export function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 100) return false;
  // JPEG starts with FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // PNG starts with 89 50 4E 47
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  // WEBP starts with RIFF .... WEBP
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return isJpeg || isPng || isWebp;
}

/**
 * In-memory buffer cache to avoid re-fetching or re-generating image buffers on repeat requests.
 */
export const newsImageBufferCache = new Map<string, { buffer: Buffer; timestamp: number }>();
/**
 * Validates whether an asset is a genuine raster JPEG/PNG image (not an empty URL, data URI, or SVG).
 */
export function isRasterAssetValid(asset?: NewsAsset | null): boolean {
  if (!asset) return false;
  if (!asset.public_url || typeof asset.public_url !== "string") return false;
  if (!asset.public_url.startsWith("https://")) return false;
  if (asset.public_url.includes("image/svg+xml")) return false;
  if (asset.storage_path?.endsWith(".svg") || asset.public_url.endsWith(".svg")) return false;
  return true;
}

/**
 * Fetch topic-relevant image from AI synthesis engine (Pollinations AI).
 */
export async function fetchAiImageForNews(
  news: RealEstateNews,
  lang: "uz" | "ru"
): Promise<{ buffer: Buffer; origin: "ai" } | null> {
  const categoryKey = (news.category in AI_PROMPT_TEMPLATES ? news.category : "market_prices") as keyof typeof AI_PROMPT_TEMPLATES;
  const basePrompt = AI_PROMPT_TEMPLATES[categoryKey];
  const trans = lang === "uz" ? news.translations?.uz : news.translations?.ru;
  // Clean title preserving Uzbek and Russian Unicode letters, digits, and spaces
  const cleanTitle = (trans?.title || news.original_title || "")
    .slice(0, 90)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fullPrompt = cleanTitle
    ? `${basePrompt}, modern architecture, ${cleanTitle}`
    : `${basePrompt}, modern architecture`;
  const seed = Math.floor(Math.random() * 1000000);
  const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1200&height=675&nologo=true&seed=${seed}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds for reliable synthesis

  try {
    const res = await fetch(aiUrl, {
      signal: controller.signal,
      headers: { Accept: "image/jpeg, image/png, */*" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.warn(`[VisualGenerator] Pollinations AI returned HTTP ${res.status}: ${res.statusText}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (isValidImageBuffer(buffer)) {
      console.log(`[VisualGenerator] Pollinations AI success (${buffer.length} bytes, valid JPEG/PNG)`);
      return { buffer, origin: "ai" };
    } else {
      console.warn(`[VisualGenerator] Pollinations AI buffer failed validation (${buffer.length} bytes)`);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[VisualGenerator] Pollinations AI fetch exception:`, err?.message || err);
  }

  return null;
}

/**
 * Fetch curated high-resolution editorial real estate visual for the given category.
 */
export async function fetchCuratedImageForCategory(
  category: NewsCategory
): Promise<{ buffer: Buffer; origin: "curated" } | null> {
  const categoryKey = (category in CATEGORY_EDITORIAL_IMAGES ? category : "market_prices") as keyof typeof CATEGORY_EDITORIAL_IMAGES;
  const url = CATEGORY_EDITORIAL_IMAGES[categoryKey];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/jpeg, image/png, */*" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (isValidImageBuffer(buffer)) {
      return { buffer, origin: "curated" };
    }
  } catch {
    clearTimeout(timeoutId);
  }

  return null;
}

/**
 * Fetch original news image from source RSS or article OpenGraph meta tags.
 */
export async function fetchSourceImageForNews(
  news: RealEstateNews
): Promise<{ buffer: Buffer; origin: "source_rss" | "source_og" } | null> {
  let srcUrl = news.source_image_url;
  let origin: "source_rss" | "source_og" = "source_rss";

  if (!srcUrl && news.original_url) {
    srcUrl = await extractOpenGraphImage(news.original_url);
    origin = "source_og";
  }

  if (!srcUrl) return null;

  const ssrf = validateFeedUrlSsrf(srcUrl);
  if (!ssrf.valid) return null;

  try {
    const res = await safeFetchFeed(srcUrl, { timeoutMs: 6000 });
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (isValidImageBuffer(buffer)) {
      return { buffer, origin };
    }
  } catch {}

  return null;
}

/**
 * Get raw SVG Buffer for news brand card (legacy/fallback support).
 */
export function getNewsCardSvgBuffer(news: RealEstateNews, lang: "uz" | "ru"): Buffer {
  const trans = lang === "uz" ? news.translations?.uz : news.translations?.ru;
  const title = trans?.title || news.original_title;
  const sourceName = news.source?.name || news.original_url.split("/")[2] || "Rasmiy manba";

  const svgContent = generateBrandCardSvg({
    title,
    category: news.category,
    sourceName,
    language: lang,
    statValue: news.verified_stat_value,
  });

  return Buffer.from(svgContent, "utf-8");
}

// Minimal valid standalone JPEG raster buffer for emergency fallback
const MINIMAL_RASTER_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9
]);

/**
 * Get binary JPEG/PNG image buffer for news item (used for Telegram multipart delivery).
 * NEVER returns an SVG buffer.
 */
export async function getNewsCardImageBuffer(news: RealEstateNews, lang: "uz" | "ru"): Promise<Buffer> {
  const cacheKey = `${news.id}_${lang}`;
  const cached = newsImageBufferCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 30 && isValidImageBuffer(cached.buffer)) {
    return cached.buffer;
  }

  // 1. Try loading from asset public_url if available (only genuine raster URLs, never SVG)
  const asset = lang === "uz" ? news.assets?.uz : news.assets?.ru;
  if (asset?.public_url && asset.public_url.startsWith("https://") && !asset.public_url.endsWith(".svg")) {
    try {
      const res = await safeFetchFeed(asset.public_url, { timeoutMs: 6000 });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (isValidImageBuffer(buf)) {
          newsImageBufferCache.set(cacheKey, { buffer: buf, timestamp: Date.now() });
          return buf;
        }
      }
    } catch {}
  }

  // 2. Try fetching curated fallback buffer for category
  const curated = await fetchCuratedImageForCategory(news.category);
  if (curated && isValidImageBuffer(curated.buffer)) {
    newsImageBufferCache.set(cacheKey, { buffer: curated.buffer, timestamp: Date.now() });
    return curated.buffer;
  }

  // 3. Try primary market_prices curated fallback
  const fallbackCurated = await fetchCuratedImageForCategory("market_prices");
  if (fallbackCurated && isValidImageBuffer(fallbackCurated.buffer)) {
    newsImageBufferCache.set(cacheKey, { buffer: fallbackCurated.buffer, timestamp: Date.now() });
    return fallbackCurated.buffer;
  }

  // 4. Return valid raster JPEG buffer (never SVG to prevent Telegram sendPhoto rejection)
  return MINIMAL_RASTER_JPEG_BUFFER;
}

/**
 * Generate brand asset for news article and persist record.
 * Generates valid binary JPEG images and uploads to Supabase Storage.
 * Never uses data: URIs as public_url.
 */
export async function generateAndSaveNewsAsset(
  news: RealEstateNews,
  lang: "uz" | "ru",
  options?: {
    preferSourceImage?: boolean;
    forceAi?: boolean;
  }
): Promise<NewsAsset> {
  let imageResult: { buffer: Buffer; origin: "ai" | "curated" | "source_rss" | "source_og" } | null = null;

  if (options?.preferSourceImage) {
    imageResult = await fetchSourceImageForNews(news);
    if (!imageResult) {
      imageResult = await fetchAiImageForNews(news, lang);
    }
  } else {
    // Priority order: 1) AI generation -> 2) Source image -> 3) Curated editorial photo
    imageResult = await fetchAiImageForNews(news, lang);
    if (!imageResult) {
      imageResult = await fetchSourceImageForNews(news);
    }
  }

  // Final fallback to high-resolution curated editorial real estate visual
  if (!imageResult) {
    imageResult = await fetchCuratedImageForCategory(news.category);
  }

  if (!imageResult || !imageResult.buffer) {
    throw new Error(
      "Rasm yaratilmadi: sun'iy intellekt va manba serveri bilan bog'lanishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
    );
  }

  const { buffer, origin } = imageResult;
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const filename = `news_${news.id}_${lang}_${randomSuffix}.jpg`;
  const storagePath = `news/${news.id}/${filename}`;

  let publicUrl = "";

  // Upload JPEG binary buffer to Supabase Storage
  if (isSupabaseConfigured) {
    try {
      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from("property-images")
        .upload(storagePath, buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: urlData } = supabaseAdmin.storage
          .from("property-images")
          .getPublicUrl(storagePath);
        if (urlData?.publicUrl && urlData.publicUrl.startsWith("https://")) {
          publicUrl = urlData.publicUrl;
        }
      } else if (uploadErr) {
        console.warn("[VisualGenerator] Remote storage upload warning:", uploadErr.message);
      }
    } catch (e: any) {
      console.warn("[VisualGenerator] Remote storage upload exception:", e?.message || e);
    }
  }

  // Cache buffer for fast Telegram multipart upload
  const cacheKey = `${news.id}_${lang}`;
  newsImageBufferCache.set(cacheKey, { buffer, timestamp: Date.now() });

  const asset = await saveNewsAsset({
    news_id: news.id,
    language: lang,
    storage_path: storagePath,
    public_url: publicUrl,
    asset_type: "generated_card",
    source_origin: origin,
    width: 1200,
    height: 675,
  });

  return asset;
}
