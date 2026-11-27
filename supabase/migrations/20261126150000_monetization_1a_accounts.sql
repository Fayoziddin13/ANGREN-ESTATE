-- =============================================================================
-- ANGREN ESTATE — monetization 1a: customer accounts, identities, pricing, audit log
--
-- Additive only: creates new tables and functions. No existing table is modified.
-- Apply to the TEST project (angren-estate-test / lesaumhlzjagrcfvjqqf) first.
-- Rollback:  supabase/rollback/20261126150000_monetization_1a_accounts.down.sql
-- Checks:    supabase/checks/20261126150000_monetization_1a_accounts.check.sql
--
-- Access model
--   * RLS enabled, no policies, every privilege revoked from anon / authenticated:
--     browsers can neither read nor write these tables, even with a valid JWT.
--   * Only the server (service_role) works with them, and only through the
--     privileges granted below.
--   * Functions are SECURITY INVOKER with an empty search_path, executable by
--     service_role only.
-- =============================================================================

-- ------------------------------------------------------------------ helpers ---
CREATE FUNCTION public.mon_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.mon_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'monetization_audit_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- -------------------------------------------------------- customer accounts ---
-- One person = one account. `status` is the only source of truth for blocking
-- (production `profiles` has no status column, so the old check never worked).
CREATE TABLE public.customer_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  status_reason     text,
  status_changed_at timestamptz,
  display_name      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.customer_accounts IS
  'Monetization: one account per person; status=blocked stops new submissions and orders.';

-- Login methods of an account. (provider, provider_subject) is unique, so one Google
-- user or one Telegram user can never belong to two accounts.
CREATE TABLE public.customer_identities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES public.customer_accounts (id) ON DELETE RESTRICT,
  provider          text NOT NULL CHECK (provider IN ('google', 'telegram')),
  provider_subject  text NOT NULL,
  email             text,
  phone_e164        text CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified    boolean NOT NULL DEFAULT false,
  telegram_username text,
  last_seen_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_customer_identity UNIQUE (provider, provider_subject),
  -- Google: the Supabase auth user id (uuid). Telegram: the numeric user id (no "tg_" prefix).
  CONSTRAINT chk_customer_identity_subject CHECK (
    (provider = 'google' AND provider_subject ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR (provider = 'telegram' AND provider_subject ~ '^[1-9][0-9]{0,19}$')
  ),
  CONSTRAINT chk_customer_identity_verified_phone CHECK (NOT phone_verified OR phone_e164 IS NOT NULL)
);
CREATE INDEX idx_customer_identities_account ON public.customer_identities (account_id);
CREATE INDEX idx_customer_identities_phone ON public.customer_identities (phone_e164)
  WHERE phone_e164 IS NOT NULL;
COMMENT ON TABLE public.customer_identities IS
  'Monetization: Google / Telegram logins attached to a customer account.';

-- ------------------------------------------------------------ pricing plans ---
-- Listing price, and sticker price per sticker type and duration (3 / 7 / 30 days,
-- more can be added). Orders keep a copy of the plan, so later price changes never
-- alter existing orders.
CREATE TABLE public.pricing_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service       text NOT NULL CHECK (service IN ('listing', 'sticker')),
  sticker_type  text CHECK (sticker_type IN ('top', 'tez_sotiladi', 'yaxshi_taklif')),
  duration_days integer CHECK (duration_days BETWEEN 1 AND 365),
  price_uzs     bigint NOT NULL CHECK (price_uzs > 0),
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_pricing_plan_shape CHECK (
    (service = 'listing' AND sticker_type IS NULL AND duration_days IS NULL)
    OR (service = 'sticker' AND sticker_type IS NOT NULL AND duration_days IS NOT NULL)
  )
);
-- At most one active price per product.
CREATE UNIQUE INDEX uq_pricing_plans_active
  ON public.pricing_plans (service, coalesce(sticker_type, ''), coalesce(duration_days, 0))
  WHERE is_active;
COMMENT ON TABLE public.pricing_plans IS
  'Monetization: prices in UZS (whole sums); one active plan per product.';

-- ---------------------------------------------------------------- audit log ---
CREATE TABLE public.monetization_audit_logs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  actor_type   text NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system', 'provider')),
  actor_id     text,
  action       text NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  entity       text NOT NULL CHECK (length(entity) BETWEEN 1 AND 100),
  entity_id    text,
  before_state jsonb,
  after_state  jsonb,
  reason       text,
  ip_hash      text,
  request_id   text
);
CREATE INDEX idx_mon_audit_entity ON public.monetization_audit_logs (entity, entity_id, created_at DESC);
CREATE INDEX idx_mon_audit_created ON public.monetization_audit_logs (created_at DESC);
COMMENT ON TABLE public.monetization_audit_logs IS
  'Monetization: append-only journal of every state change (UPDATE / DELETE / TRUNCATE are blocked).';

-- ----------------------------------------------------------------- triggers ---
CREATE TRIGGER trg_mon_audit_no_update_delete
  BEFORE UPDATE OR DELETE ON public.monetization_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.mon_audit_append_only();

-- TRUNCATE skips row triggers, so it needs its own statement trigger.
CREATE TRIGGER trg_mon_audit_no_truncate
  BEFORE TRUNCATE ON public.monetization_audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.mon_audit_append_only();

CREATE TRIGGER trg_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_customer_identities_updated_at
  BEFORE UPDATE ON public.customer_identities
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_pricing_plans_updated_at
  BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();

