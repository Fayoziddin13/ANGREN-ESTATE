-- =============================================================================
-- ANGREN ESTATE — monetization 1c: manual card-to-card payment, Premium listing
-- tier, refunds kept apart from payments.
--
-- Backward compatible and data preserving:
--   * new tables: payment_methods, payment_receipts, payment_reviews;
--   * new nullable / defaulted columns on pricing_plans, listing_submissions,
--     payment_orders (no column is dropped or renamed);
--   * payment_orders.status gets the manual-payment states; the old REFUNDED value
--     is no longer written (a refund lives only in public.refunds) and existing
--     REFUNDED rows are mapped back to PAID (their refund row already exists);
--   * functions are replaced or added; the only dropped objects are functions
--     whose parameter list changes, recreated in the same transaction.
-- No row is deleted. Apply to the TEST project first.
-- Rollback: supabase/rollback/20261127120000_monetization_1c_manual_card_premium.down.sql
-- Checks:   supabase/checks/20261127120000_monetization_1c_manual_card_premium.check.sql
--
-- Same access model as 1a/1b: RLS on, no policies, no privileges for anon /
-- authenticated; functions run as SECURITY INVOKER with an empty search_path and
-- are executable by service_role only. Business errors are raised as 'MON:<code>'.
-- =============================================================================

-- ===================================================== Premium listing tier ===

ALTER TABLE public.pricing_plans
  ADD COLUMN listing_tier text CHECK (listing_tier IN ('standard', 'premium'));
UPDATE public.pricing_plans SET listing_tier = 'standard' WHERE service = 'listing' AND listing_tier IS NULL;

ALTER TABLE public.pricing_plans DROP CONSTRAINT chk_pricing_plan_shape;
ALTER TABLE public.pricing_plans ADD CONSTRAINT chk_pricing_plan_shape CHECK (
  (service = 'listing' AND listing_tier IS NOT NULL AND sticker_type IS NULL AND duration_days IS NULL)
  OR (service = 'sticker' AND listing_tier IS NULL AND sticker_type IS NOT NULL AND duration_days IS NOT NULL)
);
DROP INDEX public.uq_pricing_plans_active;
CREATE UNIQUE INDEX uq_pricing_plans_active
  ON public.pricing_plans (service, coalesce(listing_tier, ''), coalesce(sticker_type, ''), coalesce(duration_days, 0))
  WHERE is_active;

ALTER TABLE public.listing_submissions
  ADD COLUMN listing_tier text NOT NULL DEFAULT 'standard' CHECK (listing_tier IN ('standard', 'premium'));
COMMENT ON COLUMN public.listing_submissions.listing_tier IS
  'standard or premium. Premium = price + Premium badge + admin-defined features; it never includes TOP.';

-- ================================================== manual card payment data ===

-- The card the customers pay to. Changing the card inserts a new row (history kept).
CREATE TABLE public.payment_methods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL DEFAULT 'manual_card' CHECK (kind = 'manual_card'),
  card_number  text NOT NULL CHECK (card_number ~ '^[0-9]{16}$'),
  holder_name  text NOT NULL CHECK (length(btrim(holder_name)) BETWEEN 3 AND 80),
  bank_name    text CHECK (bank_name IS NULL OR length(bank_name) <= 80),
  instructions text CHECK (instructions IS NULL OR length(instructions) <= 600),
  accepting    boolean NOT NULL DEFAULT true,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_payment_methods_active ON public.payment_methods (kind) WHERE is_active;
COMMENT ON TABLE public.payment_methods IS
  'Monetization: card for manual card-to-card payments. Only the admin changes it; one active row.';

ALTER TABLE public.payment_orders
  ADD COLUMN payment_method_id uuid REFERENCES public.payment_methods (id) ON DELETE RESTRICT,
  ADD COLUMN reviewed_at       timestamptz,
  ADD COLUMN reviewed_by       text;

-- Payment status only. A refund never changes it.
UPDATE public.payment_orders SET status = 'PAID' WHERE status = 'REFUNDED';
ALTER TABLE public.payment_orders DROP CONSTRAINT payment_orders_status_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_status_check CHECK (status IN (
  'PENDING',            -- awaiting payment (transfer + receipt)
  'RECEIPT_SUBMITTED',  -- the customer sent a receipt
  'UNDER_REVIEW',       -- an admin is checking the bank
  'INFO_REQUESTED',     -- the admin asked for another receipt / details
  'PAID',               -- the admin confirmed the money arrived
  'REJECTED',           -- the admin did not find the payment (customer may send again)
  'FAILED',             -- provider failure (kept for providers)
  'CANCELLED'           -- cancelled or expired
));
CREATE INDEX idx_payment_orders_review ON public.payment_orders (status, updated_at)
  WHERE status IN ('RECEIPT_SUBMITTED', 'UNDER_REVIEW');

-- Transfer receipts. The same file (SHA-256) can be used only once, ever.
CREATE TABLE public.payment_receipts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES public.payment_orders (id) ON DELETE RESTRICT,
  account_id        uuid NOT NULL REFERENCES public.customer_accounts (id) ON DELETE RESTRICT,
  storage_path      text NOT NULL UNIQUE
                      CHECK (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|pdf)$'),
  sha256            text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime              text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes        integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  note              text CHECK (note IS NULL OR length(note) <= 500),
  payment_method_id uuid REFERENCES public.payment_methods (id) ON DELETE RESTRICT,
  card_snapshot     jsonb NOT NULL DEFAULT '{}'::jsonb,
  state             text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'accepted', 'rejected', 'superseded')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_payment_receipts_sha256 ON public.payment_receipts (sha256);
CREATE INDEX idx_payment_receipts_order ON public.payment_receipts (order_id, created_at DESC);
COMMENT ON TABLE public.payment_receipts IS
  'Monetization: transfer receipts in the private bucket payment-receipts. Read only by the server for admins.';

