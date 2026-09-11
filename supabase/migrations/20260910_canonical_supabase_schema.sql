-- ==============================================================================
-- ANGREN ESTATE — CANONICAL PRODUCTION SUPABASE SCHEMA WITH POSTGIS & RLS
-- Platform: Supabase / PostgreSQL 15+
-- Migration: 20260910_canonical_supabase_schema.sql
-- Description: Complete production schema for Angren Estate real-estate platform.
--              Includes PostGIS spatial types, bilingual properties, profiles,
--              realtors, favorites, analytics_events, app_settings, geographic hierarchy,
--              and strict Row Level Security (RLS) policies.
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
-- 3. PROFILES TABLE (End Users and Administrators)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Seed initial Angren realtors
INSERT INTO public.realtors (
    id, name, phone, telegram, experience_years, specialization_uz, specialization_ru, districts, display_order, is_active
) VALUES 
('00000000-0000-0000-0000-000000000001', 'Jasur Alimov', '+998 90 123 45 67', '@jasur_angren_estate', 7, 'Kvartiralar va yangi binolar bo‘yicha ekspert', 'Эксперт по квартирам и новостройкам', ARRAY['Markaz', '5/1 dahasi'], 1, true),
('00000000-0000-0000-0000-000000000002', 'Dilnoza Karimova', '+998 93 987 65 43', '@dilnoza_estate', 5, 'Kottejlar, hovlilar va yer maydonlari mutaxassisi', 'Специалист по домам, коттеджам и участкам', ARRAY['Dukent', 'Yangiobod'], 2, true),
('00000000-0000-0000-0000-000000000003', 'Rustam Zokirov', '+998 94 555 12 34', '@rustam_realtor_angren', 9, 'Tijorat ko‘chmas mulki va ijaraga berish', 'Коммерческая недвижимость и аренда бизнеса', ARRAY['Markaz', 'Shahar atrofi'], 3, true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 5. PROPERTIES TABLE (Canonical Properties with PostGIS Geometries)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
    id VARCHAR(100) PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    
    -- Status & Lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'published' 
        CHECK (status IN ('draft', 'published', 'sold', 'rented', 'archived')),
    deal_type VARCHAR(20) NOT NULL 
        CHECK (deal_type IN ('sale', 'rent')),
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'sale'
        CHECK (transaction_type IN ('sale', 'rent')),
    property_type VARCHAR(30) NOT NULL 
        CHECK (property_type IN ('apartment', 'house', 'house_yard', 'new_build', 'land', 'commercial', 'other')),

    -- Bilingual Content (Uzbek Latin & Russian)
    title_uz VARCHAR(255) NOT NULL,
    title_ru VARCHAR(255) NOT NULL,
    description_uz TEXT,
    description_ru TEXT,

    -- Financial Details
    price NUMERIC(15, 2) NOT NULL,
    price_uzs NUMERIC(15, 2) NOT NULL,
    price_usd NUMERIC(12, 2),
    currency VARCHAR(10) NOT NULL DEFAULT 'UZS' CHECK (currency IN ('UZS', 'USD')),
    price_negotiable BOOLEAN NOT NULL DEFAULT false,

    -- Specifications
    area NUMERIC(8, 2) NOT NULL,
    area_sqm NUMERIC(8, 2) NOT NULL,
    living_area NUMERIC(8, 2),
    living_area_sqm NUMERIC(8, 2),
    area_sotikh NUMERIC(6, 2),
    rooms INT NOT NULL DEFAULT 1,
    bathrooms INT DEFAULT 1,
    floors INT DEFAULT 1,
    floor INT DEFAULT 1,
    floor_number INT,
    total_floors INT,
    renovation VARCHAR(50) DEFAULT 'euro' 
        CHECK (renovation IN ('none', 'cosmetic', 'euro', 'designer')),
    furniture BOOLEAN NOT NULL DEFAULT false,
    parking BOOLEAN NOT NULL DEFAULT false,

    -- Utilities (Boolean flags + JSONB)
    gas BOOLEAN NOT NULL DEFAULT true,
    water BOOLEAN NOT NULL DEFAULT true,
    electricity BOOLEAN NOT NULL DEFAULT true,
    sewerage BOOLEAN NOT NULL DEFAULT true,
    heating BOOLEAN NOT NULL DEFAULT true,
    utilities JSONB NOT NULL DEFAULT '{"gas":true,"water":true,"electricity":true,"sewerage":true,"heating":true}'::JSONB,

    -- Amenities
    air_conditioning BOOLEAN NOT NULL DEFAULT false,
    elevator BOOLEAN NOT NULL DEFAULT false,
    internet BOOLEAN NOT NULL DEFAULT true,
    balcony BOOLEAN NOT NULL DEFAULT false,
    amenities JSONB NOT NULL DEFAULT '{"furniture":false,"parking":false,"elevator":false,"ac":false,"balcony":false,"internet":true}'::JSONB,

    -- Address and Location
    city VARCHAR(50) NOT NULL DEFAULT 'Angren',
    district VARCHAR(100) NOT NULL,
    district_name_uz VARCHAR(100),
    district_name_ru VARCHAR(100),
    neighborhood VARCHAR(150),
    address VARCHAR(255) NOT NULL,
    address_uz VARCHAR(255),
    address_ru VARCHAR(255),

    -- Geographic & PostGIS Spatial Data
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom geometry(Point, 4326),
    polygon_geom geometry(Polygon, 4326),
    polygon_coordinates JSONB,

    -- Media
    photos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    main_image TEXT,
    video_url TEXT,

    -- Contact & Realtor
    contact_phone VARCHAR(50) NOT NULL,
    contact_telegram VARCHAR(100),
    telegram VARCHAR(100),
    realtor_id UUID REFERENCES public.realtors(id) ON DELETE SET NULL,

    -- Analytics Counters
    views_count INT NOT NULL DEFAULT 0,
    favorites_count INT NOT NULL DEFAULT 0,
    contacts_count INT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- Trigger: Automatically update PostGIS Point geometry & published_at
CREATE OR REPLACE FUNCTION public.update_property_spatial()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    NEW.updated_at = NOW();
    IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
        NEW.published_at = NOW();
    END IF;
    -- Synchronize aliases
    NEW.deal_type = COALESCE(NEW.deal_type, NEW.transaction_type);
    NEW.transaction_type = COALESCE(NEW.transaction_type, NEW.deal_type);
    NEW.price = COALESCE(NEW.price, NEW.price_uzs);
    NEW.price_uzs = COALESCE(NEW.price_uzs, NEW.price);
    NEW.area = COALESCE(NEW.area, NEW.area_sqm);
    NEW.area_sqm = COALESCE(NEW.area_sqm, NEW.area);
    NEW.address = COALESCE(NEW.address, NEW.address_uz);
    NEW.address_uz = COALESCE(NEW.address_uz, NEW.address);
    NEW.photos = COALESCE(NEW.photos, NEW.images);
    NEW.images = COALESCE(NEW.images, NEW.photos);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_spatial ON public.properties;
CREATE TRIGGER trg_property_spatial
BEFORE INSERT OR UPDATE OF latitude, longitude, status, deal_type, price, area ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.update_property_spatial();

-- ==============================================================================
-- 6. FAVORITES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    property_id VARCHAR(100) NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

-- ==============================================================================
-- 7. ANALYTICS EVENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    property_id VARCHAR(100) REFERENCES public.properties(id) ON DELETE SET NULL,
    user_id UUID,
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
CREATE INDEX IF NOT EXISTS idx_properties_geom ON public.properties USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_properties_polygon_geom ON public.properties USING GIST (polygon_geom);
CREATE INDEX IF NOT EXISTS idx_properties_published ON public.properties(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_properties_deal_status ON public.properties(deal_type, status);
CREATE INDEX IF NOT EXISTS idx_properties_type_status ON public.properties(property_type, status);
CREATE INDEX IF NOT EXISTS idx_properties_district ON public.properties(district);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date ON public.analytics_events(event_type, created_at DESC);

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper to check if current request has admin or service role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role' OR
    coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'is_admin', 'false') = 'true' OR
    coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '') = 'admin@angrenestate.uz'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.1 PROPERTIES:
-- Public can read ONLY published properties
DROP POLICY IF EXISTS "Public read published properties" ON public.properties;
CREATE POLICY "Public read published properties"
    ON public.properties FOR SELECT
    USING (status = 'published');

-- Admin and service role have full CRUD access
DROP POLICY IF EXISTS "Admin full properties access" ON public.properties;
CREATE POLICY "Admin full properties access"
    ON public.properties FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 10.2 REALTORS:
DROP POLICY IF EXISTS "Public read active realtors" ON public.realtors;
CREATE POLICY "Public read active realtors"
    ON public.realtors FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Admin full realtors access" ON public.realtors;
CREATE POLICY "Admin full realtors access"
    ON public.realtors FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 10.3 FAVORITES:
DROP POLICY IF EXISTS "Users read own favorites" ON public.favorites;
CREATE POLICY "Users read own favorites"
    ON public.favorites FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
CREATE POLICY "Users manage own favorites"
    ON public.favorites FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 10.4 ANALYTICS EVENTS:
DROP POLICY IF EXISTS "Public insert analytics events" ON public.analytics_events;
CREATE POLICY "Public insert analytics events"
    ON public.analytics_events FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admin read analytics events" ON public.analytics_events;
CREATE POLICY "Admin read analytics events"
    ON public.analytics_events FOR SELECT
    USING (public.is_admin());