-- ---------------------------------------------------------------- functions ---
-- Find or create the account of a login the server has already verified (Supabase
-- session or Telegram initData). Safe under concurrency: two first requests for the
-- same identity end up on one account. A verified phone is never replaced by an
-- unverified one.
CREATE FUNCTION public.mon_resolve_customer_account(
  p_provider          text,
  p_subject           text,
  p_email             text    DEFAULT NULL,
  p_phone_e164        text    DEFAULT NULL,
  p_phone_verified    boolean DEFAULT false,
  p_telegram_username text    DEFAULT NULL,
  p_display_name      text    DEFAULT NULL
)
RETURNS TABLE (account_id uuid, identity_id uuid, account_status text, is_new boolean)
LANGUAGE plpgsql
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_identity public.customer_identities%ROWTYPE;
  v_account  uuid;
  v_new      boolean := false;
  v_verified boolean := coalesce(p_phone_verified, false) AND p_phone_e164 IS NOT NULL;
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('google', 'telegram') OR coalesce(p_subject, '') = '' THEN
    RAISE EXCEPTION 'mon_resolve_customer_account: invalid identity'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_identity
  FROM public.customer_identities
  WHERE provider = p_provider AND provider_subject = p_subject
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.customer_accounts (display_name)
    VALUES (p_display_name)
    RETURNING id INTO v_account;

    INSERT INTO public.customer_identities
      (account_id, provider, provider_subject, email, phone_e164, phone_verified, telegram_username, last_seen_at)
    VALUES
      (v_account, p_provider, p_subject, p_email, p_phone_e164, v_verified, p_telegram_username, now())
    ON CONFLICT (provider, provider_subject) DO NOTHING
    RETURNING * INTO v_identity;

    IF v_identity.id IS NULL THEN
      -- A parallel request created this identity first: drop our empty account, use theirs.
      DELETE FROM public.customer_accounts WHERE id = v_account;
      SELECT * INTO v_identity
      FROM public.customer_identities
      WHERE provider = p_provider AND provider_subject = p_subject
      FOR UPDATE;
    ELSE
      v_new := true;
      INSERT INTO public.monetization_audit_logs (actor_type, action, entity, entity_id, after_state)
      VALUES ('system', 'account.created', 'customer_account', v_account::text,
              jsonb_build_object('provider', p_provider, 'identity_id', v_identity.id));
    END IF;
  ELSE
    UPDATE public.customer_identities
    SET email             = coalesce(p_email, email),
        phone_e164        = CASE
                              WHEN v_verified THEN p_phone_e164
                              WHEN phone_verified THEN phone_e164
                              ELSE coalesce(p_phone_e164, phone_e164)
                            END,
        phone_verified    = phone_verified OR v_verified,
        telegram_username = coalesce(p_telegram_username, telegram_username),
        last_seen_at      = now()
    WHERE id = v_identity.id
    RETURNING * INTO v_identity;
  END IF;

  RETURN QUERY
  SELECT a.id, v_identity.id, a.status, v_new
  FROM public.customer_accounts a
  WHERE a.id = v_identity.account_id;
END;
$$;

-- Block or unblock an account. Admin action, always written to the audit log;
-- blocking requires a reason.
CREATE FUNCTION public.mon_set_customer_account_status(
  p_account_id uuid,
  p_status     text,
  p_reason     text,
  p_actor_id   text,
  p_ip_hash    text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS public.customer_accounts
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_before public.customer_accounts%ROWTYPE;
  v_after  public.customer_accounts%ROWTYPE;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('active', 'blocked') THEN
    RAISE EXCEPTION 'mon_set_customer_account_status: invalid status %', p_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_status = 'blocked' AND coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'mon_set_customer_account_status: a reason is required to block an account'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_before FROM public.customer_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mon_set_customer_account_status: account % not found', p_account_id
      USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.customer_accounts
  SET status = p_status, status_reason = p_reason, status_changed_at = now()
  WHERE id = p_account_id
  RETURNING * INTO v_after;

  INSERT INTO public.monetization_audit_logs
    (actor_type, actor_id, action, entity, entity_id, before_state, after_state, reason, ip_hash, request_id)
  VALUES
    ('admin', p_actor_id, 'account.status_changed', 'customer_account', p_account_id::text,
     jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_after.status),
     p_reason, p_ip_hash, p_request_id);

  RETURN v_after;
END;
$$;

-- ---------------------------------------------------------------- security ---
ALTER TABLE public.customer_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_identities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_audit_logs ENABLE ROW LEVEL SECURITY;

-- Supabase's default privileges grant ALL (including TRUNCATE) to anon and
-- authenticated on new tables. Remove them, then grant the server only what it needs.
REVOKE ALL ON TABLE
  public.customer_accounts, public.customer_identities,
  public.pricing_plans, public.monetization_audit_logs
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.customer_identities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pricing_plans TO service_role;
GRANT SELECT, INSERT                 ON TABLE public.monetization_audit_logs TO service_role;

REVOKE ALL ON SEQUENCE public.monetization_audit_logs_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.monetization_audit_logs_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.mon_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mon_audit_append_only() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mon_resolve_customer_account(text, text, text, text, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mon_set_customer_account_status(uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mon_resolve_customer_account(text, text, text, text, boolean, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mon_set_customer_account_status(uuid, text, text, text, text, text)
  TO service_role;