-- Admin decisions on payments: financial evidence, insert only.
CREATE TABLE public.payment_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.payment_orders (id) ON DELETE RESTRICT,
  receipt_id uuid REFERENCES public.payment_receipts (id) ON DELETE RESTRICT,
  actor_id   text NOT NULL,
  decision   text NOT NULL CHECK (decision IN ('started', 'approved', 'rejected', 'info_requested')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_reviews_order ON public.payment_reviews (order_id, created_at);

CREATE TRIGGER trg_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_payment_receipts_updated_at BEFORE UPDATE ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_payment_reviews_append_only BEFORE UPDATE OR DELETE ON public.payment_reviews
  FOR EACH ROW EXECUTE FUNCTION public.mon_audit_append_only();
CREATE TRIGGER trg_payment_reviews_no_truncate BEFORE TRUNCATE ON public.payment_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION public.mon_audit_append_only();

-- ================================================================ settings ===

-- Defaults: a manual transfer needs time, so an unpaid order lives 48 hours.
CREATE OR REPLACE FUNCTION public.mon_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
           'enabled', false,
           'listing_payment_enabled', true,
           'sticker_payment_enabled', true,
           'free_first_listing_enabled', true,
           'free_listing_limit', 1,
           'free_submissions_per_30_days', 3,
           'order_ttl_minutes', 2880,
           'revision_attempts', 3,
           'premium_features', jsonb_build_array('Premium belgisi e’lon kartasida')
         )
         || coalesce((SELECT CASE WHEN jsonb_typeof(s.value) = 'object' THEN s.value END
                      FROM public.app_settings s WHERE s.key = 'monetization_settings'), '{}'::jsonb);
$$;

-- ================================================================= pricing ===

DROP FUNCTION public.mon_quote(uuid, text, text, integer, text, boolean);
CREATE FUNCTION public.mon_quote(
  p_account_id    uuid,
  p_service       text,
  p_sticker_type  text,
  p_duration_days integer,
  p_promo_code    text,
  p_lock          boolean DEFAULT false,
  p_listing_tier  text DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_plan               public.pricing_plans%ROWTYPE;
  v_promo              public.promo_codes%ROWTYPE;
  v_code               text := upper(btrim(coalesce(p_promo_code, '')));
  v_tier               text := CASE WHEN p_service = 'listing' THEN coalesce(p_listing_tier, 'standard') END;
  v_base               bigint;
  v_promo_discount     bigint := 0;
  v_promo_error        text;
  v_promotion_id       uuid;
  v_promotion_name     text;
  v_promotion_discount bigint := 0;
  v_discount           bigint := 0;
  v_source             text;
  v_used               integer;
BEGIN
  IF v_tier IS NOT NULL AND v_tier NOT IN ('standard', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tier');
  END IF;
  SELECT * INTO v_plan
  FROM public.pricing_plans
  WHERE is_active
    AND service = p_service
    AND listing_tier IS NOT DISTINCT FROM v_tier
    AND sticker_type IS NOT DISTINCT FROM (CASE WHEN p_service = 'sticker' THEN p_sticker_type END)
    AND duration_days IS NOT DISTINCT FROM (CASE WHEN p_service = 'sticker' THEN p_duration_days END)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_price');
  END IF;
  v_base := v_plan.price_uzs;

  SELECT p.id, p.name,
         CASE WHEN p.discount_type = 'percent' THEN (v_base * p.discount_value) / 100 ELSE p.discount_value END
  INTO v_promotion_id, v_promotion_name, v_promotion_discount
  FROM public.promotions p
  WHERE p.is_active AND p_service = ANY (p.services) AND now() >= p.starts_at AND now() < p.ends_at
  ORDER BY 3 DESC
  LIMIT 1;
  v_promotion_discount := coalesce(v_promotion_discount, 0);

  IF v_code <> '' THEN
    IF p_lock THEN
      SELECT * INTO v_promo FROM public.promo_codes WHERE code = v_code FOR UPDATE;
    ELSE
      SELECT * INTO v_promo FROM public.promo_codes WHERE code = v_code;
    END IF;

    IF NOT FOUND OR NOT v_promo.is_active THEN
      v_promo_error := 'invalid';
    ELSIF v_promo.starts_at IS NOT NULL AND now() < v_promo.starts_at THEN
      v_promo_error := 'not_started';
    ELSIF v_promo.ends_at IS NOT NULL AND now() >= v_promo.ends_at THEN
      v_promo_error := 'expired';
    ELSIF NOT (p_service = ANY (v_promo.services))
       OR (p_service = 'sticker' AND v_promo.sticker_types IS NOT NULL
           AND NOT (p_sticker_type = ANY (v_promo.sticker_types))) THEN
      v_promo_error := 'not_applicable';
    ELSIF v_base < v_promo.min_order_uzs THEN
      v_promo_error := 'min_order';
    ELSE
      IF v_promo.max_uses IS NOT NULL THEN
        SELECT count(*) INTO v_used FROM public.promo_redemptions r
        WHERE r.promo_code_id = v_promo.id AND r.state IN ('reserved', 'consumed');
        IF v_used >= v_promo.max_uses THEN
          v_promo_error := 'limit_reached';
        END IF;
      END IF;
      IF v_promo_error IS NULL AND p_account_id IS NOT NULL THEN
        SELECT count(*) INTO v_used FROM public.promo_redemptions r
        WHERE r.promo_code_id = v_promo.id AND r.account_id = p_account_id AND r.state IN ('reserved', 'consumed');
        IF v_used >= v_promo.per_account_limit THEN
          v_promo_error := 'already_used';
        END IF;
      END IF;
      IF v_promo_error IS NULL THEN
        v_promo_discount := CASE WHEN v_promo.discount_type = 'percent'
                                 THEN (v_base * v_promo.discount_value) / 100
                                 ELSE v_promo.discount_value END;
      END IF;
    END IF;
  END IF;

  IF v_promo_discount > 0 AND v_promo_discount >= v_promotion_discount THEN
    v_discount := v_promo_discount;
    v_source := 'promo_code';
  ELSIF v_promotion_discount > 0 THEN
    v_discount := v_promotion_discount;
    v_source := 'promotion';
  END IF;
  v_discount := least(v_discount, v_base - 1);
  IF v_discount <= 0 THEN
    v_discount := 0;
    v_source := NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', v_plan.id,
    'plan', jsonb_build_object('service', v_plan.service, 'listing_tier', v_plan.listing_tier,
                               'sticker_type', v_plan.sticker_type,
                               'duration_days', v_plan.duration_days, 'price_uzs', v_plan.price_uzs),
    'base', v_base,
    'discount', v_discount,
    'final', v_base - v_discount,
    'discount_source', v_source,
    'promo_code_id', CASE WHEN v_source = 'promo_code' THEN v_promo.id END,
    'promo_error', v_promo_error,
    'promo_not_applied', (v_promo_error IS NULL AND v_promo_discount > 0 AND v_source = 'promotion'),
    'promotion_id', CASE WHEN v_source = 'promotion' THEN v_promotion_id END,
    'promotion_name', CASE WHEN v_source = 'promotion' THEN v_promotion_name END
  );
END;
$$;

DROP FUNCTION public.mon_set_price(text, text, integer, bigint, text);
CREATE FUNCTION public.mon_set_price(
  p_service text, p_sticker_type text, p_duration_days integer, p_price_uzs bigint, p_actor_id text,
  p_listing_tier text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_old     public.pricing_plans%ROWTYPE;
  v_id      uuid;
  v_tier    text := CASE WHEN p_service = 'listing' THEN coalesce(p_listing_tier, 'standard') END;
  v_sticker text := CASE WHEN p_service = 'sticker' THEN p_sticker_type END;
  v_days    integer := CASE WHEN p_service = 'sticker' THEN p_duration_days END;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'mon_price:' || p_service || ':' || coalesce(v_tier, '') || ':' || coalesce(v_sticker, '') || ':' || coalesce(v_days, 0), 0));
  SELECT * INTO v_old FROM public.pricing_plans
  WHERE is_active AND service = p_service
    AND listing_tier IS NOT DISTINCT FROM v_tier
    AND sticker_type IS NOT DISTINCT FROM v_sticker AND duration_days IS NOT DISTINCT FROM v_days
  FOR UPDATE;
  IF FOUND THEN
    UPDATE public.pricing_plans SET is_active = false WHERE id = v_old.id;
  END IF;
  INSERT INTO public.pricing_plans (service, listing_tier, sticker_type, duration_days, price_uzs, is_active)
  VALUES (p_service, v_tier, v_sticker, v_days, p_price_uzs, true)
  RETURNING id INTO v_id;
  PERFORM public.mon_audit('admin', p_actor_id, 'price.set', 'pricing_plan', v_id::text,
    CASE WHEN v_old.id IS NOT NULL THEN jsonb_build_object('plan_id', v_old.id, 'price_uzs', v_old.price_uzs) END,
    jsonb_build_object('service', p_service, 'listing_tier', v_tier, 'sticker_type', v_sticker,
                       'duration_days', v_days, 'price_uzs', p_price_uzs));
  RETURN v_id;
