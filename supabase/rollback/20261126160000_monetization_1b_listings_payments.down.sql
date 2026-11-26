-- =============================================================================
-- Rollback for 20261126160000_monetization_1b_listings_payments.sql
--
-- Removes only the objects created by 1b. 1a objects and existing tables stay.
-- WARNING: deletes every application, order, payment record, refund, promo code
-- and sticker stored in these tables. On production export them first.
-- Storage: empty and delete the private bucket "listing-submissions" through the
-- Supabase dashboard or Storage API (direct SQL deletes on storage tables are blocked).
-- Test inside a transaction on the TEST project first: BEGIN; <this file>; ROLLBACK;
-- =============================================================================

DROP FUNCTION IF EXISTS public.mon_deactivate_price(uuid, text);
DROP FUNCTION IF EXISTS public.mon_set_price(text, text, integer, bigint, text);
DROP FUNCTION IF EXISTS public.mon_apply_payment(uuid, text, text, bigint, jsonb);
DROP FUNCTION IF EXISTS public.mon_cancel_boost(uuid, uuid);
DROP FUNCTION IF EXISTS public.mon_moderate_boost(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.mon_ensure_boost_order(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.mon_request_boost(uuid, text, text, integer, text, text);
DROP FUNCTION IF EXISTS public.mon_cancel_submission(uuid, uuid);
DROP FUNCTION IF EXISTS public.mon_moderate_submission(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.mon_close_order(uuid, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.mon_settle_refund(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.mon_request_refund(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.mon_admin_update_submission(uuid, jsonb, text[], text);
DROP FUNCTION IF EXISTS public.mon_resubmit_submission(uuid, uuid, jsonb, text[], text, text);
DROP FUNCTION IF EXISTS public.mon_ensure_listing_order(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.mon_submit_listing(uuid, uuid, text, text, text, boolean, text, jsonb, text[], text, text, text);
DROP FUNCTION IF EXISTS public.mon_listing_terms(uuid, text, text, boolean);
DROP FUNCTION IF EXISTS public.mon_expire_order(uuid);
DROP FUNCTION IF EXISTS public.mon_release_promo(uuid);
DROP FUNCTION IF EXISTS public.mon_create_order(uuid, text, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.mon_quote(uuid, text, text, integer, text, boolean);
DROP FUNCTION IF EXISTS public.mon_audit(text, text, text, text, text, jsonb, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.mon_settings();

-- Dependent tables first.
DROP TABLE IF EXISTS public.promo_redemptions;
DROP TABLE IF EXISTS public.refunds;
DROP TABLE IF EXISTS public.payment_webhook_logs;
DROP TABLE IF EXISTS public.payment_transactions;
DROP TABLE IF EXISTS public.payment_orders;
DROP TABLE IF EXISTS public.property_boosts;
DROP TABLE IF EXISTS public.promotions;
DROP TABLE IF EXISTS public.promo_codes;
DROP TABLE IF EXISTS public.free_listing_claims;
DROP TABLE IF EXISTS public.listing_submissions;

-- Restore the 1a wording of the append-only guard.
CREATE OR REPLACE FUNCTION public.mon_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'monetization_audit_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
