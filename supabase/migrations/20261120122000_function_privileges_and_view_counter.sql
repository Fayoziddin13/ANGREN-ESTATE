-- ==============================================================================
-- ANGREN ESTATE — P1 hardening + views counter (2026-11-20)
-- Migration: 20261120122000_function_privileges_and_view_counter.sql
--
-- 1. increment_property_contacts(text) was executable by anon/authenticated over
--    /rest/v1/rpc, so anyone could inflate any listing's contacts_count. The app
--    calls it only from the server with the service role.
-- 2. update_property_spatial() had a role-mutable search_path (Security Advisor).
-- 3. views_count was never incremented anywhere (all listings showed 0 views).
--    Adds an atomic, server-only increment used by /api/analytics for property_view.
--    The only trigger on properties fires on latitude/longitude/status/deal_type/
--    price/area updates, so bumping views_count does not touch updated_at.
-- No data is modified by this migration.
-- ==============================================================================

-- 1. Server-only contacts counter
REVOKE EXECUTE ON FUNCTION public.increment_property_contacts(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_property_contacts(text) TO service_role;

-- 2. Fixed search_path for the spatial trigger function
ALTER FUNCTION public.update_property_spatial() SET search_path = public, pg_temp;

-- 3. Server-only atomic views counter
CREATE OR REPLACE FUNCTION public.increment_property_views(p_property_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.properties
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_property_id AND status = 'published';
$$;

REVOKE EXECUTE ON FUNCTION public.increment_property_views(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_property_views(text) TO service_role;