END;
$$;

-- ======================================================== listing terms ===

DROP FUNCTION public.mon_listing_terms(uuid, text, text, boolean);
CREATE FUNCTION public.mon_listing_terms(
  p_account_id uuid, p_contact_phone text, p_promo_code text, p_lock boolean DEFAULT false,
  p_listing_tier text DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_settings jsonb := public.mon_settings();
  v_limit    integer := coalesce((v_settings ->> 'free_listing_limit')::integer, 1);
  v_per30    integer := coalesce((v_settings ->> 'free_submissions_per_30_days')::integer, 3);
  v_tier     text := coalesce(p_listing_tier, 'standard');
  v_live     integer := 0;
  v_recent   integer := 0;
  v_conflict boolean := false;
BEGIN
  IF v_tier NOT IN ('standard', 'premium') THEN
    RAISE EXCEPTION 'MON:invalid_tier';
  END IF;
  IF NOT coalesce((v_settings ->> 'enabled')::boolean, false) THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;
  IF NOT coalesce((v_settings ->> 'listing_payment_enabled')::boolean, true) THEN
    RETURN jsonb_build_object('enabled', true, 'billing', 'free', 'free_reason', 'payments_disabled', 'listing_tier', v_tier);
  END IF;

  -- The free first listing is a Standard listing; Premium is always paid.
  IF v_tier = 'standard' AND coalesce((v_settings ->> 'free_first_listing_enabled')::boolean, true) THEN
    IF p_lock AND p_contact_phone IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('mon_free_phone:' || p_contact_phone, 0));
    END IF;
    IF p_account_id IS NOT NULL THEN
      SELECT count(*) FILTER (WHERE c.state IN ('reserved', 'consumed')),
             count(*) FILTER (WHERE c.created_at > now() - interval '30 days')
      INTO v_live, v_recent
      FROM public.free_listing_claims c WHERE c.account_id = p_account_id;
    END IF;
    IF p_contact_phone IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.free_listing_claims c
        WHERE c.phone_e164 = p_contact_phone
          AND c.account_id IS DISTINCT FROM p_account_id
          AND c.state IN ('reserved', 'consumed')
      ) INTO v_conflict;
    END IF;
    IF v_live < v_limit AND v_recent < v_per30 AND NOT v_conflict THEN
      RETURN jsonb_build_object('enabled', true, 'billing', 'free', 'free_reason', 'first_listing',
                                'free_used', v_live, 'free_limit', v_limit, 'listing_tier', v_tier);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true, 'billing', 'paid', 'phone_conflict', v_conflict, 'listing_tier', v_tier,
    'free_used', v_live, 'free_limit', v_limit, 'free_recent', v_recent,
    'quote', public.mon_quote(p_account_id, 'listing', NULL, NULL, p_promo_code, p_lock, v_tier)
  );
