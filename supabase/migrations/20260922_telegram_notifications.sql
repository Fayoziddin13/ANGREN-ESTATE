-- ==============================================================================
-- Migration: 20260922_telegram_notifications.sql
-- Description: Create telegram_users and telegram_property_notifications tables
-- with idempotent constraints, indexes, and hardened RLS policies.
-- ==============================================================================

-- 1. Table: telegram_users
CREATE TABLE IF NOT EXISTS public.telegram_users (
    telegram_user_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    language VARCHAR(10) NOT NULL DEFAULT 'uz',
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    registered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.telegram_users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.telegram_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.telegram_users ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ;

-- Index on notifications_enabled for rapid subscriber lookup
CREATE INDEX IF NOT EXISTS idx_telegram_users_notifications
    ON public.telegram_users (notifications_enabled)
    WHERE notifications_enabled = TRUE;

-- 2. Table: telegram_property_notifications
CREATE TABLE IF NOT EXISTS public.telegram_property_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT NOT NULL,
    telegram_user_id BIGINT NOT NULL REFERENCES public.telegram_users(telegram_user_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'blocked')),
    telegram_message_id BIGINT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_property_telegram_user UNIQUE(property_id, telegram_user_id)
);

-- Indexes for statistics and lookups
CREATE INDEX IF NOT EXISTS idx_tpn_property_id
    ON public.telegram_property_notifications (property_id);

CREATE INDEX IF NOT EXISTS idx_tpn_status
    ON public.telegram_property_notifications (status);

-- 3. Row Level Security (RLS)
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_property_notifications ENABLE ROW LEVEL SECURITY;

-- Deny public/anonymous direct access to telegram users
DROP POLICY IF EXISTS "Deny public select on telegram_users" ON public.telegram_users;
CREATE POLICY "Deny public select on telegram_users"
    ON public.telegram_users
    FOR ALL
    TO anon
    USING (false);

-- Service role has full access
DROP POLICY IF EXISTS "Service role full access on telegram_users" ON public.telegram_users;
CREATE POLICY "Service role full access on telegram_users"
    ON public.telegram_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Deny public access to notification logs
DROP POLICY IF EXISTS "Deny public access on telegram_property_notifications" ON public.telegram_property_notifications;
CREATE POLICY "Deny public access on telegram_property_notifications"
    ON public.telegram_property_notifications
    FOR ALL
    TO anon
    USING (false);

-- Service role full access to notification logs
DROP POLICY IF EXISTS "Service role full access on telegram_property_notifications" ON public.telegram_property_notifications;
CREATE POLICY "Service role full access on telegram_property_notifications"
    ON public.telegram_property_notifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Properties table columns for notification tracking
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS first_published_at TIMESTAMPTZ;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS telegram_notified_at TIMESTAMPTZ;

