-- ==============================================================================
-- Migration: 20261018_real_estate_news_publishing.sql
-- Description: Schema for Real Estate News & Social Publishing Center
-- Tables:
--   1. news_sources: Trusted news & official RSS/API sources
--   2. real_estate_news: Harvested & curated news articles
--   3. news_translations: Bilingual content (Uzbek Latin & Russian)
--   4. news_assets: Generated brand visuals and assets
--   5. news_publications: Telegram channel and bot broadcast history
--   6. news_source_checks: Health monitoring and sync logs
-- ==============================================================================

-- 1. Table: news_sources
CREATE TABLE IF NOT EXISTS public.news_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    feed_url TEXT NOT NULL UNIQUE,
    source_type VARCHAR(20) NOT NULL DEFAULT 'rss' CHECK (source_type IN ('rss', 'api', 'manual', 'scraper')),
    trust_level VARCHAR(30) NOT NULL DEFAULT 'reputable_media' CHECK (trust_level IN ('official_gov', 'reputable_media', 'analytical_center')),
    check_frequency_min INT NOT NULL DEFAULT 240,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default verified trusted sources (idempotent ON CONFLICT DO NOTHING)
INSERT INTO public.news_sources (name, domain, feed_url, source_type, trust_level, check_frequency_min, is_active)
VALUES
    ('Lex.uz — Qonunchilik maʼlumotlari milliy bazasi', 'lex.uz', 'https://lex.uz/rss', 'rss', 'official_gov', 120, true),
    ('Lex.uz — Законодательство Узбекистана (RU)', 'lex.uz', 'https://lex.uz/ru/rss', 'rss', 'official_gov', 120, true),
    ('O‘zbekiston Respublikasi Markaziy Banki — Ipoteka va moliya', 'cbu.uz', 'https://cbu.uz/uz/press_center/news/rss/', 'rss', 'official_gov', 120, true),
    ('O‘zA — O‘zbekiston Milliy axborot agentligi (Rasmiy davlat xabarlari)', 'uza.uz', 'https://uza.uz/uz/rss', 'rss', 'official_gov', 120, true),
    ('УзА — Официальные новости Узбекистана (RU)', 'uza.uz', 'https://uza.uz/ru/rss', 'rss', 'official_gov', 120, true),
    ('Gazeta.uz — Iqtisodiyot va Ko‘chmas mulk', 'gazeta.uz', 'https://www.gazeta.uz/uz/rss/', 'rss', 'reputable_media', 180, true),
    ('Gazeta.uz — Недвижимость и экономика (RU)', 'gazeta.uz', 'https://www.gazeta.uz/ru/rss/', 'rss', 'reputable_media', 180, true),
    ('Spot.uz — Biznes va Ko‘chmas mulk', 'spot.uz', 'https://www.spot.uz/rss/', 'rss', 'reputable_media', 180, true),
    ('Kun.uz — Iqtisodiyot, qurilish va jamiyat yangiliklari', 'kun.uz', 'https://kun.uz/news/rss', 'rss', 'reputable_media', 180, true),
    ('Daryo.uz — Qurilish va Infratuzilma', 'daryo.uz', 'https://daryo.uz/rss', 'rss', 'reputable_media', 180, true),
    ('Podrobno.uz — Новости Узбекистана, урбанистика и недвижимость', 'podrobno.uz', 'https://podrobno.uz/rss', 'rss', 'reputable_media', 180, true)
ON CONFLICT (feed_url) DO NOTHING;

-- 2. Table: real_estate_news
CREATE TABLE IF NOT EXISTS public.real_estate_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.news_sources(id) ON DELETE SET NULL,
    original_title TEXT NOT NULL,
    original_url TEXT NOT NULL,
    url_hash VARCHAR(64) NOT NULL UNIQUE,
    category VARCHAR(40) NOT NULL DEFAULT 'market_prices' CHECK (
        category IN (
            'market_prices',
            'mortgage_finance',
            'legislation_cadastre',
            'construction_projects',
            'rental_market',
            'taxes_and_fees',
            'useful_tips'
        )
    ),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'discovered' CHECK (
        status IN ('discovered', 'needs_review', 'ready', 'published', 'archived', 'rejected')
    ),
    requires_fact_check BOOLEAN NOT NULL DEFAULT FALSE,
    verified_stat_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ren_status ON public.real_estate_news(status);
