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

export const DEFAULT_SOURCES: NewsSource[] = [
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
    id: "source-lex-ru",
    name: "Lex.uz — Законодательство Узбекистана (RU)",
    domain: "lex.uz",
    feed_url: "https://lex.uz/ru/rss",
    source_type: "rss",
    trust_level: "official_gov",
    check_frequency_min: 120,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "source-cbu-uz",
    name: "O‘zbekiston Respublikasi Markaziy Banki — Ipoteka va moliya",
    domain: "cbu.uz",
    feed_url: "https://cbu.uz/uz/press_center/news/rss/",
    source_type: "rss",
    trust_level: "official_gov",
    check_frequency_min: 120,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "source-uza-uz",
    name: "O‘zA — O‘zbekiston Milliy axborot agentligi (Rasmiy davlat xabarlari)",
    domain: "uza.uz",
    feed_url: "https://uza.uz/uz/rss",
    source_type: "rss",
    trust_level: "official_gov",
    check_frequency_min: 120,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "source-uza-ru",
    name: "УзА — Официальные новости Узбекистана (RU)",
    domain: "uza.uz",
    feed_url: "https://uza.uz/ru/rss",
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
    name: "Gazeta.uz — Недвижимость и экономика (RU)",
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
    id: "source-kun-uz",
    name: "Kun.uz — Iqtisodiyot, qurilish va jamiyat yangiliklari",
    domain: "kun.uz",
    feed_url: "https://kun.uz/news/rss",
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
  {
    id: "source-podrobno-uz",
    name: "Podrobno.uz — Новости Узбекистана, урбанистика и недвижимость",
    domain: "podrobno.uz",
    feed_url: "https://podrobno.uz/rss",
    source_type: "rss",
    trust_level: "reputable_media",
    check_frequency_min: 180,
    is_active: true,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
  },
];

async function readFallbackData(): Promise<LocalNewsData> {
  // 1. Cloud persistence fallback: Supabase app_settings (guaranteed across all Vercel Lambdas)
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "news_store_registry")
        .single();

      if (!error && data?.value && typeof data.value === "object") {
        const val = data.value as any;
        const sourcesList: NewsSource[] = Array.isArray(val.sources) && val.sources.length > 0 ? val.sources : [...DEFAULT_SOURCES];
        
        // Ensure all default verified sources exist
        const currentUrls = new Set(sourcesList.map((s) => s.feed_url.toLowerCase().trim()));
        for (const def of DEFAULT_SOURCES) {
          if (!currentUrls.has(def.feed_url.toLowerCase().trim())) {
            sourcesList.push(def);
            currentUrls.add(def.feed_url.toLowerCase().trim());
          }
        }

        return {
          sources: sourcesList,
          news: Array.isArray(val.news) ? val.news : [],
          translations: Array.isArray(val.translations) ? val.translations : [],
          assets: Array.isArray(val.assets) ? val.assets : [],
          publications: Array.isArray(val.publications) ? val.publications : [],
          checks: Array.isArray(val.checks) ? val.checks : [],
        };
      }
    } catch (e: any) {
      console.warn("[NewsStore] Supabase app_settings fallback read notice:", e?.message);
    }
  }

  // 2. Local JSON file store fallback (local dev environment)
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const sourcesList: NewsSource[] = Array.isArray(parsed.sources) && parsed.sources.length > 0 ? parsed.sources : [...DEFAULT_SOURCES];
      const currentUrls = new Set(sourcesList.map((s) => s.feed_url.toLowerCase().trim()));
      for (const def of DEFAULT_SOURCES) {
        if (!currentUrls.has(def.feed_url.toLowerCase().trim())) {
          sourcesList.push(def);
          currentUrls.add(def.feed_url.toLowerCase().trim());
        }
      }

      return {
        sources: sourcesList,
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
    sources: [...DEFAULT_SOURCES],
    news: [],
    translations: [],
    assets: [],
    publications: [],
    checks: [],
  };
}

