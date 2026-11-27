-- ==============================================================================
-- ANGREN ESTATE — production schema baseline (TEST PROJECT ONLY)
--
-- Read-only snapshot of the production `public` schema taken 2026-11-26 from the
-- catalog (no data). It recreates the production structure in the separate test
-- Supabase project so new migrations are tested against what production really has
-- (the repo's historical migrations disagree with each other and with production).
--
-- NEVER apply this file to production: production already has these objects.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------- geography ---
CREATE TABLE public.regions (
  id varchar PRIMARY KEY,
  name_uz varchar NOT NULL,
  name_ru varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cities (
  id varchar PRIMARY KEY,
  region_id varchar REFERENCES public.regions(id),
  name_uz varchar NOT NULL,
  name_ru varchar NOT NULL,
  center_latitude double precision NOT NULL DEFAULT 41.0167,
  center_longitude double precision NOT NULL DEFAULT 70.1436,
  geom geometry,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.districts (
  id varchar PRIMARY KEY,
  city_id varchar REFERENCES public.cities(id),
  name_uz varchar NOT NULL,
  name_ru varchar NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geom geometry,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- profiles ---
-- Note: production profiles has NO status / phone / telegram columns.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email varchar NOT NULL UNIQUE,
  full_name varchar,
  avatar_url text,
  role varchar NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'realtor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.realtors (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name varchar NOT NULL,
  phone varchar NOT NULL,
  telegram varchar,
  avatar_url text,
  experience_years integer NOT NULL DEFAULT 1,
  position_uz varchar DEFAULT 'Yetakchi rieltor',
  position_ru varchar DEFAULT 'Ведущий риелтор',
  specialization_uz varchar,
  specialization_ru varchar,
  districts text[] DEFAULT ARRAY[]::text[],
  bio_uz text,
  bio_ru text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------- properties ---
CREATE TABLE public.properties (
  id varchar PRIMARY KEY,
  slug varchar NOT NULL UNIQUE,
  status varchar NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'sold', 'rented', 'archived')),
  deal_type varchar NOT NULL CHECK (deal_type IN ('sale', 'rent')),
  transaction_type varchar NOT NULL DEFAULT 'sale' CHECK (transaction_type IN ('sale', 'rent')),
  property_type varchar NOT NULL
    CHECK (property_type IN ('apartment', 'house', 'house_yard', 'new_build', 'land', 'commercial', 'other')),
  title_uz varchar NOT NULL,
  title_ru varchar NOT NULL,
  description_uz text,
  description_ru text,
  price numeric NOT NULL,
  price_uzs numeric NOT NULL,
  price_usd numeric,
  currency varchar NOT NULL DEFAULT 'UZS' CHECK (currency IN ('UZS', 'USD')),
  price_negotiable boolean NOT NULL DEFAULT false,
  area numeric NOT NULL,
  area_sqm numeric NOT NULL,
  living_area numeric,
  living_area_sqm numeric,
  area_sotikh numeric,
  rooms integer NOT NULL DEFAULT 1,
  bathrooms integer DEFAULT 1,
  floors integer DEFAULT 1,
  floor integer DEFAULT 1,
  floor_number integer,
  total_floors integer,
  renovation varchar DEFAULT 'euro' CHECK (renovation IN ('none', 'cosmetic', 'euro', 'designer')),
  furniture boolean NOT NULL DEFAULT false,
  parking boolean NOT NULL DEFAULT false,
  gas boolean NOT NULL DEFAULT true,
  water boolean NOT NULL DEFAULT true,
  electricity boolean NOT NULL DEFAULT true,
  sewerage boolean NOT NULL DEFAULT true,
  heating boolean NOT NULL DEFAULT true,
  utilities jsonb NOT NULL DEFAULT '{"gas": true, "water": true, "heating": true, "sewerage": true, "electricity": true}'::jsonb,
  air_conditioning boolean NOT NULL DEFAULT false,
  elevator boolean NOT NULL DEFAULT false,
  internet boolean NOT NULL DEFAULT true,
  balcony boolean NOT NULL DEFAULT false,
  amenities jsonb NOT NULL DEFAULT '{"ac": false, "balcony": false, "parking": false, "elevator": false, "internet": true, "furniture": false}'::jsonb,
  city varchar NOT NULL DEFAULT 'Angren',
  district varchar NOT NULL,
  district_name_uz varchar,
  district_name_ru varchar,
  neighborhood varchar,
  address varchar NOT NULL,
  address_uz varchar,
  address_ru varchar,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geom geometry,
  polygon_geom geometry,
  polygon_coordinates jsonb,
  photos text[] NOT NULL DEFAULT ARRAY[]::text[],
  images text[] NOT NULL DEFAULT ARRAY[]::text[],
  main_image text,
  video_url text,
  contact_phone varchar NOT NULL,
  contact_telegram varchar,
  telegram varchar,
  realtor_id uuid REFERENCES public.realtors(id),
  views_count integer NOT NULL DEFAULT 0,
  favorites_count integer NOT NULL DEFAULT 0,
  contacts_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  property_id varchar NOT NULL REFERENCES public.properties(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_type varchar NOT NULL,
  property_id varchar REFERENCES public.properties(id),
  user_id uuid,
  session_id varchar NOT NULL,
  device varchar DEFAULT 'Desktop',
  traffic_source varchar DEFAULT 'Direct',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_settings (
  key varchar PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id varchar REFERENCES public.properties(id),
  realtor_id uuid REFERENCES public.realtors(id),
  type text NOT NULL CHECK (type IN ('phone', 'telegram', 'inquiry')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'in_progress', 'completed', 'cancelled')),
  property_title text,
  property_slug text,
  client_name text,
  client_phone text,
  message text,
  notes text,
  device text DEFAULT 'Desktop',
  traffic_source text DEFAULT 'Direct',
  session_id text,
  ip_hash text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL
);

-- ------------------------------------------------------------------ indexes ---
CREATE INDEX idx_rate_limits_reset ON public.rate_limits (reset_at);
CREATE INDEX idx_favorites_user ON public.favorites (user_id);
CREATE INDEX idx_analytics_events_type_date ON public.analytics_events (event_type, created_at DESC);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events (created_at DESC);
CREATE INDEX idx_analytics_events_session ON public.analytics_events (session_id);
CREATE INDEX idx_analytics_events_prop ON public.analytics_events (property_id);
CREATE INDEX idx_properties_geom ON public.properties USING gist (geom);
CREATE INDEX idx_properties_polygon_geom ON public.properties USING gist (polygon_geom);
CREATE INDEX idx_properties_published ON public.properties (status) WHERE status = 'published';
CREATE INDEX idx_properties_deal_status ON public.properties (deal_type, status);
CREATE INDEX idx_properties_type_status ON public.properties (property_type, status);
CREATE INDEX idx_properties_district ON public.properties (district);
CREATE INDEX idx_properties_price ON public.properties (price);

-- ---------------------------------------------------------------- functions ---
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_now timestamptz := now();
  v_count int;
BEGIN
  INSERT INTO public.rate_limits (key, count, reset_at)
  VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::interval)
  ON CONFLICT (key) DO UPDATE
  SET count = CASE WHEN rate_limits.reset_at < v_now THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at < v_now THEN v_now + (p_window_seconds || ' seconds')::interval ELSE rate_limits.reset_at END
  RETURNING count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_property_contacts(p_property_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  UPDATE public.properties SET contacts_count = COALESCE(contacts_count, 0) + 1 WHERE id = p_property_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_property_views(p_property_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  UPDATE public.properties SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_property_id AND status = 'published';
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
      OR coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- Exists in production without a trigger attached (kept identical).
CREATE OR REPLACE FUNCTION public.update_property_spatial()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  NEW.updated_at = NOW();
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    NEW.published_at = NOW();
  END IF;
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
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_property_contacts(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_property_views(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_property_contacts(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_property_views(text) TO service_role;

-- --------------------------------------------------------------------- RLS ---
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full realtors access" ON public.realtors FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Public read active realtors" ON public.realtors FOR SELECT USING (is_active = true);
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public read app_settings" ON public.app_settings FOR SELECT TO anon, authenticated
  USING (key LIKE 'cms\_%' OR key = 'site_settings');
CREATE POLICY "Admin full app_settings access" ON public.app_settings FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin read analytics events" ON public.analytics_events FOR SELECT USING (is_admin());
CREATE POLICY "Admin full properties access" ON public.properties FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Public read published properties" ON public.properties FOR SELECT USING (status = 'published');

-- Production: anon/authenticated can SELECT every properties column except amenities.
REVOKE SELECT ON public.properties FROM anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'properties' AND column_name <> 'amenities';
  EXECUTE format('GRANT SELECT (%s) ON public.properties TO anon, authenticated', cols);
END $$;

-- ------------------------------------------------------------------ storage ---
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;
