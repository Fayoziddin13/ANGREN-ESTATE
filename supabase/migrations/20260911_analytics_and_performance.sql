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