async function writeFallbackData(data: LocalNewsData): Promise<void> {
  // 1. Cloud persistence fallback: Supabase app_settings (guaranteed across all Vercel Lambdas)
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabaseAdmin.from("app_settings").upsert(
        {
          key: "news_store_registry",
          value: data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
      if (error) {
        console.warn("[NewsStore] Supabase app_settings persist error:", error.message);
      }
    } catch (e: any) {
      console.warn("[NewsStore] Supabase app_settings persist exception:", e?.message);
    }
  }

  // 2. Also mirror to local file if writable (local dev environment)
  try {
    const dir = path.dirname(LOCAL_STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    // Expected on Vercel serverless read-only filesystem
  }
}

export function computeUrlHash(url: string): string {
  const normalized = url.trim().toLowerCase().replace(/\/+$/, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function isTableMissingError(error: any): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (typeof error.message === "string" &&
      (error.message.includes("Could not find the table") ||
        error.message.includes("does not exist") ||
        error.message.includes("schema cache")))
  );
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

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_sources table not yet created in Supabase schema. Using local store fallback.");
        } else {
          console.error("[NewsStore] Supabase getNewsSources error:", error);
          throw new Error(`Failed to fetch news sources from Supabase: ${error.message}`);
        }
      } else {
        let sourcesList = Array.isArray(data) && data.length > 0 ? (data as NewsSource[]) : [];

        if (sourcesList.length === 0) {
          try {
            const { data: seeded, error: seedErr } = await supabaseAdmin
              .from("news_sources")
              .upsert(DEFAULT_SOURCES, { onConflict: "feed_url" })
              .select();
            if (!seedErr && Array.isArray(seeded) && seeded.length > 0) {
              sourcesList = seeded as NewsSource[];
            }
          } catch {}
          if (sourcesList.length === 0) {
            sourcesList = [...DEFAULT_SOURCES];
          }
        }

        // Attach latest check for each source
        try {
          const { data: checks } = await supabaseAdmin
            .from("news_source_checks")
            .select("*")
            .order("checked_at", { ascending: false });

          if (Array.isArray(checks)) {
            const checksMap = new Map<string, any>();
            for (const c of checks) {
              if (!checksMap.has(c.source_id)) {
                checksMap.set(c.source_id, c);
              }
            }
            return sourcesList.map((s) => ({
              ...s,
              last_check: checksMap.get(s.id) || undefined,
            }));
          }
        } catch {}

        return sourcesList;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  return local.sources.map((s) => {
    const latestCheck = local.checks.find((c) => c.source_id === s.id);
    return {
      ...s,
      last_check: latestCheck || undefined,
    };
  });
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

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_sources table not yet in Supabase schema. Saving to local store fallback.");
        } else {
          console.error("[NewsStore] Supabase saveNewsSource error:", error);
          throw new Error(`Failed to save news source to Supabase: ${error.message}`);
        }
      } else if (data) {
        return data as NewsSource;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  const existingIdx = local.sources.findIndex((s) => s.id === id || s.feed_url === source.feed_url);
  if (existingIdx >= 0) {
    local.sources[existingIdx] = { ...local.sources[existingIdx], ...fullSource, updated_at: now };
  } else {
    local.sources.push(fullSource);
  }
  await writeFallbackData(local);
  return fullSource;
}

export async function updateSourceLastChecked(sourceId: string): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabaseAdmin
        .from("news_sources")
        .update({ last_checked_at: now, updated_at: now })
        .eq("id", sourceId);

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_sources table not in Supabase. Updating local store.");
        } else {
          console.error("[NewsStore] Supabase updateSourceLastChecked error:", error);
          throw new Error(`Failed to update source last checked in Supabase: ${error.message}`);
        }
      } else {
        return;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  const src = local.sources.find((s) => s.id === sourceId);
  if (src) {
    src.last_checked_at = now;
    await writeFallbackData(local);
  }
}

/**
 * Idempotently seeds verified default Uzbekistan sources that are missing from the store/database.
 * Never overwrites or duplicates existing sources.
 */
export async function seedDefaultSourcesIfMissing(): Promise<{ added: number; total: number }> {
  const currentSources = await getNewsSources();
  const existingUrls = new Set(currentSources.map((s) => s.feed_url.toLowerCase().trim()));
  let added = 0;

  for (const def of DEFAULT_SOURCES) {
    if (!existingUrls.has(def.feed_url.toLowerCase().trim())) {
      await saveNewsSource(def);
      existingUrls.add(def.feed_url.toLowerCase().trim());
      added++;
    }
  }

  const updatedSources = await getNewsSources();
  return { added, total: updatedSources.length };
}

export async function deleteNewsSource(sourceId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabaseAdmin
        .from("news_sources")
        .delete()
        .eq("id", sourceId);

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_sources table not in Supabase. Deleting from local store.");
        } else {
          console.error("[NewsStore] Supabase deleteNewsSource error:", error);
          throw new Error(`Failed to delete news source from Supabase: ${error.message}`);
        }
      } else {
        return true;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  const initialLen = local.sources.length;
  local.sources = local.sources.filter((s) => s.id !== sourceId);
  if (local.sources.length < initialLen) {
    await writeFallbackData(local);
    return true;
  }
  return false;
}

