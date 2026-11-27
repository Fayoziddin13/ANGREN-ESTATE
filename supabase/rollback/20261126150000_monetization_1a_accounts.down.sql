-- =============================================================================
-- Rollback for 20261126150000_monetization_1a_accounts.sql
--
-- Removes ONLY the objects created by that migration. Existing tables are untouched.
-- WARNING: this deletes every customer account, identity, price and audit entry
-- stored in these tables. Run on production only after exporting them.
-- Test it first inside a transaction on the TEST project:  BEGIN; <this file>; ROLLBACK;
-- =============================================================================

DROP FUNCTION IF EXISTS public.mon_set_customer_account_status(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.mon_resolve_customer_account(text, text, text, text, boolean, text, text);

-- Dropping a table also drops its triggers and indexes.
DROP TABLE IF EXISTS public.monetization_audit_logs;
DROP TABLE IF EXISTS public.pricing_plans;
DROP TABLE IF EXISTS public.customer_identities;
DROP TABLE IF EXISTS public.customer_accounts;

DROP FUNCTION IF EXISTS public.mon_audit_append_only();
DROP FUNCTION IF EXISTS public.mon_set_updated_at();
