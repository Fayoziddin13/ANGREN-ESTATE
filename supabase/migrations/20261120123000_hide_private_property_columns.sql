-- ==============================================================================
-- ANGREN ESTATE — SEC-06: hide private listing data from direct REST reads
-- Migration: 20261120123000_hide_private_property_columns.sql
--
-- RLS filters rows, not columns. With the public anon key anyone could read
-- every column of published listings over /rest/v1/properties, including
-- `amenities`, which stores the owner's phone even when the admin hid it
-- (production has no separate owner_phone column; it lives in amenities).
--
-- The site now reads listings only on the server with the service role and
-- strips private fields before rendering, so anon/authenticated need no access
-- to `amenities`. They keep SELECT on every other column, so anything public
-- (row counts, published listing fields) keeps working unchanged.
--
-- Columns added later are NOT readable by anon/authenticated unless granted
-- explicitly — private-by-default.
-- ==============================================================================

REVOKE SELECT ON public.properties FROM anon, authenticated;

GRANT SELECT (
  id, slug, status, deal_type, transaction_type, property_type,
  title_uz, title_ru, description_uz, description_ru,
  price, price_uzs, price_usd, currency, price_negotiable,
  area, area_sqm, living_area, living_area_sqm, area_sotikh,
  rooms, bathrooms, floors, floor, floor_number, total_floors,
  renovation, furniture, parking,
  gas, water, electricity, sewerage, heating, utilities,
  air_conditioning, elevator, internet, balcony,
  city, district, district_name_uz, district_name_ru, neighborhood,
  address, address_uz, address_ru,
  latitude, longitude, geom, polygon_geom, polygon_coordinates,
  photos, images, main_image, video_url,
  contact_phone, contact_telegram, telegram, realtor_id,
  views_count, favorites_count, contacts_count,
  created_at, updated_at, published_at
) ON public.properties TO anon, authenticated;

-- Verification (read-only):
--   select has_column_privilege('anon', 'public.properties', 'amenities', 'SELECT');  -- false
--   select has_column_privilege('anon', 'public.properties', 'title_uz', 'SELECT');   -- true
