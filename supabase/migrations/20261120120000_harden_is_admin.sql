-- ==============================================================================
-- ANGREN ESTATE — P0 / SEC-03: is_admin() must not trust user-editable claims
-- Migration: 20261120120000_harden_is_admin.sql
--
-- Problem (verified on production 2026-11-20): public.is_admin() returned true when
--   * the JWT's user_metadata.is_admin = 'true'  — user_metadata is writable by the
--     user themself via supabase.auth.updateUser({ data: { is_admin: true } }), or
--   * the JWT's email = 'admin@angrenestate.uz'  — any account with that email.
-- The function backs FOR ALL policies on properties, realtors and app_settings and
-- the SELECT policy on analytics_events, so any signed-in user could grant
-- themself full read/write access with the public anon key.
--
-- Fix: only the service role, or an app_metadata.role = 'admin' claim (app_metadata
-- can be set only server-side with the service role), counts as admin.
-- The admin panel already talks to the database through the service role, so no
-- application feature depends on the removed conditions.
--
-- Signature and return type are unchanged, so dependent policies keep working.
-- EXECUTE stays granted to anon/authenticated: RLS policies call this function as
-- the requesting role.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
    OR coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True only for the service role or a JWT whose app_metadata.role = admin. Never trust user_metadata or email here.';

-- Verification (read-only):
--   select pg_get_functiondef('public.is_admin()'::regprocedure);
-- Rollback is intentionally not provided: the previous definition was the vulnerability.