END;
$$;

-- ============================================================ submissions ===

DROP FUNCTION public.mon_submit_listing(uuid, uuid, text, text, text, boolean, text, jsonb, text[], text, text, text);
CREATE FUNCTION public.mon_submit_listing(
  p_account_id        uuid,
  p_identity_id       uuid,
  p_channel           text,
  p_contact_name      text,
  p_contact_phone     text,
  p_phone_verified    boolean,
  p_preferred_channel text,
  p_payload           jsonb,
  p_photos            text[],
  p_promo_code        text,
  p_idempotency_key   text,
  p_ip_hash           text,
  p_listing_tier      text DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_account  public.customer_accounts%ROWTYPE;
  v_existing public.listing_submissions%ROWTYPE;
  v_sub      public.listing_submissions%ROWTYPE;
  v_order    public.payment_orders%ROWTYPE;
  v_terms    jsonb;
  v_quote    jsonb;
  v_billing  text;
  v_tier     text := coalesce(p_listing_tier, 'standard');
  v_flags    jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_account FROM public.customer_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:account_not_found';
  END IF;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'MON:account_blocked';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.listing_submissions
    WHERE account_id = p_account_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'submission_id', v_existing.id, 'billing', v_existing.billing, 'listing_tier', v_existing.listing_tier,
        'moderation_status', v_existing.moderation_status, 'idempotent', true,
        'order_id', (SELECT o.id FROM public.payment_orders o WHERE o.submission_id = v_existing.id
                     ORDER BY o.created_at DESC LIMIT 1));
    END IF;
  END IF;

  v_terms := public.mon_listing_terms(p_account_id, p_contact_phone, p_promo_code, true, v_tier);
  IF NOT coalesce((v_terms ->> 'enabled')::boolean, false) THEN
    RAISE EXCEPTION 'MON:monetization_disabled';
  END IF;
  v_billing := v_terms ->> 'billing';
  IF coalesce((v_terms ->> 'phone_conflict')::boolean, false) THEN
    v_flags := v_flags || jsonb_build_object('phone_conflict', true);
  END IF;
  IF v_billing = 'paid' THEN
    v_quote := v_terms -> 'quote';
    IF NOT coalesce((v_quote ->> 'ok')::boolean, false) THEN
      RAISE EXCEPTION 'MON:%', coalesce(v_quote ->> 'reason', 'no_price');
    END IF;
  END IF;

  INSERT INTO public.listing_submissions
    (account_id, identity_id, channel, contact_name, contact_phone, phone_verified, preferred_channel,
     payload, photos, billing, free_reason, moderation_status, flags, idempotency_key, ip_hash, submitted_at, listing_tier)
  VALUES
    (p_account_id, p_identity_id, coalesce(p_channel, 'web'), btrim(p_contact_name), p_contact_phone,
     coalesce(p_phone_verified, false), coalesce(p_preferred_channel, 'phone'),
     coalesce(p_payload, '{}'::jsonb), coalesce(p_photos, '{}'), v_billing, v_terms ->> 'free_reason',
     CASE WHEN v_billing = 'paid' THEN 'AWAITING_PAYMENT' ELSE 'PENDING_REVIEW' END,
     v_flags, p_idempotency_key, p_ip_hash,
     CASE WHEN v_billing = 'paid' THEN NULL ELSE now() END, v_tier)
  RETURNING * INTO v_sub;

  IF v_terms ->> 'free_reason' = 'first_listing' THEN
    INSERT INTO public.free_listing_claims (account_id, submission_id, phone_e164, phone_verified, state)
    VALUES (p_account_id, v_sub.id, p_contact_phone, coalesce(p_phone_verified, false), 'reserved');
    PERFORM public.mon_audit('customer', p_account_id::text, 'free_claim.reserved', 'listing_submission', v_sub.id::text);
  END IF;

  PERFORM public.mon_audit('customer', p_account_id::text, 'submission.created', 'listing_submission', v_sub.id::text,
    NULL, jsonb_build_object('billing', v_billing, 'listing_tier', v_tier, 'status', v_sub.moderation_status, 'flags', v_flags),
    NULL, p_ip_hash);

  IF v_billing = 'paid' THEN
    v_order := public.mon_create_order(p_account_id, 'listing', v_sub.id, NULL, v_quote);
  END IF;

  RETURN jsonb_build_object(
    'submission_id', v_sub.id, 'billing', v_billing, 'free_reason', v_terms ->> 'free_reason',
    'listing_tier', v_tier, 'moderation_status', v_sub.moderation_status, 'idempotent', false,
    'order_id', v_order.id, 'amount', v_order.final_amount_uzs, 'base', v_order.base_amount_uzs,
    'discount', v_order.discount_uzs, 'promo_error', v_quote ->> 'promo_error',
    'phone_conflict', coalesce((v_terms ->> 'phone_conflict')::boolean, false));
END;
$$;

