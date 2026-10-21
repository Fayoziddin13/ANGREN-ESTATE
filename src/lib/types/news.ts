/**
 * ANGREN ESTATE — Real Estate News & Social Publishing Types
 */

export type NewsCategory =
  | "market_prices"          // Uy-joy bozori va narxlar
  | "mortgage_finance"        // Ipoteka va moliyalashtirish
  | "legislation_cadastre"    // Qonunchilik va kadastr
  | "construction_projects"   // Qurilish va yangi loyihalar
  | "rental_market"           // Ijara bozori
  | "taxes_and_fees"          // Soliq va xarajatlar
  | "useful_tips";            // Foydali maslahatlar

export type NewsStatus =
  | "discovered"    // Yangi topilgan
  | "needs_review"  // Tekshiruv kutilmoqda
  | "ready"         // Nashrga tayyor
  | "published"     // Nashr qilingan
  | "archived"      // Arxivlangan
  | "rejected";     // Rad etilgan

export type NewsSourceType = "rss" | "api" | "manual" | "scraper";
export type NewsTrustLevel = "official_gov" | "reputable_media" | "analytical_center";

export interface NewsSource {
  id: string;
  name: string;
  domain: string;
  feed_url: string;
  source_type: NewsSourceType;
  trust_level: NewsTrustLevel;
  check_frequency_min: number;
  is_active: boolean;
  last_checked_at?: string;
  last_check?: {
    status: "success" | "failed" | "empty";
    items_found: number;
    new_items_count: number;
    error_message?: string;
    checked_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface NewsTranslation {
  id: string;
  news_id: string;
  language: "uz" | "ru";
  title: string;
  summary: string;
  practical_takeaway?: string;
  is_reviewed_by_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewsAsset {
  id: string;
  news_id: string;
  language: "uz" | "ru";
  storage_path: string;
  public_url: string;
  asset_type: "generated_card" | "custom_upload" | "source_image" | "ai_generated";
  source_origin?: "ai" | "curated" | "source_rss" | "source_og";
  width: number;
  height: number;
  created_at: string;
}

export interface NewsPublication {
  id: string;
  news_id: string;
  target_type: "channel" | "bot_broadcast";
  language: "uz" | "ru";
  status: "pending" | "published" | "failed" | "already_published";
  telegram_message_id?: number;
  recipients_count?: number;
  error_message?: string;
  published_at?: string;
  created_at: string;
}

export interface NewsSourceCheck {
  id: string;
  source_id: string;
  status: "success" | "failed" | "empty";
  items_found: number;
  new_items_count: number;
  error_message?: string;
  checked_at: string;
}

export interface RealEstateNews {
  id: string;
  source_id?: string;
  source?: NewsSource;
  original_title: string;
  original_url: string;
  source_image_url?: string;
  url_hash: string;
  category: NewsCategory;
  published_at: string;
  discovered_at: string;
  status: NewsStatus;
  requires_fact_check: boolean;
  verified_stat_value?: string;
  created_at: string;
  updated_at: string;
  translations?: {
    uz?: NewsTranslation;
    ru?: NewsTranslation;
  };
  assets?: {
    uz?: NewsAsset;
    ru?: NewsAsset;
  };
  publications?: NewsPublication[];
}

export const NEWS_CATEGORIES: Record<
  NewsCategory,
  { uz: string; ru: string; icon: string; badgeColor: string }
> = {
  market_prices: {
    uz: "Bozor va narxlar",
    ru: "Рынок и цены",
    icon: "TrendingUp",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  mortgage_finance: {
    uz: "Ipoteka va moliya",
    ru: "Ипотека и финансы",
    icon: "Landmark",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
  },
  legislation_cadastre: {
    uz: "Qonunchilik va kadastr",
    ru: "Законодательство и кадастр",
    icon: "Scale",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
  },
  construction_projects: {
    uz: "Qurilish va loyihalar",
    ru: "Строительство и проекты",
    icon: "Building",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
  },
  rental_market: {
    uz: "Ijara bozori",
    ru: "Рынок аренды",
    icon: "Key",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  taxes_and_fees: {
    uz: "Soliqlar va to‘lovlar",
    ru: "Налоги и сборы",
    icon: "Receipt",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
  },
  useful_tips: {
    uz: "Foydali maslahatlar",
    ru: "Полезные советы",
    icon: "Lightbulb",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
  },
};
