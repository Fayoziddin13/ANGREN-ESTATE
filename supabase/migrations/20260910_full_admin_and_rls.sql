-- ==============================================================================
-- ANGREN ESTATE — PRODUCTION DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Platform: Supabase / PostgreSQL 15+
-- Migration: 20260910_full_admin_and_rls.sql
-- Description: Full schema for properties, realtors, admin_users, leads, site_content,
--              site_settings with strict public vs admin separation and RLS.
-- ==============================================================================

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ADMIN USERS TABLE (Dedicated Admin Credentials — NEVER Google OAuth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin', 'editor')),
    full_name VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(45),
    failed_attempts INT NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default initial admin (Password: [REDACTED_SEED_PLACEHOLDER])
-- Note: Replace password hash in production via environment migration
INSERT INTO public.admin_users (
    email, username, password_hash, salt, role, full_name
) VALUES (
    'admin@angrenestate.uz',
    'admin',
    -- PBKDF2 / SHA-512 representation or pgcrypto crypt
    crypt('[REDACTED_SEED_PLACEHOLDER]', gen_salt('bf', 10)),
    'a1b2c3d4e5f67890',
    'superadmin',
    'Bosh Administrator'
) ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- 2. REALTORS TABLE (Verified Local Angren Estate Agents)
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

-- Seed initial realtors
INSERT INTO public.realtors (
    name, phone, telegram, experience_years, specialization_uz, specialization_ru, districts, display_order, is_active
) VALUES 
('Jasur Alimov', '+998 90 123 45 67', '@jasur_angren_estate', 7, 'Kvartiralar va yangi binolar bo‘yicha ekspert', 'Эксперт по квартирам и новостройкам', ARRAY['Markaz', '5/1 dahasi'], 1, true),
('Dilnoza Karimova', '+998 93 987 65 43', '@dilnoza_estate', 5, 'Kottejlar, hovlilar va yer maydonlari mutaxassisi', 'Специалист по домам, коттеджам и участкам', ARRAY['Dukent', 'Yangiobod'], 2, true),
('Rustam Zokirov', '+998 94 555 12 34', '@rustam_realtor_angren', 9, 'Tijorat ko‘chmas mulki va ijaraga berish', 'Коммерческая недвижимость и аренда бизнеса', ARRAY['Markaz', 'Shahar atrofi'], 3, true)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 3. PROPERTIES TABLE (Map-First Objects in Angren)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title_uz VARCHAR(255) NOT NULL,
    title_ru VARCHAR(255) NOT NULL,
    description_uz TEXT,
    description_ru TEXT,
    deal_type VARCHAR(20) NOT NULL CHECK (deal_type IN ('sale', 'rent')),
    property_type VARCHAR(30) NOT NULL CHECK (property_type IN ('apartment', 'house', 'commercial', 'land')),
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'sold', 'rented', 'archived')),
    
    -- Financials
    price_uzs NUMERIC(15, 2) NOT NULL,
    price_usd NUMERIC(12, 2) NOT NULL,
    price_negotiable BOOLEAN NOT NULL DEFAULT false,
    
    -- Map Coordinates & Area
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    district VARCHAR(100) NOT NULL,
    address_uz VARCHAR(255) NOT NULL,
    address_ru VARCHAR(255) NOT NULL,
    landmark_uz VARCHAR(255),
    landmark_ru VARCHAR(255),
    polygon JSONB, -- Optional polygon boundary for land / commercial
    
    -- Specifications
    area_sqm NUMERIC(8, 2) NOT NULL,
    living_area_sqm NUMERIC(8, 2),
    rooms INT NOT NULL DEFAULT 1,
    floor INT,
    total_floors INT,
    condition VARCHAR(50) DEFAULT 'euro' CHECK (condition IN ('euro', 'good', 'medium', 'repair_needed', 'rough_finish')),
    year_built INT,
    
    -- Media & Realtor Assignment
    images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    featured BOOLEAN NOT NULL DEFAULT false,
    realtor_id UUID REFERENCES public.realtors(id) ON DELETE SET NULL,
    
    -- Analytics Counters
    views_count INT NOT NULL DEFAULT 0,
    favorites_count INT NOT NULL DEFAULT 0,
    contacts_count INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. LEADS & CONTACT INQUIRIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('phone', 'telegram', 'form')),
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    property_title VARCHAR(255),
    client_name VARCHAR(150),
    client_phone VARCHAR(50),
    client_telegram VARCHAR(100),
    message TEXT,
    device VARCHAR(50) DEFAULT 'Mobile',
    traffic_source VARCHAR(100) DEFAULT 'Direct',
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'closed')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. SITE CONTENT & CMS TABLE (Bilingual UZ/RU)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.site_content (
    key VARCHAR(100) PRIMARY KEY,
    value_uz TEXT NOT NULL,
    value_ru TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial CMS Content
INSERT INTO public.site_content (key, value_uz, value_ru) VALUES
('hero_title', 'Angrendagi ko‘chmas mulk — bir xaritada', 'Недвижимость Ангрена — на одной карте'),
('hero_subtitle', 'Kvartiralar, hovlilar va tijorat binolarini shahar xaritasida qulay toping', 'Удобный поиск квартир, домов и коммерческой недвижимости на карте города'),
('about_headline', 'Angren ko‘chmas mulk bozorining yangi standarti', 'Новый стандарт рынка недвижимости Ангрена'),
('about_p1', 'ANGREN ESTATE — Angren shahridagi ko‘chmas mulkni topish, sotish va ijaraga berishni qulay, tushunarli va ishonchli qilish uchun yaratilgan zamonaviy platforma.', 'ANGREN ESTATE — современная платформа, созданная для того, чтобы сделать поиск, продажу и аренду недвижимости в Ангрене удобным, понятным и надежным.')
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- 6. SITE SETTINGS TABLE (Global Key-Value Configuration)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.site_settings (key, value) VALUES
('map_config', '{"center_lat": 41.0167, "center_lng": 70.1436, "default_zoom": 13, "default_style": "standard"}'::JSONB),
('contact_info', '{"phone": "+998 70 665 00 11", "telegram": "@angrenestate_admin", "email": "info@angrenestate.uz"}'::JSONB),
('exchange_rates', '{"usd_to_uzs": 12850, "auto_update": false}'::JSONB)
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- 7. PERFORMANCE INDEXES
-- ==============================================================================
-- Spatial & Coordinates Index
CREATE INDEX IF NOT EXISTS idx_properties_coordinates ON public.properties(latitude, longitude);

-- District & Deal Type Search Index
CREATE INDEX IF NOT EXISTS idx_properties_district ON public.properties(district);
CREATE INDEX IF NOT EXISTS idx_properties_deal_type ON public.properties(deal_type);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON public.properties(property_type);

-- Status Composite Index (Public queries filter status = 'published')
CREATE INDEX IF NOT EXISTS idx_properties_published ON public.properties(status, deal_type) WHERE status = 'published';

-- Price Sorting Indexes
CREATE INDEX IF NOT EXISTS idx_properties_price_uzs ON public.properties(price_uzs);
CREATE INDEX IF NOT EXISTS idx_properties_price_usd ON public.properties(price_usd);

-- Leads Status & Created Date Index
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status, created_at DESC);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to verify admin claims (Works with Supabase JWT role or server role)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role' OR
    coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'is_admin', 'false') = 'true'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.1 PROPERTIES POLICIES:
