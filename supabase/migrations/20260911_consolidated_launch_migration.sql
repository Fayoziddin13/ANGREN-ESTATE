-- ==============================================================================
-- ANGREN ESTATE — PHASE 4B / STEP 2: LEADS SYSTEM (SECURITY HARDENED)
-- Platform: Supabase / PostgreSQL 15+
-- Migration: 20260910_leads_system.sql
-- Description: Creates canonical public.leads table with notes,
--              hardened SECURITY DEFINER atomic increment function,
--              performance indexes, and ZERO direct client RLS exposure.
-- ==============================================================================

-- 1. Create public.leads table with notes
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id VARCHAR(100) REFERENCES public.properties(id) ON DELETE SET NULL,
    realtor_id UUID REFERENCES public.realtors(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('phone', 'telegram', 'inquiry')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'in_progress', 'completed', 'cancelled')),
    property_title TEXT,
    property_slug TEXT,
    client_name TEXT,
    client_phone TEXT,
    message TEXT,        -- Original inquiry/message submitted by visitor
    notes TEXT,          -- Internal administrative notes, follow-up remarks
    device TEXT DEFAULT 'Desktop',
    traffic_source TEXT DEFAULT 'Direct',
    session_id TEXT,
    ip_hash TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Hardened Concurrency-Safe Atomic Database RPC for Contacts Count
-- Fixed search_path prevents search_path injection vulnerabilities in SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.increment_property_contacts(p_property_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.properties
    SET contacts_count = COALESCE(contacts_count, 0) + 1
    WHERE id = p_property_id;
END;
$$;

-- Restrict RPC execution: only server-side service_role can invoke this RPC
REVOKE ALL ON FUNCTION public.increment_property_contacts(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_property_contacts(TEXT) TO service_role;

-- 3. Performance & Deduplication Indexes
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_type ON public.leads(type);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON public.leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_realtor_id ON public.leads(realtor_id);
CREATE INDEX IF NOT EXISTS idx_leads_dedup ON public.leads(property_id, type, ip_hash, created_at DESC);

-- 4. Strict Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop ANY permissive policies if previously created
DROP POLICY IF EXISTS "Public users cannot read leads" ON public.leads;
DROP POLICY IF EXISTS "Public users cannot update leads" ON public.leads;
DROP POLICY IF EXISTS "Public users cannot delete leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can read leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.leads;

-- NOTE ON ACCESS CONTROL:
-- By enabling RLS without granting any SELECT/INSERT/UPDATE/DELETE policies to
-- 'anon' or 'authenticated' roles, PostgreSQL defaults to DENY ALL for all direct client requests.
--
-- Neither anonymous visitors nor normal Supabase Auth authenticated users can access
-- public.leads directly via PostgREST.
--
-- Only trusted server-side API handlers (/api/leads and /api/admin/leads) accessing
-- PostgreSQL via supabaseAdmin (service_role with BYPASSRLS) can interact with this table.


-- ==============================================================================
-- ANGREN ESTATE — PHASE 4B / STEP 6: ANALYTICS & RATE LIMITING INFRASTRUCTURE
-- Platform: Supabase / PostgreSQL 15+
-- Migration: 20260911_analytics_and_performance.sql
-- Description:
--   1. Rate limiting table public.rate_limits & atomic check_rate_limit() RPC
--   2. Performance indexes on public.analytics_events (created_at, session_id, property_id)
--   3. Drop public INSERT policy to block direct client DB writes on analytics_events
--   4. Strict RLS and least-privilege security
-- ==============================================================================

-- 1. Create public.rate_limits table for multi-instance concurrency-safe rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INT NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON public.rate_limits(reset_at);

-- 2. Concurrency-safe atomic check_rate_limit function
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key TEXT, p_max INT, p_window_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_count INT;
BEGIN
    -- Atomic upsert: reset counter if previous window expired, otherwise increment
    INSERT INTO public.rate_limits (key, count, reset_at)
    VALUES (p_key, 1, v_now + (p_window_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (key) DO UPDATE
    SET count = CASE
            WHEN rate_limits.reset_at < v_now THEN 1
            ELSE rate_limits.count + 1
        END,
        reset_at = CASE
            WHEN rate_limits.reset_at < v_now THEN v_now + (p_window_seconds || ' seconds')::INTERVAL
            ELSE rate_limits.reset_at
        END
    RETURNING count INTO v_count;

    RETURN v_count <= p_max;
END;
$$;

-- Restrict check_rate_limit execution to server-side service_role only
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO service_role;

-- Lock down public.rate_limits table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC;
REVOKE ALL ON public.rate_limits FROM anon;
REVOKE ALL ON public.rate_limits FROM authenticated;
GRANT ALL ON public.rate_limits TO service_role;

-- 3. Performance indexes on public.analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_prop ON public.analytics_events(property_id);

-- 4. Block direct client INSERT on public.analytics_events
-- Drop legacy public insert policy so direct client supabase.from('analytics_events').insert() is denied by RLS
DROP POLICY IF EXISTS "Public insert analytics events" ON public.analytics_events;

-- Ensure RLS is active on analytics_events
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Deny mutations from client roles
REVOKE INSERT, UPDATE, DELETE ON public.analytics_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.analytics_events FROM authenticated;

-- Service role retains full access for server-side API ingestion
GRANT ALL ON public.analytics_events TO service_role;


-- ==============================================================================
-- 5. VERIFICATION & DIAGNOSTIC BLOCK (NON-DESTRUCTIVE)
-- ==============================================================================
DO $$
DECLARE
    v_leads_ok BOOLEAN;
    v_rl_ok BOOLEAN;
    v_fn_rl_ok BOOLEAN;
    v_fn_leads_ok BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') INTO v_leads_ok;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limits') INTO v_rl_ok;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit') INTO v_fn_rl_ok;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_property_contacts') INTO v_fn_leads_ok;

    RAISE NOTICE '==================================================';
    RAISE NOTICE 'ANGREN ESTATE — LAUNCH MIGRATION DIAGNOSTIC RESULT';
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'Table public.leads:                 %', CASE WHEN v_leads_ok THEN 'READY' ELSE 'MISSING' END;
    RAISE NOTICE 'Table public.rate_limits:           %', CASE WHEN v_rl_ok THEN 'READY' ELSE 'MISSING' END;
    RAISE NOTICE 'RPC public.check_rate_limit:        %', CASE WHEN v_fn_rl_ok THEN 'READY' ELSE 'MISSING' END;
    RAISE NOTICE 'RPC public.increment_property_contacts: %', CASE WHEN v_fn_leads_ok THEN 'READY' ELSE 'MISSING' END;
    RAISE NOTICE '==================================================';
END $$;