export async function toggleNewsSourceActive(sourceId: string, isActive: boolean): Promise<NewsSource | null> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("news_sources")
        .update({ is_active: isActive, updated_at: now })
        .eq("id", sourceId)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_sources table not in Supabase. Toggling in local store.");
        } else {
          console.error("[NewsStore] Supabase toggleNewsSourceActive error:", error);
          throw new Error(`Failed to update news source active status: ${error.message}`);
        }
      } else if (data) {
        return data as NewsSource;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  const src = local.sources.find((s) => s.id === sourceId);
  if (src) {
    src.is_active = isActive;
    src.updated_at = now;
    await writeFallbackData(local);
    return src;
  }
  return null;
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
    try {
      const { data, error, count } = await query;

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] real_estate_news table not in Supabase schema yet. Using local store fallback.");
        } else {
          console.error("[NewsStore] Supabase getNewsList error:", error);
          throw new Error(`Failed to fetch news list from Supabase: ${error.message}`);
        }
      } else if (Array.isArray(data)) {
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

        return { items: mapped, total: count ?? mapped.length };
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  // Fallback to local
  const local = await readFallbackData();
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
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] real_estate_news table not in Supabase yet. Checking local store.");
        } else {
          console.error("[NewsStore] Supabase getNewsById error:", error);
          throw new Error(`Failed to fetch news item from Supabase: ${error.message}`);
        }
      } else if (data) {
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
      } else {
        return null;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
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

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] real_estate_news table not in Supabase yet. Checking local store.");
        } else {
          console.error("[NewsStore] Supabase hasNewsWithUrlHash error:", error);
          throw new Error(`Failed to check url hash in Supabase: ${error.message}`);
        }
      } else {
        return Array.isArray(data) && data.length > 0;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
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

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] real_estate_news table not in Supabase yet. Saving to local store.");
        } else {
          console.error("[NewsStore] Supabase saveNewsItem error:", error);
          throw new Error(`Failed to save news item in Supabase: ${error.message}`);
        }
      } else if (data) {
        return data as RealEstateNews;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  const existingIdx = local.news.findIndex((n) => n.id === id || n.url_hash === item.url_hash);
  if (existingIdx >= 0) {
    local.news[existingIdx] = { ...local.news[existingIdx], ...fullItem, updated_at: now };
  } else {
    local.news.push(fullItem);
  }
  await writeFallbackData(local);
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

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] real_estate_news table not in Supabase yet. Updating in local store.");
        } else {
          console.error("[NewsStore] Supabase updateNewsStatus error:", error);
          throw new Error(`Failed to update news status in Supabase: ${error.message}`);
        }
      } else {
        return true;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  const item = local.news.find((n) => n.id === newsId);
  if (item) {
    item.status = status;
    item.updated_at = now;
    await writeFallbackData(local);
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

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_translations table not in Supabase yet. Saving to local store.");
        } else {
          console.error("[NewsStore] Supabase saveNewsTranslation error:", error);
          throw new Error(`Failed to save news translation in Supabase: ${error.message}`);
        }
      } else if (data) {
        return data as NewsTranslation;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  const idx = local.translations.findIndex(
    (t) => t.news_id === translation.news_id && t.language === translation.language
  );
  if (idx >= 0) {
    local.translations[idx] = { ...local.translations[idx], ...fullTrans, updated_at: now };
  } else {
    local.translations.push(fullTrans);
  }
  await writeFallbackData(local);
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

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_assets table not in Supabase yet. Saving to local store.");
        } else {
          console.error("[NewsStore] Supabase saveNewsAsset error:", error);
          throw new Error(`Failed to save news asset in Supabase: ${error.message}`);
        }
      } else if (data) {
        return data as NewsAsset;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  const idx = local.assets.findIndex(
    (a) => a.news_id === asset.news_id && a.language === asset.language
  );
  if (idx >= 0) {
    local.assets[idx] = fullAsset;
  } else {
    local.assets.push(fullAsset);
  }
  await writeFallbackData(local);
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

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_publications table not in Supabase yet. Saving to local store.");
        } else {
          console.error("[NewsStore] Supabase recordNewsPublication error:", error);
          throw new Error(`Failed to record news publication in Supabase: ${error.message}`);
        }
      } else if (data) {
        return data as NewsPublication;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
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
  await writeFallbackData(local);
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
      const { error } = await supabaseAdmin.from("news_source_checks").insert(fullCheck);
      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[NewsStore] news_source_checks table not found in Supabase. Recording check locally.");
        } else {
          console.error("[NewsStore] Supabase recordSourceCheck error:", error);
          throw new Error(`Failed to record news source check in Supabase: ${error.message}`);
        }
      } else {
        return;
      }
    } catch (e: any) {
      if (!isTableMissingError(e)) throw e;
    }
  }

  const local = await readFallbackData();
  local.checks.unshift(fullCheck);
  if (local.checks.length > 100) local.checks.pop();
  await writeFallbackData(local);
}
