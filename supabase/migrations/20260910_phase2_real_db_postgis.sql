-- ==============================================================================
-- ANGREN ESTATE — PHASE 2 PRODUCTION DATABASE SCHEMA WITH POSTGIS
-- Platform: Supabase / PostgreSQL 15+
-- Migration: 20260910_phase2_real_db_postgis.sql
-- Description: PostGIS geographic tables, real properties lifecycle,
--              regions/cities/districts, favorites, analytics events, and strict RLS.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. REGIONS, CITIES & DISTRICTS (Angren Geographic Hierarchy)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.regions (
    id VARCHAR(50) PRIMARY KEY,
    name_uz VARCHAR(100) NOT NULL,
    name_ru VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.regions (id, name_uz, name_ru) VALUES
('toshkent_viloyati', 'Toshkent viloyati', 'Ташкентская область')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cities (
    id VARCHAR(50) PRIMARY KEY,
    region_id VARCHAR(50) REFERENCES public.regions(id) ON DELETE CASCADE,
    name_uz VARCHAR(100) NOT NULL,
    name_ru VARCHAR(100) NOT NULL,
    center_latitude DOUBLE PRECISION NOT NULL DEFAULT 41.0167,
    center_longitude DOUBLE PRECISION NOT NULL DEFAULT 70.1436,
    geom geometry(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.cities (id, region_id, name_uz, name_ru, center_latitude, center_longitude, geom) VALUES
('angren', 'toshkent_viloyati', 'Angren', 'Ангрен', 41.0167, 70.1436, ST_SetSRID(ST_MakePoint(70.1436, 41.0167), 4326))
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.districts (
    id VARCHAR(50) PRIMARY KEY,
    city_id VARCHAR(50) REFERENCES public.cities(id) ON DELETE CASCADE,
    name_uz VARCHAR(100) NOT NULL,
    name_ru VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326),
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.districts (id, city_id, name_uz, name_ru, latitude, longitude, geom, display_order) VALUES
('markaz', 'angren', 'Markaz', 'Центр', 41.0167, 70.1436, ST_SetSRID(ST_MakePoint(70.1436, 41.0167), 4326), 1),
('5-mavze', 'angren', '5-mavze', '5-массив', 41.0125, 70.1380, ST_SetSRID(ST_MakePoint(70.1380, 41.0125), 4326), 2),
('6-mavze', 'angren', '6-mavze', '6-массив', 41.0190, 70.1320, ST_SetSRID(ST_MakePoint(70.1320, 41.0190), 4326), 3),
('7-mavze', 'angren', '7-mavze', '7-массив', 41.0240, 70.1260, ST_SetSRID(ST_MakePoint(70.1260, 41.0240), 4326), 4),
('dukent', 'angren', 'Dukent', 'Дукент', 41.0380, 70.1750, ST_SetSRID(ST_MakePoint(70.1750, 41.0380), 4326), 5),
('geolog', 'angren', 'Geolog', 'Геолог', 41.0080, 70.1550, ST_SetSRID(ST_MakePoint(70.1550, 41.0080), 4326), 6),
('yangiobod', 'angren', 'Yangiobod mavzesi', 'Массив Янгиабад', 41.0420, 70.1080, ST_SetSRID(ST_MakePoint(70.1080, 41.0420), 4326), 7)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 3. PROFILES TABLE (Users & Admins)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150),
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'realtor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. REALTORS TABLE (Verified Local Agents)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.realtors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    telegram VARCHAR(100),
    avatar_url TEXT,
    experience_years INT NOT NULL DEFAULT 1,
    position_uz VARCHAR(100) DEFAULT 'Yetakchi rieltor',
    position_ru VARCHAR(100) DEFAULT 'Ведущий риелтор',
    specialization_uz VARCHAR(200),
    specialization_ru VARCHAR(200),
    districts TEXT[] DEFAULT ARRAY[]::TEXT[],
    bio_uz TEXT,
    bio_ru TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. PROPERTIES TABLE (PostGIS Coordinates, Polygons & Full Lifecycle)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    
    -- Status & Deal Type
    status VARCHAR(20) NOT NULL DEFAULT 'published' 
        CHECK (status IN ('draft', 'published', 'sold', 'rented', 'archived')),
    deal_type VARCHAR(20) NOT NULL 
        CHECK (deal_type IN ('sale', 'rent')),
    property_type VARCHAR(30) NOT NULL 
        CHECK (property_type IN ('apartment', 'house', 'new_build', 'land', 'commercial', 'other')),

    -- Bilingual Content (Uzbek Latin & Russian only)
    title_uz VARCHAR(255) NOT NULL,
    title_ru VARCHAR(255) NOT NULL,
    description_uz TEXT,
    description_ru TEXT,

    -- Pricing
    price NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'UZS' CHECK (currency IN ('UZS', 'USD')),
    price_usd NUMERIC(12, 2),
    price_negotiable BOOLEAN NOT NULL DEFAULT false,

    -- Specs
    area NUMERIC(8, 2) NOT NULL, -- Total Area in sqm
    living_area NUMERIC(8, 2),
    rooms INT NOT NULL DEFAULT 1,
    floors INT DEFAULT 1,        -- Total floors in building
    floor_number INT,            -- Property floor
    renovation VARCHAR(50) DEFAULT 'euro' 
        CHECK (renovation IN ('none', 'cosmetic', 'euro', 'designer')),
    furniture BOOLEAN NOT NULL DEFAULT false,
    parking BOOLEAN NOT NULL DEFAULT false,

    -- Utilities (JSONB / booleans)
    gas BOOLEAN NOT NULL DEFAULT true,
    water BOOLEAN NOT NULL DEFAULT true,
    electricity BOOLEAN NOT NULL DEFAULT true,
    sewerage BOOLEAN NOT NULL DEFAULT true,
    heating BOOLEAN NOT NULL DEFAULT true,

    -- Amenities
    air_conditioning BOOLEAN NOT NULL DEFAULT false,
    elevator BOOLEAN NOT NULL DEFAULT false,
    internet BOOLEAN NOT NULL DEFAULT true,
    balcony BOOLEAN NOT NULL DEFAULT false,

    -- Location & PostGIS Spatial Geometry
    city VARCHAR(50) NOT NULL DEFAULT 'Angren',
    district VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(150),
    address VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326),
    polygon_geom geometry(Polygon, 4326), -- For land and houses
    polygon_coordinates JSONB,           -- Array of [lat, lng] for frontend rendering

    -- Media
    photos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    main_image TEXT,
    video_url TEXT,

    -- Contact & Realtor
    contact_phone VARCHAR(50) NOT NULL,
    telegram VARCHAR(100),
    realtor_id UUID REFERENCES public.realtors(id) ON DELETE SET NULL,

    -- Analytics Counters
    views_count INT NOT NULL DEFAULT 0,
    favorites_count INT NOT NULL DEFAULT 0,
    contacts_count INT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically update geom from latitude and longitude
CREATE OR REPLACE FUNCTION public.update_property_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    NEW.updated_at = NOW();
    IF NEW.status = 'published' AND OLD.status != 'published' THEN
        NEW.published_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_property_geom
BEFORE INSERT OR UPDATE OF latitude, longitude, status ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.update_property_geom();

-- ==============================================================================
-- 6. FAVORITES TABLE (Authenticated User Favorites)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

-- ==============================================================================
-- 7. ANALYTICS EVENTS TABLE (Real Platform Event Tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL, -- page_view, map_view, property_view, search, filter_used, favorite_add, phone_click, telegram_click, share
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(100) NOT NULL,
    device VARCHAR(50) DEFAULT 'Desktop',
    traffic_source VARCHAR(100) DEFAULT 'Direct',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. APP SETTINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 9. SPATIAL & PERFORMANCE INDEXES
-- ==============================================================================
-- PostGIS spatial indexes
CREATE INDEX IF NOT EXISTS idx_properties_geom ON public.properties USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_properties_polygon_geom ON public.properties USING GIST (polygon_geom);
CREATE INDEX IF NOT EXISTS idx_cities_geom ON public.cities USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_districts_geom ON public.districts USING GIST (geom);

-- Status & Deal type index: Public queries query ONLY published properties
CREATE INDEX IF NOT EXISTS idx_properties_published_deal ON public.properties(status, deal_type) WHERE status = 'published';

-- Attribute indexes
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON public.properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_district ON public.properties(district);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON public.properties(neighborhood);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date ON public.analytics_events(event_type, created_at DESC);

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper to verify admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role' OR
    coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'is_admin', 'false') = 'true'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.1 PROPERTIES:
-- Public can read ONLY published properties
CREATE POLICY "Public read published properties"
    ON public.properties FOR SELECT
    USING (status = 'published');

-- Admin full access
CREATE POLICY "Admin full properties access"
    ON public.properties FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 10.2 FAVORITES:
-- Authenticated users manage their own favorites
CREATE POLICY "Users read own favorites"
    ON public.favorites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own favorites"
    ON public.favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own favorites"
    ON public.favorites FOR DELETE
    USING (auth.uid() = user_id);

-- 10.3 ANALYTICS EVENTS:
-- Public can log events
CREATE POLICY "Public insert analytics events"
    ON public.analytics_events FOR INSERT
    WITH CHECK (true);

-- Only admin can read analytics events
CREATE POLICY "Admin read analytics events"
    ON public.analytics_events FOR SELECT
    USING (public.is_admin());

-- 10.4 REALTORS:
-- Public can read active realtors
CREATE POLICY "Public read active realtors"
    ON public.realtors FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admin full realtors access"
    ON public.realtors FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 10.5 APP SETTINGS:
CREATE POLICY "Public read app_settings"
    ON public.app_settings FOR SELECT
    USING (true);

CREATE POLICY "Admin full app_settings access"
    ON public.app_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
