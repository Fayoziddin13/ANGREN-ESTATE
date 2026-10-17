import fs from "fs";
import path from "path";
import crypto from "crypto";
import { supabaseAdmin, isSupabaseConfigured } from "./supabaseServer";
import type {
  NewsSource,
  RealEstateNews,
  NewsTranslation,
  NewsAsset,
  NewsPublication,
  NewsSourceCheck,
  NewsCategory,
  NewsStatus,
} from "./types/news";

const LOCAL_STORE_FILE = path.join(process.cwd(), "data", "news_store.json");

interface LocalNewsData {
  sources: NewsSource[];
  news: RealEstateNews[];
  translations: NewsTranslation[];
  assets: NewsAsset[];
  publications: NewsPublication[];
  checks: NewsSourceCheck[];
}

const DEFAULT_SOURCES: NewsSource[] = [
  {
    id: "source-lex-uz",
    name: "Lex.uz — Qonunchilik maʼlumotlari milliy bazasi",
    domain: "lex.uz",
    feed_url: "https://lex.uz/rss",
    source_type: "rss",
    trust_level: "official_gov",
    check_frequency_min: 120,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "source-gazeta-uz",
    name: "Gazeta.uz — Iqtisodiyot va Ko‘chmas mulk",
    domain: "gazeta.uz",
    feed_url: "https://www.gazeta.uz/uz/rss/",
    source_type: "rss",
    trust_level: "reputable_media",
    check_frequency_min: 180,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "source-gazeta-ru",
    name: "Gazeta.uz — Недвижимость (RU)",
    domain: "gazeta.uz",
    feed_url: "https://www.gazeta.uz/ru/rss/",
    source_type: "rss",
    trust_level: "reputable_media",
    check_frequency_min: 180,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "source-spot-uz",
    name: "Spot.uz — Biznes va Ko‘chmas mulk",
    domain: "spot.uz",
    feed_url: "https://www.spot.uz/rss/",
    source_type: "rss",
    trust_level: "reputable_media",
    check_frequency_min: 180,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "source-daryo-uz",
    name: "Daryo.uz — Qurilish va Infratuzilma",
    domain: "daryo.uz",
    feed_url: "https://daryo.uz/rss",
    source_type: "rss",
    trust_level: "reputable_media",
    check_frequency_min: 180,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
];

function readLocalData(): LocalNewsData {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        sources: Array.isArray(parsed.sources) ? parsed.sources : DEFAULT_SOURCES,
        news: Array.isArray(parsed.news) ? parsed.news : [],
        translations: Array.isArray(parsed.translations) ? parsed.translations : [],
        assets: Array.isArray(parsed.assets) ? parsed.assets : [],
        publications: Array.isArray(parsed.publications) ? parsed.publications : [],
        checks: Array.isArray(parsed.checks) ? parsed.checks : [],
      };
    }
  } catch (err) {
    console.warn("[NewsStore] Could not read local file, fallback to defaults:", err);
  }

  return {
    sources: DEFAULT_SOURCES,
    news: [],
    translations: [],
    assets: [],
    publications: [],
    checks: [],
  };
}

function writeLocalData(data: LocalNewsData): void {
  try {
    const dir = path.dirname(LOCAL_STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[NewsStore] Could not write local file:", err);
  }
}

export function computeUrlHash(url: string): string {
  const normalized = url.trim().toLowerCase().replace(/\/+$/, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// -------------------------------------------------------------
// SOURCES REPOSITORY
// -------------------------------------------------------------

export async function getNewsSources(): Promise<NewsSource[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("news_sources")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as NewsSource[];
      }
    } catch {}
  }

  return readLocalData().sources;
}