-- 10.5 APP SETTINGS:
DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;
CREATE POLICY "Public read app_settings"
    ON public.app_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admin full app_settings access" ON public.app_settings;
CREATE POLICY "Admin full app_settings access"
    ON public.app_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==============================================================================
-- 11. INITIAL SEED: Real Angren Properties for Production DB
-- ==============================================================================
INSERT INTO public.properties (
    id, slug, status, deal_type, transaction_type, property_type,
    title_uz, title_ru, description_uz, description_ru,
    price, price_uzs, price_usd, currency,
    area, area_sqm, living_area, living_area_sqm, rooms, bathrooms, floor, floor_number, total_floors, floors,
    renovation, furniture, parking,
    gas, water, electricity, sewerage, heating,
    air_conditioning, elevator, internet, balcony,
    city, district, district_name_uz, district_name_ru, neighborhood, address, address_uz, address_ru,
    latitude, longitude, photos, images,
    contact_phone, contact_telegram, views_count, favorites_count, contacts_count
) VALUES
(
    'prop-1',
    '3-xonali-kvartira-6-mavze',
    'published', 'sale', 'sale', 'apartment',
    '3 xonali shinam kvartira, 6-mavze', '3-комнатная квартира, 6-й микрорайон',
    'Angren shahrining 6-mavzesida joylashgan yorug‘ va qulay kvartira. Yevro ta''mirlangan, barcha qulayliklar mavjud.',
    'Светлая и удобная квартира в 6-м микрорайоне Ангрена. Евроремонт, все коммуникации подключены, отличная планировка.',
    520000000, 520000000, 40625, 'UZS',
    72, 72, 56, 56, 3, 1, 3, 3, 5, 5,
    'euro', true, true,
    true, true, true, true, true,
    true, false, true, true,
    'Angren', '6-mavze', '6-mavze', '6-й микрорайон', '6-mavze', 'Angren, 6-mavze, 14-uy', 'Angren, 6-mavze, 14-uy', 'Ангрен, 6-й микрорайон, дом 14',
    41.0182, 70.1415,
    ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80'],
    ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80'],
    '+998 90 123 45 67', '@angren_estate_admin', 185, 14, 9
),
(
    'prop-2',
    '2-xonali-ijara-markaz',
    'published', 'rent', 'rent', 'apartment',
    '2 xonali zamonaviy kvartira (Ijara)', '2-комнатная квартира в центре (Аренда)',
    'Angren markazida uzoq muddatga ijaraga beriladigan shinam, yangi jihozlangan kvartira.',
    'Долгосрочная аренда уютной 2-комнатной квартиры в центре Ангрена. Вся необходимая мебель и бытовая техника.',
    2500000, 2500000, 195, 'UZS',
    56, 56, 42, 42, 2, 1, 4, 4, 9, 9,
    'designer', true, true,
    true, true, true, true, true,
    true, true, true, true,
    'Angren', 'Markaz', 'Markaz', 'Центр', 'Markaz', 'Angren, Mustaqillik shoh ko‘chasi, 22-uy', 'Angren, Mustaqillik shoh ko‘chasi, 22-uy', 'Ангрен, проспект Мустакиллик, д. 22',
    41.0125, 70.1384,
    ARRAY['https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80'],
    ARRAY['https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80'],
    '+998 93 555 12 34', '@angren_estate_admin', 220, 19, 12
),
(
    'prop-3',
    'zamonaviy-xususiy-uy-dukent',
    'sold', 'sale', 'sale', 'house_yard',
    'Zamonaviy xususiy hovli-uy (Sotilgan)', 'Частный дом в Дукенте (Продан)',
    'Toza havo, 6 sotix yer, pishiq g‘ishtli zamonaviy fasadli shinam hovli.',
    'Добротный современный дом на участке 6 соток. Просторный двор, панорамные окна, все коммуникации подключены.',
    850000000, 850000000, 66406, 'UZS',
    120, 120, 95, 95, 4, 2, 1, 1, 1, 1,
    'euro', false, true,
    true, true, true, true, true,
    true, false, true, false,
    'Angren', 'Dukent', 'Dukent', 'Дукент', 'Dukent', 'Angren, Dukent massivi, 15-uy', 'Angren, Dukent massivi, 15-uy', 'Ангрен, массив Дукент, дом 15',
    41.0412, 70.1654,
    ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80'],
    ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80'],
    '+998 90 987 65 43', '@angren_estate_admin', 240, 22, 15
),
(
    'prop-5',
    'tijorat-markaz-arenda',
    'published', 'rent', 'rent', 'commercial',
    'Angren markazida tijorat binosi', 'Коммерческое помещение в центре',
    'Aholisi gavjum ko‘chada, birinchi qavatda joylashgan shinam tijorat joyi. Do‘kon yoki ofis uchun tayyor.',
    'Отличное коммерческое помещение на первой линии в центре Ангрена. Высокий пешеходный трафик, евроремонт.',
    12000000, 12000000, 937, 'UZS',
    140, 140, 120, 120, 3, 1, 1, 1, 4, 4,
    'euro', false, true,
    true, true, true, true, true,
    true, false, true, false,
    'Angren', 'Markaz', 'Markaz', 'Центр', 'Markaz', 'Angren, Mustaqillik shoh ko‘chasi, 5-bino', 'Angren, Mustaqillik shoh ko‘chasi, 5-bino', 'Ангрен, проспект Мустакиллик, здание 5',
    41.0160, 70.1450,
    ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80'],
    ARRAY['https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80'],
    '+998 91 222 33 44', '@angren_estate_admin', 310, 27, 18
),
(
    'prop-6',
    '3-xonali-yangi-bino-5-mavze',
    'published', 'sale', 'sale', 'apartment',
    '3 xonali shinam xonadon, 5-mavze', '3-комнатная квартира, 5-й микрорайон',
    'Angren 5-mavzesida joylashgan sokin va shinam kvartira. Maktab, bog‘cha va bozor yaqinida.',
    'Уютная 3-комнатная квартира в 5-м микрорайоне Ангрена. Рядом школа, детский сад, транспортная развязка.',
    380000000, 380000000, 29687, 'UZS',
    65, 65, 50, 50, 3, 1, 2, 2, 5, 5,
    'cosmetic', true, true,
    true, true, true, true, true,
    true, false, true, true,
    'Angren', '5-mavze', '5-mavze', '5-й микрорайон', '5-mavze', 'Angren, 5-mavze, 31-uy', 'Angren, 5-mavze, 31-uy', 'Ангрен, 5-й микрорайон, д. 31',
    41.0220, 70.1330,
    ARRAY['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80'],
    ARRAY['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80'],
    '+998 94 444 55 66', '@angren_estate_admin', 145, 9, 6
),
(
    'prop-4',
    '2-xonali-kvartira-7-mavze',
    'rented', 'rent', 'rent', 'apartment',
    '2 xonali yangi kvartira, 7-mavze (Ijaraga berildi)', '2-комнатная квартира, 7-й микрорайон (Сдана)',
    '7-mavzeda yangi ta''mirlangan qulay va shinam kvartira.',
    'Качественная 2-комнатная квартира в 7-м микрорайоне. Новый ремонт, чистый подъезд.',
    2000000, 2000000, 156, 'UZS',
    54, 54, 40, 40, 2, 1, 5, 5, 9, 9,
    'euro', true, true,
    true, true, true, true, true,
    true, true, false, true,
    'Angren', '7-mavze', '7-mavze', '7-й микрорайон', '7-mavze', 'Angren, 7-mavze, 8-uy', 'Angren, 7-mavze, 8-uy', 'Ангрен, 7-й микрорайон, д. 8',
    41.0289, 70.1523,
    ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80'],
    ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80'],
    '+998 90 777 88 99', '@angren_estate_admin', 175, 11, 8
),
(
    'prop-draft-sample-1',
    'yangi-bino-qurilish-bosqichida',
    'draft', 'sale', 'sale', 'new_build',
    'Angren markazida yangi turar-joy majmuasi (Loyiha)', 'Новый жилой комплекс в центре Ангрена (Проект)',
    'Zamonaviy arxitektura, qulay infratuzilma va keng hovli. Hozirda rejalashtirish bosqichida.',
    'Современная архитектура, удобная инфраструктура и просторный двор. На стадии планирования.',
    480000000, 480000000, 37500, 'UZS',
    72, 72, 54, 54, 3, 1, 4, 4, 9, 9,
    'none', false, true,
    true, true, true, true, true,
    false, true, true, false,
    'Angren', 'Markaz', 'Markaz', 'Центр', 'Markaz', 'Mustaqillik ko‘chasi, 24-uy', 'Mustaqillik ko‘chasi, 24-uy', 'ул. Мустакиллик, д. 24',
    41.0180, 70.1470,
    ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80'],
    ARRAY['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80'],
    '+998 90 123 45 67', '@angren_estate_admin', 14, 1, 0
),
(
    'prop-archived-sample-2',
    'arxividagi-eski-tijorat-binosi',
    'archived', 'sale', 'sale', 'commercial',
    'Eski avtobaza binosi (Arxivlangan)', 'Здание бывшей автобазы (В архиве)',
    'Tijorat maqsadlarida sotilgan va arxivga ko‘chirilgan obyekt.',
    'Объект продан под коммерческие цели и отправлен в архив.',
    1200000000, 1200000000, 94000, 'UZS',
    450, 450, 400, 400, 5, 2, 1, 1, 1, 1,
    'none', false, true,
    true, true, false, false, false,
    false, false, false, false,
    'Angren', 'Dukent', 'Dukent', 'Дукент', 'Dukent', 'Sanoat zonasi, 8-bino', 'Sanoat zonasi, 8-bino', 'Промзона, здание 8',
    41.0350, 70.1800,
    ARRAY['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80'],
    ARRAY['https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80'],
    '+998 90 123 45 67', '@angren_estate_admin', 310, 8, 19
)
ON CONFLICT (id) DO NOTHING;
