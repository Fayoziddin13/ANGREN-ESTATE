-- ==============================================================================
-- ANGREN ESTATE — OWNER PHONE & CORE UTILITIES MIGRATION
-- Migration: 20260912_owner_phone_and_utilities.sql
-- Description: Non-destructive addition of owner_phone column to public.properties
-- ==============================================================================

-- 1. Add owner_phone column if not exists
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(50);

-- 2. Add comment for documentation
COMMENT ON COLUMN public.properties.owner_phone IS 'Direct contact phone of the property owner, managed by administrator and distinct from assigned realtor phone';