export async function saveNewsSource(
  source: Omit<NewsSource, "id" | "created_at" | "updated_at"> & { id?: string }
): Promise<NewsSource> {
  const now = new Date().toISOString();
  const id = source.id || `source-${crypto.randomBytes(6).toString("hex")}`;
  const fullSource: NewsSource = {
    ...source,
    id,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("news_sources")
        .upsert(fullSource, { onConflict: "feed_url" })
        .select()
        .single();
      if (!error && data) {
        return data as NewsSource;
      }
    } catch {}
  }

  const local = readLocalData();
  const existingIdx = local.sources.findIndex((s) => s.id === id || s.feed_url === source.feed_url);
  if (existingIdx >= 0) {
    local.sources[existingIdx] = { ...local.sources[existingIdx], ...fullSource, updated_at: now };
  } else {
    local.sources.push(fullSource);
  }
  writeLocalData(local);
  return fullSource;
}

export async function updateSourceLastChecked(sourceId: string): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    try {
      await supabaseAdmin
        .from("news_sources")
        .update({ last_checked_at: now, updated_at: now })
        .eq("id", sourceId);
    } catch {}
  }

  const local = readLocalData();
  const src = local.sources.find((s) => s.id === sourceId);
  if (src) {
    src.last_checked_at = now;
    writeLocalData(local);
  }
}

// -------------------------------------------------------------
// NEWS REPOSITORY
// -------------------------------------------------------------

export async function getNewsList(params?: {
  status?: NewsStatus;
  category?: NewsCategory;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ items: RealEstateNews[]; total: number }> {
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;

  if (isSupabaseConfigured) {
    try {
      let query = supabaseAdmin
        .from("real_estate_news")
        .select(
          "*, source:news_sources(*), translations:news_translations(*), assets:news_assets(*), publications:news_publications(*)",
          { count: "exact" }
        )
        .order("published_at", { ascending: false });

      if (params?.status) {
        query = query.eq("status", params.status);
      }
      if (params?.category) {
        query = query.eq("category", params.category);
      }
      if (params?.search) {
        query = query.ilike("original_title", `%${params.search}%`);
      }

      query = query.range(offset, offset + limit - 1);
      const { data, error, count } = await query;

      if (!error && Array.isArray(data)) {
        const mapped = data.map((row: any) => {
          const uzTrans = Array.isArray(row.translations)
            ? row.translations.find((t: any) => t.language === "uz")
            : undefined;
          const ruTrans = Array.isArray(row.translations)
            ? row.translations.find((t: any) => t.language === "ru")
            : undefined;
          const uzAsset = Array.isArray(row.assets)
            ? row.assets.find((a: any) => a.language === "uz")
            : undefined;
          const ruAsset = Array.isArray(row.assets)
            ? row.assets.find((a: any) => a.language === "ru")
            : undefined;

          return {
            ...row,
            translations: { uz: uzTrans, ru: ruTrans },
            assets: { uz: uzAsset, ru: ruAsset },
            publications: Array.isArray(row.publications) ? row.publications : [],
          } as RealEstateNews;
        });

        return { items: mapped, total: count || mapped.length };
      }
    } catch {}
  }

  // Fallback to local
  const local = readLocalData();
  let filtered = [...local.news];

  if (params?.status) {
    filtered = filtered.filter((n) => n.status === params.status);
  }
  if (params?.category) {
    filtered = filtered.filter((n) => n.category === params.category);
  }
  if (params?.search) {
    const s = params.search.toLowerCase();
    filtered = filtered.filter((n) => n.original_title.toLowerCase().includes(s));
  }

  const total = filtered.length;
  filtered.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  const sliced = filtered.slice(offset, offset + limit);

  // Attach translations, assets, and publications
  const enriched = sliced.map((item) => {
    const uzTrans = local.translations.find((t) => t.news_id === item.id && t.language === "uz");
    const ruTrans = local.translations.find((t) => t.news_id === item.id && t.language === "ru");
    const uzAsset = local.assets.find((a) => a.news_id === item.id && a.language === "uz");
    const ruAsset = local.assets.find((a) => a.news_id === item.id && a.language === "ru");
    const pubs = local.publications.filter((p) => p.news_id === item.id);
    const src = local.sources.find((s) => s.id === item.source_id);

    return {
      ...item,
      source: src,
      translations: { uz: uzTrans, ru: ruTrans },
      assets: { uz: uzAsset, ru: ruAsset },
      publications: pubs,
    };
  });

  return { items: enriched, total };
}

export async function getNewsById(id: string): Promise<RealEstateNews | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("real_estate_news")
        .select(
          "*, source:news_sources(*), translations:news_translations(*), assets:news_assets(*), publications:news_publications(*)"
        )
        .eq("id", id)
        .single();

      if (!error && data) {
        const uzTrans = Array.isArray(data.translations)
          ? data.translations.find((t: any) => t.language === "uz")
          : undefined;
        const ruTrans = Array.isArray(data.translations)
          ? data.translations.find((t: any) => t.language === "ru")
          : undefined;
        const uzAsset = Array.isArray(data.assets)
          ? data.assets.find((a: any) => a.language === "uz")
          : undefined;
        const ruAsset = Array.isArray(data.assets)
          ? data.assets.find((a: any) => a.language === "ru")
          : undefined;

        return {
          ...data,
          translations: { uz: uzTrans, ru: ruTrans },
          assets: { uz: uzAsset, ru: ruAsset },
          publications: Array.isArray(data.publications) ? data.publications : [],
        } as RealEstateNews;
      }
    } catch {}
  }

  const local = readLocalData();
  const item = local.news.find((n) => n.id === id);
  if (!item) return null;

  const uzTrans = local.translations.find((t) => t.news_id === item.id && t.language === "uz");
  const ruTrans = local.translations.find((t) => t.news_id === item.id && t.language === "ru");
  const uzAsset = local.assets.find((a) => a.news_id === item.id && a.language === "uz");
  const ruAsset = local.assets.find((a) => a.news_id === item.id && a.language === "ru");
  const pubs = local.publications.filter((p) => p.news_id === item.id);
  const src = local.sources.find((s) => s.id === item.source_id);

  return {
    ...item,
    source: src,
    translations: { uz: uzTrans, ru: ruTrans },
    assets: { uz: uzAsset, ru: ruAsset },
    publications: pubs,
  };
}