-- Return the open order of a submission awaiting payment, or create a new one.
-- An order with a receipt (sent, being checked, rejected, info requested) stays open.
CREATE OR REPLACE FUNCTION public.mon_ensure_listing_order(p_submission_id uuid, p_account_id uuid, p_promo_code text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sub   public.listing_submissions%ROWTYPE;
  v_order public.payment_orders%ROWTYPE;
  v_quote jsonb;
BEGIN
  SELECT * INTO v_sub FROM public.listing_submissions
  WHERE id = p_submission_id AND account_id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;
  IF v_sub.moderation_status <> 'AWAITING_PAYMENT' THEN
    RAISE EXCEPTION 'MON:not_awaiting_payment';
  END IF;

  SELECT * INTO v_order FROM public.payment_orders
  WHERE submission_id = v_sub.id AND status IN ('PENDING', 'RECEIPT_SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'REJECTED')
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND v_order.status = 'PENDING' AND v_order.expires_at <= now() THEN
    PERFORM public.mon_expire_order(v_order.id);
    v_order := NULL;
  END IF;

  IF v_order.id IS NULL THEN
    v_quote := public.mon_quote(p_account_id, 'listing', NULL, NULL, p_promo_code, true, v_sub.listing_tier);
    IF NOT coalesce((v_quote ->> 'ok')::boolean, false) THEN
      RAISE EXCEPTION 'MON:%', coalesce(v_quote ->> 'reason', 'no_price');
    END IF;
    v_order := public.mon_create_order(p_account_id, 'listing', v_sub.id, NULL, v_quote);
  END IF;

  RETURN jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'amount', v_order.final_amount_uzs,
    'base', v_order.base_amount_uzs, 'discount', v_order.discount_uzs,
    'expires_at', v_order.expires_at, 'promo_error', v_quote ->> 'promo_error');
END;
$$;

CREATE OR REPLACE FUNCTION public.mon_ensure_boost_order(p_boost_id uuid, p_account_id uuid, p_promo_code text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_boost public.property_boosts%ROWTYPE;
  v_order public.payment_orders%ROWTYPE;
  v_quote jsonb;
BEGIN
  SELECT * INTO v_boost FROM public.property_boosts
  WHERE id = p_boost_id AND account_id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;
  IF v_boost.status <> 'AWAITING_PAYMENT' THEN
    RAISE EXCEPTION 'MON:not_awaiting_payment';
  END IF;

  SELECT * INTO v_order FROM public.payment_orders
  WHERE boost_id = v_boost.id AND status IN ('PENDING', 'RECEIPT_SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'REJECTED')
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND v_order.status = 'PENDING' AND v_order.expires_at <= now() THEN
    PERFORM public.mon_expire_order(v_order.id);
    v_order := NULL;
  END IF;

  IF v_order.id IS NULL THEN
    v_quote := public.mon_quote(p_account_id, 'sticker', v_boost.sticker_type, v_boost.duration_days, p_promo_code, true);
    IF NOT coalesce((v_quote ->> 'ok')::boolean, false) THEN
      RAISE EXCEPTION 'MON:%', coalesce(v_quote ->> 'reason', 'no_price');
    END IF;
    v_order := public.mon_create_order(p_account_id, 'sticker', NULL, v_boost.id, v_quote);
  END IF;

  RETURN jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'amount', v_order.final_amount_uzs,
    'base', v_order.base_amount_uzs, 'discount', v_order.discount_uzs,
    'expires_at', v_order.expires_at, 'promo_error', v_quote ->> 'promo_error');
END;
$$;

-- The customer (or the system) closes an unpaid order. A receipt that is being
-- checked cannot be withdrawn: the admin decides first.
CREATE OR REPLACE FUNCTION public.mon_close_order(
  p_order_id uuid, p_status text, p_reason text, p_actor_type text, p_actor_id text, p_account_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_status NOT IN ('FAILED', 'CANCELLED') THEN
    RAISE EXCEPTION 'MON:invalid_status';
  END IF;
  UPDATE public.payment_orders
  SET status = p_status, status_reason = p_reason, cancelled_at = now()
  WHERE id = p_order_id AND status IN ('PENDING', 'INFO_REQUESTED', 'REJECTED')
    AND (p_account_id IS NULL OR account_id = p_account_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RETURN 'not_pending';
  END IF;
  PERFORM public.mon_release_promo(p_order_id);
  PERFORM public.mon_audit(p_actor_type, p_actor_id, 'order.' || lower(p_status), 'payment_order', p_order_id::text,
    NULL, NULL, p_reason);
  RETURN lower(p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.mon_cancel_submission(p_submission_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sub    public.listing_submissions%ROWTYPE;
  v_order  public.payment_orders%ROWTYPE;
  v_refund uuid;
BEGIN
  SELECT * INTO v_sub FROM public.listing_submissions
  WHERE id = p_submission_id AND account_id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;

  IF v_sub.moderation_status = 'AWAITING_PAYMENT' THEN
    IF EXISTS (SELECT 1 FROM public.payment_orders o
               WHERE o.submission_id = v_sub.id AND o.status IN ('RECEIPT_SUBMITTED', 'UNDER_REVIEW')) THEN
      RAISE EXCEPTION 'MON:payment_under_review';
    END IF;
    FOR v_order IN SELECT * FROM public.payment_orders
                   WHERE submission_id = v_sub.id AND status IN ('PENDING', 'INFO_REQUESTED', 'REJECTED') LOOP
      PERFORM public.mon_close_order(v_order.id, 'CANCELLED', 'submission_cancelled', 'customer', p_account_id::text);
    END LOOP;
  ELSIF v_sub.moderation_status IN ('PENDING_REVIEW', 'REVISION_REQUIRED') THEN
    UPDATE public.free_listing_claims SET state = 'released', settled_at = now()
    WHERE submission_id = v_sub.id AND state = 'reserved';
    SELECT * INTO v_order FROM public.payment_orders
    WHERE submission_id = v_sub.id AND status = 'PAID' ORDER BY paid_at DESC LIMIT 1;
    IF FOUND THEN
      v_refund := public.mon_request_refund(v_order.id, 'cancelled_by_user', 'customer', p_account_id::text);
      PERFORM public.mon_release_promo(v_order.id);
    END IF;
  ELSE
    RAISE EXCEPTION 'MON:invalid_state';
  END IF;

  UPDATE public.listing_submissions SET moderation_status = 'CANCELLED_BY_USER' WHERE id = v_sub.id;
  PERFORM public.mon_audit('customer', p_account_id::text, 'submission.cancelled', 'listing_submission', v_sub.id::text,
    jsonb_build_object('status', v_sub.moderation_status), jsonb_build_object('status', 'CANCELLED_BY_USER', 'refund_id', v_refund));
  RETURN jsonb_build_object('status', 'CANCELLED_BY_USER', 'refund_id', v_refund);
END;
$$;

CREATE OR REPLACE FUNCTION public.mon_cancel_boost(p_boost_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_boost  public.property_boosts%ROWTYPE;
  v_order  public.payment_orders%ROWTYPE;
  v_refund uuid;
BEGIN
  SELECT * INTO v_boost FROM public.property_boosts
  WHERE id = p_boost_id AND account_id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;

  IF v_boost.status = 'AWAITING_PAYMENT' THEN
    IF EXISTS (SELECT 1 FROM public.payment_orders o
               WHERE o.boost_id = v_boost.id AND o.status IN ('RECEIPT_SUBMITTED', 'UNDER_REVIEW')) THEN
      RAISE EXCEPTION 'MON:payment_under_review';
    END IF;
    FOR v_order IN SELECT * FROM public.payment_orders
                   WHERE boost_id = v_boost.id AND status IN ('PENDING', 'INFO_REQUESTED', 'REJECTED') LOOP
      PERFORM public.mon_close_order(v_order.id, 'CANCELLED', 'boost_cancelled', 'customer', p_account_id::text);
    END LOOP;
  ELSIF v_boost.status = 'PENDING_APPROVAL' THEN
    SELECT * INTO v_order FROM public.payment_orders
    WHERE boost_id = v_boost.id AND status = 'PAID' ORDER BY paid_at DESC LIMIT 1;
    IF FOUND THEN
      v_refund := public.mon_request_refund(v_order.id, 'boost_cancelled_by_user', 'customer', p_account_id::text);
      PERFORM public.mon_release_promo(v_order.id);
    END IF;
  ELSE
    RAISE EXCEPTION 'MON:invalid_state';
  END IF;

  UPDATE public.property_boosts SET status = 'CANCELLED' WHERE id = v_boost.id;
  PERFORM public.mon_audit('customer', p_account_id::text, 'boost.cancelled', 'property_boost', v_boost.id::text,
    jsonb_build_object('status', v_boost.status), jsonb_build_object('status', 'CANCELLED', 'refund_id', v_refund));
  RETURN jsonb_build_object('status', 'CANCELLED', 'refund_id', v_refund);
END;
$$;

-- ================================================================ refunds ===
-- The refund outcome is stored only in public.refunds. The payment stays PAID.
CREATE OR REPLACE FUNCTION public.mon_settle_refund(
  p_refund_id uuid, p_status text, p_provider_ref text, p_note text, p_actor_type text, p_actor_id text
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_ref public.refunds%ROWTYPE;
  v_ok  boolean;
BEGIN
  SELECT * INTO v_ref FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;

  v_ok := CASE v_ref.status
            WHEN 'REQUESTED' THEN p_status IN ('PROCESSING', 'SUCCEEDED', 'FAILED', 'MANUAL_REQUIRED')
            WHEN 'PROCESSING' THEN p_status IN ('SUCCEEDED', 'FAILED', 'MANUAL_REQUIRED')
            WHEN 'MANUAL_REQUIRED' THEN p_status IN ('MANUAL_CONFIRMED', 'FAILED')
            ELSE false
          END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'MON:invalid_transition';
  END IF;
  IF p_status = 'MANUAL_CONFIRMED' AND coalesce(btrim(p_provider_ref), '') = '' THEN
    RAISE EXCEPTION 'MON:reference_required';
  END IF;

  UPDATE public.refunds
  SET status = p_status,
      provider_ref = coalesce(p_provider_ref, provider_ref),
      note = coalesce(p_note, note),
      completed_at = CASE WHEN p_status IN ('SUCCEEDED', 'MANUAL_CONFIRMED', 'FAILED') THEN now() ELSE completed_at END
  WHERE id = p_refund_id;

  IF p_status IN ('SUCCEEDED', 'MANUAL_CONFIRMED') THEN
    -- A refunded sticker stops showing at once.
    UPDATE public.property_boosts SET status = 'REVOKED', admin_note = coalesce(admin_note, 'refunded')
    WHERE id = (SELECT o.boost_id FROM public.payment_orders o WHERE o.id = v_ref.order_id)
      AND status IN ('ACTIVE', 'PENDING_APPROVAL');
  END IF;

  PERFORM public.mon_audit(p_actor_type, p_actor_id, 'refund.' || lower(p_status), 'refund', p_refund_id::text,
    jsonb_build_object('status', v_ref.status),
    jsonb_build_object('status', p_status, 'provider_ref', p_provider_ref, 'order_id', v_ref.order_id), p_note);
  RETURN p_status;
END;
$$;

-- =================================================== manual card payment ===

-- Admin sets the card. A different card becomes a new row; the old one is kept.
CREATE FUNCTION public.mon_set_payment_method(
  p_card_number text, p_holder_name text, p_bank_name text, p_instructions text, p_accepting boolean, p_actor_id text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_old    public.payment_methods%ROWTYPE;
  v_id     uuid;
  v_number text := regexp_replace(coalesce(p_card_number, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_number !~ '^[0-9]{16}$' THEN
    RAISE EXCEPTION 'MON:invalid_card';
  END IF;
  IF length(btrim(coalesce(p_holder_name, ''))) < 3 THEN
    RAISE EXCEPTION 'MON:invalid_holder';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mon_payment_method', 0));
  SELECT * INTO v_old FROM public.payment_methods WHERE is_active AND kind = 'manual_card' FOR UPDATE;

  IF FOUND AND v_old.card_number = v_number AND v_old.holder_name = btrim(p_holder_name)
     AND v_old.bank_name IS NOT DISTINCT FROM nullif(btrim(coalesce(p_bank_name, '')), '') THEN
    UPDATE public.payment_methods
    SET instructions = nullif(btrim(coalesce(p_instructions, '')), ''), accepting = coalesce(p_accepting, true)
    WHERE id = v_old.id;
    v_id := v_old.id;
  ELSE
    IF FOUND THEN
      UPDATE public.payment_methods SET is_active = false WHERE id = v_old.id;
    END IF;
    INSERT INTO public.payment_methods (card_number, holder_name, bank_name, instructions, accepting, created_by)
    VALUES (v_number, btrim(p_holder_name), nullif(btrim(coalesce(p_bank_name, '')), ''),
            nullif(btrim(coalesce(p_instructions, '')), ''), coalesce(p_accepting, true), p_actor_id)
    RETURNING id INTO v_id;
  END IF;

  PERFORM public.mon_audit('admin', p_actor_id, 'payment_method.set', 'payment_method', v_id::text,
    CASE WHEN v_old.id IS NOT NULL THEN jsonb_build_object('id', v_old.id, 'last4', right(v_old.card_number, 4),
                                                           'accepting', v_old.accepting) END,
    jsonb_build_object('last4', right(v_number, 4), 'holder', btrim(p_holder_name), 'accepting', coalesce(p_accepting, true)));
  RETURN v_id;
END;
$$;

-- The customer sent a transfer receipt (the file is already in private storage,
-- checked by the server). The only payment step a customer can take.
CREATE FUNCTION public.mon_submit_receipt(
  p_order_id uuid, p_account_id uuid, p_storage_path text, p_sha256 text, p_mime text, p_size_bytes integer, p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order   public.payment_orders%ROWTYPE;
  v_method  public.payment_methods%ROWTYPE;
  v_receipt uuid;
BEGIN
  SELECT * INTO v_order FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.account_id IS DISTINCT FROM p_account_id THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;
  -- (An expired order is closed later by mon_ensure_*_order; raising here would undo any update.)
  IF v_order.status = 'PENDING' AND v_order.expires_at <= now() THEN
    RAISE EXCEPTION 'MON:order_expired';
  END IF;
  IF v_order.status = 'PAID' THEN
    RAISE EXCEPTION 'MON:already_paid';
  END IF;
  IF v_order.status IN ('RECEIPT_SUBMITTED', 'UNDER_REVIEW') THEN
    RAISE EXCEPTION 'MON:receipt_under_review';
  END IF;
  IF v_order.status NOT IN ('PENDING', 'INFO_REQUESTED', 'REJECTED') THEN
    RAISE EXCEPTION 'MON:order_closed';
  END IF;

  SELECT * INTO v_method FROM public.payment_methods WHERE is_active AND kind = 'manual_card';
  IF NOT FOUND OR NOT v_method.accepting THEN
    RAISE EXCEPTION 'MON:payments_closed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_receipts r WHERE r.sha256 = lower(p_sha256)) THEN
    RAISE EXCEPTION 'MON:receipt_reused';
  END IF;
  IF p_storage_path NOT LIKE p_account_id::text || '/' || p_order_id::text || '/%' THEN
    RAISE EXCEPTION 'MON:invalid_receipt';
  END IF;

  UPDATE public.payment_receipts SET state = 'superseded' WHERE order_id = v_order.id AND state = 'submitted';
  INSERT INTO public.payment_receipts
    (order_id, account_id, storage_path, sha256, mime, size_bytes, note, payment_method_id, card_snapshot)
  VALUES
    (v_order.id, p_account_id, p_storage_path, lower(p_sha256), p_mime, p_size_bytes,
     nullif(btrim(coalesce(p_note, '')), ''), v_method.id,
     jsonb_build_object('last4', right(v_method.card_number, 4), 'holder', v_method.holder_name, 'bank', v_method.bank_name))
  RETURNING id INTO v_receipt;

  UPDATE public.payment_orders
  SET status = 'RECEIPT_SUBMITTED', status_reason = NULL, payment_method_id = v_method.id
  WHERE id = v_order.id;

  PERFORM public.mon_audit('customer', p_account_id::text, 'receipt.submitted', 'payment_order', v_order.id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'RECEIPT_SUBMITTED', 'receipt_id', v_receipt, 'sha256', lower(p_sha256),
                       'size', p_size_bytes, 'mime', p_mime));
  RETURN jsonb_build_object('order_id', v_order.id, 'receipt_id', v_receipt, 'status', 'RECEIPT_SUBMITTED');
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'MON:receipt_reused';
END;
$$;

-- Admin decision on a receipt: start / approve / reject / request_info.
-- Row lock + status check: an order can be approved once only.
CREATE FUNCTION public.mon_review_payment(p_order_id uuid, p_action text, p_note text, p_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order   public.payment_orders%ROWTYPE;
  v_receipt public.payment_receipts%ROWTYPE;
  v_new     text;
  v_count   integer := 0;
  v_refund  uuid;
  v_target  text := 'ok';
BEGIN
  IF coalesce(btrim(p_actor_id), '') = '' THEN
    RAISE EXCEPTION 'MON:actor_required';
  END IF;
  SELECT * INTO v_order FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;
  IF v_order.status = 'PAID' THEN
    RAISE EXCEPTION 'MON:already_paid';
  END IF;
  IF v_order.status NOT IN ('RECEIPT_SUBMITTED', 'UNDER_REVIEW') THEN
    RAISE EXCEPTION 'MON:nothing_to_review';
  END IF;
  SELECT * INTO v_receipt FROM public.payment_receipts
  WHERE order_id = v_order.id AND state = 'submitted' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:nothing_to_review';
  END IF;

  IF p_action = 'start' THEN
    IF v_order.status = 'UNDER_REVIEW' THEN
      RETURN jsonb_build_object('status', 'UNDER_REVIEW', 'changed', false);
    END IF;
    v_new := 'UNDER_REVIEW';
    UPDATE public.payment_orders SET status = v_new WHERE id = v_order.id;
    INSERT INTO public.payment_reviews (order_id, receipt_id, actor_id, decision) VALUES (v_order.id, v_receipt.id, p_actor_id, 'started');

  ELSIF p_action = 'approve' THEN
    v_new := 'PAID';
    INSERT INTO public.payment_transactions (order_id, provider, provider_txn_id, amount_uzs, state, raw)
    VALUES (v_order.id, 'manual_card', 'receipt:' || v_receipt.id::text, v_order.final_amount_uzs, 'performed',
            jsonb_build_object('receipt_id', v_receipt.id, 'sha256', v_receipt.sha256, 'payment_method_id', v_receipt.payment_method_id,
                               'card', v_receipt.card_snapshot, 'approved_by', p_actor_id));
    UPDATE public.payment_orders
    SET status = v_new, paid_at = now(), provider = 'manual_card', status_reason = NULL,
        reviewed_at = now(), reviewed_by = p_actor_id
    WHERE id = v_order.id;
    UPDATE public.payment_receipts SET state = 'accepted' WHERE id = v_receipt.id;
    UPDATE public.promo_redemptions SET state = 'consumed', settled_at = now()
    WHERE order_id = v_order.id AND state = 'reserved';

    -- Paid listing -> moderation queue (never public here). Paid sticker -> admin approval.
    IF v_order.submission_id IS NOT NULL THEN
      UPDATE public.listing_submissions SET moderation_status = 'PENDING_REVIEW', submitted_at = now()
      WHERE id = v_order.submission_id AND moderation_status = 'AWAITING_PAYMENT';
      GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSIF v_order.boost_id IS NOT NULL THEN
      UPDATE public.property_boosts SET status = 'PENDING_APPROVAL'
      WHERE id = v_order.boost_id AND status = 'AWAITING_PAYMENT';
      GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;
    IF v_count = 0 THEN
      -- The service was closed while the receipt was waiting: money came in, so a refund is due.
      v_target := 'closed';
      v_refund := public.mon_request_refund(v_order.id, 'service_closed_before_payment_review', 'system', p_actor_id);
      PERFORM public.mon_release_promo(v_order.id);
    END IF;
    INSERT INTO public.payment_reviews (order_id, receipt_id, actor_id, decision) VALUES (v_order.id, v_receipt.id, p_actor_id, 'approved');

  ELSIF p_action IN ('reject', 'request_info') THEN
    IF coalesce(btrim(p_note), '') = '' THEN
      RAISE EXCEPTION 'MON:reason_required';
    END IF;
    v_new := CASE p_action WHEN 'reject' THEN 'REJECTED' ELSE 'INFO_REQUESTED' END;
    UPDATE public.payment_orders
    SET status = v_new, status_reason = btrim(p_note), reviewed_at = now(), reviewed_by = p_actor_id
    WHERE id = v_order.id;
    IF p_action = 'reject' THEN
      UPDATE public.payment_receipts SET state = 'rejected' WHERE id = v_receipt.id;
    END IF;
    INSERT INTO public.payment_reviews (order_id, receipt_id, actor_id, decision, note)
    VALUES (v_order.id, v_receipt.id, p_actor_id, CASE p_action WHEN 'reject' THEN 'rejected' ELSE 'info_requested' END, btrim(p_note));

  ELSE
    RAISE EXCEPTION 'MON:invalid_action';
  END IF;

  PERFORM public.mon_audit('admin', p_actor_id, 'payment.' || p_action, 'payment_order', v_order.id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', v_new, 'receipt_id', v_receipt.id, 'amount', v_order.final_amount_uzs,
                       'target', v_target, 'refund_id', v_refund),
    p_note);
  RETURN jsonb_build_object('status', v_new, 'receipt_id', v_receipt.id, 'target', v_target, 'refund_id', v_refund);
END;
$$;

-- ======================================================== Premium seed price ===
-- Premium 120 000 UZS, only if no Premium price exists yet (admins can change it).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pricing_plans WHERE service = 'listing' AND listing_tier = 'premium' AND is_active) THEN
    INSERT INTO public.pricing_plans (service, listing_tier, price_uzs, is_active, sort_order)
    VALUES ('listing', 'premium', 120000, true, 1);
  END IF;
END $$;

-- ================================================================ storage ===
-- Private bucket for receipts. No storage policies: only the server (service role)
-- reads and writes; admins see a receipt through a short signed URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-receipts', 'payment-receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ================================================================ security ===
ALTER TABLE public.payment_methods  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reviews  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_methods, public.payment_receipts, public.payment_reviews
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_methods  TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_receipts TO service_role;
GRANT SELECT, INSERT         ON TABLE public.payment_reviews  TO service_role;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mon_settings()',
    'public.mon_quote(uuid,text,text,integer,text,boolean,text)',
    'public.mon_set_price(text,text,integer,bigint,text,text)',
    'public.mon_listing_terms(uuid,text,text,boolean,text)',
    'public.mon_submit_listing(uuid,uuid,text,text,text,boolean,text,jsonb,text[],text,text,text,text)',
    'public.mon_ensure_listing_order(uuid,uuid,text)',
    'public.mon_ensure_boost_order(uuid,uuid,text)',
    'public.mon_close_order(uuid,text,text,text,text,uuid)',
    'public.mon_cancel_submission(uuid,uuid)',
    'public.mon_cancel_boost(uuid,uuid)',
    'public.mon_settle_refund(uuid,text,text,text,text,text)',
    'public.mon_set_payment_method(text,text,text,text,boolean,text)',
    'public.mon_submit_receipt(uuid,uuid,text,text,text,integer,text)',
    'public.mon_review_payment(uuid,text,text,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
