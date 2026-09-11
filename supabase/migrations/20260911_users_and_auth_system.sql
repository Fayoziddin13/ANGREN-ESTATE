-- ==============================================================================
-- ANGREN ESTATE — PHASE 4B / STEP 4: USERS & AUTHENTICATION CANONICAL MIGRATION
-- Platform: Supabase / PostgreSQL 15+
-- Migration: 20260911_users_and_auth_system.sql
-- Description: Idempotent migration for canonical profiles, strict RLS,
--              disabled-user database blocking, role/status tamper protection,
--              and atomic favorites count synchronization.
-- ==============================================================================

-- 1. PROFILES TABLE ENHANCEMENTS & SAFEGUARDS
ALTER TABLE IF EXISTS public.profiles 
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add check constraint for status enum if not already present
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_profiles_status'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_status 
        CHECK (status IN ('active', 'disabled'));
    END IF;
END $$;

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. STRICT ROW LEVEL SECURITY ON PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all broad or legacy policies
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.profiles;

-- 2.1 Authenticated users can SELECT only their own profile
CREATE POLICY "Users read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- 2.2 Authenticated users can UPDATE only their own profile
CREATE POLICY "Users update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2.3 ZERO CLIENT INSERT POLICY:
-- Client-side INSERT is explicitly DISALLOWED for all non-service_role callers.
-- Profile creation and upsert is handled exclusively by server-side /auth/callback
-- using supabaseAdmin (service_role). This prevents any client privilege escalation.

-- 2.4 Trigger to prevent client-side tampering of protected fields on UPDATE
CREATE OR REPLACE FUNCTION public.protect_profile_fields_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Only enforce restrictions if not executing as service_role
    IF (COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') != 'service_role') THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify their own role.';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify their own account status.';
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot change profile ID.';
        END IF;
        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'Unauthorized: Email is managed by OAuth provider.';
        END IF;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields_update();

-- 3. FAVORITES SYSTEM & DISABLED USER ENFORCEMENT
ALTER TABLE IF EXISTS public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users insert own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users delete own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Public read favorites" ON public.favorites;
DROP POLICY IF EXISTS "Active users read own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Active users insert own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Active users delete own favorites" ON public.favorites;

-- Helper function to check if caller is an active authenticated user
CREATE OR REPLACE FUNCTION public.is_active_authenticated_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_authenticated_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_authenticated_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_authenticated_user() TO service_role;

-- 3.1 SELECT: Must be owner AND have active profile status
CREATE POLICY "Active users read own favorites"
    ON public.favorites FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id 
        AND public.is_active_authenticated_user()
    );

-- 3.2 INSERT: Must be owner AND have active profile status
CREATE POLICY "Active users insert own favorites"
    ON public.favorites FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id 
        AND public.is_active_authenticated_user()
    );

-- 3.3 DELETE: Must be owner AND have active profile status
CREATE POLICY "Active users delete own favorites"
    ON public.favorites FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id 
        AND public.is_active_authenticated_user()
    );

-- 4. ATOMIC FAVORITES COUNTER TRIGGER ON PROPERTIES
CREATE OR REPLACE FUNCTION public.sync_property_favorites_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.properties
        SET favorites_count = COALESCE(favorites_count, 0) + 1
        WHERE id = NEW.property_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.properties
        SET favorites_count = GREATEST(COALESCE(favorites_count, 0) - 1, 0)
        WHERE id = OLD.property_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_property_favorites_count ON public.favorites;
CREATE TRIGGER trg_sync_property_favorites_count
AFTER INSERT OR DELETE ON public.favorites
FOR EACH ROW
EXECUTE FUNCTION public.sync_property_favorites_count();

-- 5. CANONICAL SEED DATA CONTINUITY
-- Ensure existing auth user admin.angren@gmail.com is seeded with admin role
INSERT INTO public.profiles (
    id, email, full_name, role, status, created_at, updated_at
) VALUES (
    '2ae96f82-35f7-43c2-aa06-60772f0d07d6',
    'admin.angren@gmail.com',
    'Admin Angren',
    'admin',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    status = 'active',
    updated_at = NOW();
