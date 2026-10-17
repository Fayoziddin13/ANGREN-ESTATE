/**
 * ANGREN ESTATE — Brand Visual Card Generator
 * Programmatically generates high-resolution, premium branded news cards
 * in strict accordance with corporate identity (Emerald #0b3824, #167d4f, #2db477).
 */

import crypto from "crypto";
import { supabaseAdmin, isSupabaseConfigured } from "./supabaseServer";
import { saveNewsAsset } from "./newsStore";
import { NEWS_CATEGORIES } from "./types/news";
import type { NewsAsset, RealEstateNews } from "./types/news";

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
 * Get raw SVG Buffer for news brand card.
 * Used for direct binary multipart upload to Telegram Bot API.
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

/**
 * Generate brand asset for news article and persist record.
 * Never uses data: URIs as public_url.
 */
export async function generateAndSaveNewsAsset(
  news: RealEstateNews,
  lang: "uz" | "ru"
): Promise<NewsAsset> {
  const buffer = getNewsCardSvgBuffer(news, lang);
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const filename = `news_${news.id}_${lang}_${randomSuffix}.svg`;
  const storagePath = `news/${news.id}/${filename}`;

  let publicUrl = "";

  // Try uploading to Supabase Storage if configured
  if (isSupabaseConfigured) {
    try {
      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from("property-images")
        .upload(storagePath, buffer, {
          contentType: "image/svg+xml",
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

  const asset = await saveNewsAsset({
    news_id: news.id,
    language: lang,
    storage_path: storagePath,
    public_url: publicUrl,
    asset_type: "generated_card",
    width: 1200,
    height: 675,
  });

  return asset;
}