export async function hasNewsWithUrlHash(urlHash: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("real_estate_news")
        .select("id")
        .eq("url_hash", urlHash)
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return true;
      }
    } catch {}
  }

  const local = readLocalData();
  return local.news.some((n) => n.url_hash === urlHash);
}

export async function saveNewsItem(
  item: Omit<RealEstateNews, "id" | "created_at" | "updated_at"> & { id?: string }
): Promise<RealEstateNews> {
  const now = new Date().toISOString();
  const id = item.id || `news-${crypto.randomBytes(6).toString("hex")}`;
  const fullItem: RealEstateNews = {
    ...item,
    id,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("real_estate_news")
        .upsert(
          {
            id: fullItem.id,
            source_id: fullItem.source_id || null,
            original_title: fullItem.original_title,
            original_url: fullItem.original_url,
            url_hash: fullItem.url_hash,
            category: fullItem.category,
            published_at: fullItem.published_at,
            discovered_at: fullItem.discovered_at,
            status: fullItem.status,
            requires_fact_check: fullItem.requires_fact_check,
            verified_stat_value: fullItem.verified_stat_value || null,
          },
          { onConflict: "url_hash" }
        )
        .select()
        .single();

      if (!error && data) {
        return data as RealEstateNews;
      }
    } catch {}
  }

  const local = readLocalData();
  const existingIdx = local.news.findIndex((n) => n.id === id || n.url_hash === item.url_hash);
  if (existingIdx >= 0) {
    local.news[existingIdx] = { ...local.news[existingIdx], ...fullItem, updated_at: now };
  } else {
    local.news.push(fullItem);
  }
  writeLocalData(local);
  return fullItem;
}