-- Public can ONLY view published properties
CREATE POLICY "Public users can view published properties"
    ON public.properties
    FOR SELECT
    USING (status = 'published');

-- Admins have FULL access (SELECT all statuses, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins have full access to properties"
    ON public.properties
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8.2 REALTORS POLICIES:
-- Public can view active realtors
CREATE POLICY "Public users can view active realtors"
    ON public.realtors
    FOR SELECT
    USING (is_active = true);

-- Admins have full access to realtors
CREATE POLICY "Admins have full access to realtors"
    ON public.realtors
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8.3 LEADS POLICIES:
-- Anyone (public visitors) can submit leads
CREATE POLICY "Public users can submit leads"
    ON public.leads
    FOR INSERT
    WITH CHECK (true);

-- ONLY admins can view or modify leads
CREATE POLICY "Only admins can view and manage leads"
    ON public.leads
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8.4 ADMIN USERS POLICIES:
-- Strictly restricted to admins only (ZERO public access)
CREATE POLICY "Only admins can access admin_users"
    ON public.admin_users
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8.5 SITE CONTENT & SETTINGS POLICIES:
-- Public can read content & settings
CREATE POLICY "Public can read site_content"
    ON public.site_content
    FOR SELECT
    USING (true);

CREATE POLICY "Public can read site_settings"
    ON public.site_settings
    FOR SELECT
    USING (true);

-- Admins can update content & settings
CREATE POLICY "Admins can manage site_content"
    ON public.site_content
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can manage site_settings"
    ON public.site_settings
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
