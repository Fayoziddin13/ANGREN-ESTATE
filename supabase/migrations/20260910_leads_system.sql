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
