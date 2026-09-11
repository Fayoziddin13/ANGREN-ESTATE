-- ==============================================================================
-- ANGREN ESTATE — PHASE 4B / STEP 2: LEADS SYSTEM SECURITY PATCH
-- Platform: Supabase / PostgreSQL 15+
-- Migration: 20260910_leads_security_patch.sql
-- Description: Idempotent security patch that removes insecure client policies,
--              hardens the increment_property_contacts SECURITY DEFINER function,
--              and seals public.leads to server-side service_role access only.
-- ==============================================================================

-- 1. Ensure RLS is active on public.leads
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;

-- 2. Drop broad/insecure authenticated and public policies
DROP POLICY IF EXISTS "Authenticated users can read leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Public users cannot read leads" ON public.leads;
DROP POLICY IF EXISTS "Public users cannot update leads" ON public.leads;
DROP POLICY IF EXISTS "Public users cannot delete leads" ON public.leads;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.leads;

-- 3. Harden the SECURITY DEFINER function with explicit search_path
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