CREATE INDEX IF NOT EXISTS idx_ren_category ON public.real_estate_news(category);
CREATE INDEX IF NOT EXISTS idx_ren_published_at ON public.real_estate_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ren_url_hash ON public.real_estate_news(url_hash);

-- 3. Table: news_translations
CREATE TABLE IF NOT EXISTS public.news_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id UUID NOT NULL REFERENCES public.real_estate_news(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL CHECK (language IN ('uz', 'ru')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    practical_takeaway TEXT,
    is_reviewed_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_news_translation_lang UNIQUE (news_id, language)
);

CREATE INDEX IF NOT EXISTS idx_nt_news_id ON public.news_translations(news_id);

-- 4. Table: news_assets
CREATE TABLE IF NOT EXISTS public.news_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id UUID NOT NULL REFERENCES public.real_estate_news(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL CHECK (language IN ('uz', 'ru')),
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    asset_type VARCHAR(20) NOT NULL DEFAULT 'generated_card' CHECK (asset_type IN ('generated_card', 'custom_upload')),
    width INT NOT NULL DEFAULT 1200,
    height INT NOT NULL DEFAULT 675,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_news_asset_lang UNIQUE (news_id, language)
);

CREATE INDEX IF NOT EXISTS idx_na_news_id ON public.news_assets(news_id);

-- 5. Table: news_publications
CREATE TABLE IF NOT EXISTS public.news_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id UUID NOT NULL REFERENCES public.real_estate_news(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('channel', 'bot_broadcast')),
    language VARCHAR(10) NOT NULL CHECK (language IN ('uz', 'ru')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'already_published')),
    telegram_message_id BIGINT,
    recipients_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_news_pub_target UNIQUE (news_id, target_type, language)
);

CREATE INDEX IF NOT EXISTS idx_np_news_id ON public.news_publications(news_id);
CREATE INDEX IF NOT EXISTS idx_np_status ON public.news_publications(status);

-- 6. Table: news_source_checks
CREATE TABLE IF NOT EXISTS public.news_source_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.news_sources(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'empty')),
    items_found INT NOT NULL DEFAULT 0,
    new_items_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nsc_source_id ON public.news_source_checks(source_id);
CREATE INDEX IF NOT EXISTS idx_nsc_checked_at ON public.news_source_checks(checked_at DESC);

-- 7. Row Level Security (RLS)
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_source_checks ENABLE ROW LEVEL SECURITY;

-- Allow public read of published news if desired for public feeds
DROP POLICY IF EXISTS "Public can view published news" ON public.real_estate_news;
CREATE POLICY "Public can view published news"
    ON public.real_estate_news
    FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

DROP POLICY IF EXISTS "Public can view translations of published news" ON public.news_translations;
CREATE POLICY "Public can view translations of published news"
    ON public.news_translations
    FOR SELECT
    TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM public.real_estate_news n
        WHERE n.id = news_translations.news_id AND n.status = 'published'
    ));

-- Service role full access for all tables
DROP POLICY IF EXISTS "Service role full access on news_sources" ON public.news_sources;
CREATE POLICY "Service role full access on news_sources" ON public.news_sources FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on real_estate_news" ON public.real_estate_news;
CREATE POLICY "Service role full access on real_estate_news" ON public.real_estate_news FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on news_translations" ON public.news_translations;
CREATE POLICY "Service role full access on news_translations" ON public.news_translations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on news_assets" ON public.news_assets;
CREATE POLICY "Service role full access on news_assets" ON public.news_assets FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on news_publications" ON public.news_publications;
CREATE POLICY "Service role full access on news_publications" ON public.news_publications FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on news_source_checks" ON public.news_source_checks;
CREATE POLICY "Service role full access on news_source_checks" ON public.news_source_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
