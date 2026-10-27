-- ==============================================================================
-- ANGREN ESTATE — PHASE 5: USER REGISTRATION SOURCE, APPLICATION LINKING & TELEGRAM MESSAGING
-- Migration: 20261027_registration_source_and_admin_users.sql
-- Description: Non-destructive addition of auth_provider, telegram_user_id,
--              telegram_username, and google_id to profiles and leads tables.
-- ==============================================================================

-- 1. Profiles additions
ALTER TABLE IF EXISTS public.profiles
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(30) DEFAULT 'google',
    ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT,
    ADD COLUMN IF NOT EXISTS telegram_username TEXT,
    ADD COLUMN IF NOT EXISTS google_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_auth_provider ON public.profiles(auth_provider);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_user_id ON public.profiles(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- 2. Leads additions
ALTER TABLE IF EXISTS public.leads
    ADD COLUMN IF NOT EXISTS registration_source VARCHAR(30),
    ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_registration_source ON public.leads(registration_source);
CREATE INDEX IF NOT EXISTS idx_leads_client_phone ON public.leads(client_phone);

-- 3. Telegram Users indexing for rapid lookup and admin matching
CREATE INDEX IF NOT EXISTS idx_telegram_users_phone ON public.telegram_users(phone);
CREATE INDEX IF NOT EXISTS idx_telegram_users_username ON public.telegram_users(username);
