-- ==============================================================================
-- ANGREN ESTATE — REALTOR PHOTO & INSTAGRAM MIGRATION
-- Platform: Supabase / PostgreSQL 15+
-- Migration: 20260912_realtor_photo_instagram_migration.sql
-- Description: Adds photo_url and instagram_url columns to public.realtors,
--              synchronizes photo_url with existing avatar_url,
--              preserves all existing realtors, UUIDs, properties, and leads.
-- ==============================================================================

ALTER TABLE public.realtors 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- Synchronize photo_url with existing avatar_url where photo_url is null
UPDATE public.realtors 
SET photo_url = avatar_url 
WHERE photo_url IS NULL AND avatar_url IS NOT NULL;

-- Verification block
DO $$
BEGIN
    -- Verify Jasur Alimov (prop-1) canonical relationship
    IF NOT EXISTS (
        SELECT 1 FROM public.realtors 
        WHERE id = '00000000-0000-0000-0000-000000000001'
    ) THEN
        RAISE EXCEPTION 'CRITICAL: Canonical realtor Jasur Alimov (0000...0001) missing!';
    END IF;
    RAISE NOTICE 'Realtor photo and Instagram migration successfully prepared.';
END $$;
