-- ==============================================================================
-- ANGREN ESTATE — P0 / SEC-19: app_settings is readable by anyone
-- Migration: 20261120121000_restrict_app_settings_public_read.sql
--
-- Problem (verified on production 2026-11-20): policy "Public read app_settings"
-- is `FOR SELECT USING (true)` for role public. With the anon key that ships in
-- the browser bundle, anyone can read every row, including
--   * telegram_users_registry      — Telegram users' names and phone numbers,
--   * telegram_notifications_log   — delivery log per user,
-- and any future private key. The narrowing in 20260911_cms_and_site_content.sql
-- was never applied to production.
--
-- The application reads app_settings only through the service role
-- (supabaseAdmin), which bypasses RLS, so restricting anon/authenticated access
-- does not affect any feature. Public CMS keys stay readable to match the
-- intended design.
-- ==============================================================================

DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;

CREATE POLICY "Public read app_settings"
    ON public.app_settings FOR SELECT
    TO anon, authenticated
    USING (key LIKE 'cms\_%' OR key = 'site_settings');

-- Verification (read-only, as anon):
--   begin; set local role anon;
--   select key from public.app_settings order by key;   -- only cms_* and site_settings
--   rollback;