export async function updateNewsStatus(newsId: string, status: NewsStatus): Promise<boolean> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabaseAdmin
        .from("real_estate_news")
        .update({ status, updated_at: now })
        .eq("id", newsId);
      if (!error) return true;
    } catch {}
  }

  const local = readLocalData();
  const item = local.news.find((n) => n.id === newsId);
  if (item) {
    item.status = status;
    item.updated_at = now;
    writeLocalData(local);
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// TRANSLATIONS & ASSETS
// -------------------------------------------------------------

export async function saveNewsTranslation(
  translation: Omit<NewsTranslation, "id" | "created_at" | "updated_at"> & { id?: string }
): Promise<NewsTranslation> {
  const now = new Date().toISOString();
  const id = translation.id || `trans-${crypto.randomBytes(6).toString("hex")}`;
  const fullTrans: NewsTranslation = {
    ...translation,
    id,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("news_translations")
        .upsert(fullTrans, { onConflict: "news_id,language" })
        .select()
        .single();
      if (!error && data) {
        return data as NewsTranslation;
      }
    } catch {}
  }

  const local = readLocalData();
  const idx = local.translations.findIndex(
    (t) => t.news_id === translation.news_id && t.language === translation.language
  );
  if (idx >= 0) {
    local.translations[idx] = { ...local.translations[idx], ...fullTrans, updated_at: now };
  } else {
    local.translations.push(fullTrans);
  }
  writeLocalData(local);
  return fullTrans;
}

export async function saveNewsAsset(
  asset: Omit<NewsAsset, "id" | "created_at"> & { id?: string }
): Promise<NewsAsset> {
  const now = new Date().toISOString();
  const id = asset.id || `asset-${crypto.randomBytes(6).toString("hex")}`;
  const fullAsset: NewsAsset = {
    ...asset,
    id,
    created_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("news_assets")
        .upsert(fullAsset, { onConflict: "news_id,language" })
        .select()
        .single();
      if (!error && data) {
        return data as NewsAsset;
      }
    } catch {}
  }

  const local = readLocalData();
  const idx = local.assets.findIndex(
    (a) => a.news_id === asset.news_id && a.language === asset.language
  );
  if (idx >= 0) {
    local.assets[idx] = fullAsset;
  } else {
    local.assets.push(fullAsset);
  }
  writeLocalData(local);
  return fullAsset;
}

// -------------------------------------------------------------
// PUBLICATIONS & CHECKS
// -------------------------------------------------------------

export async function recordNewsPublication(
  pub: Omit<NewsPublication, "id" | "created_at"> & { id?: string }
): Promise<NewsPublication> {
  const now = new Date().toISOString();
  const id = pub.id || `pub-${crypto.randomBytes(6).toString("hex")}`;
  const fullPub: NewsPublication = {
    ...pub,
    id,
    created_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("news_publications")
        .upsert(fullPub, { onConflict: "news_id,target_type,language" })
        .select()
        .single();
      if (!error && data) {
        return data as NewsPublication;
      }
    } catch {}
  }

  const local = readLocalData();
  const idx = local.publications.findIndex(
    (p) =>
      p.news_id === pub.news_id &&
      p.target_type === pub.target_type &&
      p.language === pub.language
  );
  if (idx >= 0) {
    local.publications[idx] = fullPub;
  } else {
    local.publications.push(fullPub);
  }
  writeLocalData(local);
  return fullPub;
}

export async function recordSourceCheck(
  check: Omit<NewsSourceCheck, "id" | "checked_at">
): Promise<void> {
  const now = new Date().toISOString();
  const id = `check-${crypto.randomBytes(6).toString("hex")}`;
  const fullCheck: NewsSourceCheck = {
    ...check,
    id,
    checked_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      await supabaseAdmin.from("news_source_checks").insert(fullCheck);
    } catch {}
  }

  const local = readLocalData();
  local.checks.unshift(fullCheck);
  if (local.checks.length > 100) local.checks.pop();
  writeLocalData(local);
}
