-- =============================================================================
-- ANGREN ESTATE — monetization 1b: listing submissions, free right, orders,
-- payments, refunds, promo codes, promotions and paid stickers (boosts)
--
-- Additive only: new tables, functions and one private storage bucket. Existing
-- tables are not modified (new tables reference properties.id with ON DELETE SET NULL).
-- Apply to the TEST project first. Rollback:
--   supabase/rollback/20261126160000_monetization_1b_listings_payments.down.sql
--
-- Same access model as 1a: RLS on, no policies, no privileges for anon /
-- authenticated; functions are SECURITY INVOKER with an empty search_path and
-- executable by service_role only. Business errors are raised as 'MON:<code>'.
-- Monetization stays OFF until an admin enables it (mon_settings defaults).
-- =============================================================================

-- ================================================================== tables ===

CREATE TABLE public.listing_submissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES public.customer_accounts (id) ON DELETE RESTRICT,
  identity_id       uuid REFERENCES public.customer_identities (id) ON DELETE SET NULL,
  channel           text NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'telegram')),
  contact_name      text NOT NULL CHECK (length(btrim(contact_name)) BETWEEN 1 AND 120),
  contact_phone     text NOT NULL CHECK (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified    boolean NOT NULL DEFAULT false,
  preferred_channel text NOT NULL DEFAULT 'phone' CHECK (preferred_channel IN ('phone', 'telegram')),
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  photos            text[] NOT NULL DEFAULT '{}' CHECK (cardinality(photos) <= 10),
  billing           text NOT NULL CHECK (billing IN ('free', 'paid')),
  free_reason       text CHECK (free_reason IN ('first_listing', 'payments_disabled')),
  moderation_status text NOT NULL CHECK (moderation_status IN
                      ('AWAITING_PAYMENT', 'PENDING_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED_BY_USER')),
  revision_count    integer NOT NULL DEFAULT 0 CHECK (revision_count >= 0),
  admin_note        text,
  flags             jsonb NOT NULL DEFAULT '{}'::jsonb,
  property_id       varchar UNIQUE REFERENCES public.properties (id) ON DELETE SET NULL,
  idempotency_key   text,
  ip_hash           text,
  submitted_at      timestamptz,
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_listing_submission_idempotency UNIQUE (account_id, idempotency_key)
);
CREATE INDEX idx_listing_submissions_account ON public.listing_submissions (account_id, created_at DESC);
CREATE INDEX idx_listing_submissions_status ON public.listing_submissions (moderation_status, submitted_at);
COMMENT ON TABLE public.listing_submissions IS
  'Monetization: user listing applications. Never public; a property is created only on admin approval (as draft).';

CREATE TABLE public.free_listing_claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES public.customer_accounts (id) ON DELETE RESTRICT,
  submission_id  uuid NOT NULL UNIQUE REFERENCES public.listing_submissions (id) ON DELETE RESTRICT,
  phone_e164     text,
  phone_verified boolean NOT NULL DEFAULT false,
  state          text NOT NULL CHECK (state IN ('reserved', 'consumed', 'released')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  settled_at     timestamptz
);
CREATE INDEX idx_free_claims_account ON public.free_listing_claims (account_id, state);
CREATE INDEX idx_free_claims_phone ON public.free_listing_claims (phone_e164) WHERE state IN ('reserved', 'consumed');
COMMENT ON TABLE public.free_listing_claims IS
  'Monetization: free first listing right. reserved on submit, consumed on approval, released on rejection or cancel.';

CREATE TABLE public.promo_codes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{3,32}$'),
  discount_type     text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value    bigint NOT NULL CHECK (discount_value > 0),
  services          text[] NOT NULL DEFAULT ARRAY['listing', 'sticker']
                      CHECK (cardinality(services) > 0 AND services <@ ARRAY['listing', 'sticker']),
  sticker_types     text[] CHECK (sticker_types IS NULL OR sticker_types <@ ARRAY['top', 'tez_sotiladi', 'yaxshi_taklif']),
  min_order_uzs     bigint NOT NULL DEFAULT 0 CHECK (min_order_uzs >= 0),
  max_uses          integer CHECK (max_uses IS NULL OR max_uses > 0),
  per_account_limit integer NOT NULL DEFAULT 1 CHECK (per_account_limit > 0),
  starts_at         timestamptz,
  ends_at           timestamptz,
  is_active         boolean NOT NULL DEFAULT true,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_promo_percent CHECK (discount_type <> 'percent' OR discount_value BETWEEN 1 AND 99),
  CONSTRAINT chk_promo_dates CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE public.promotions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  discount_type  text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value bigint NOT NULL CHECK (discount_value > 0),
  services       text[] NOT NULL DEFAULT ARRAY['listing', 'sticker']
                   CHECK (cardinality(services) > 0 AND services <@ ARRAY['listing', 'sticker']),
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_promotion_percent CHECK (discount_type <> 'percent' OR discount_value BETWEEN 1 AND 99),
  CONSTRAINT chk_promotion_dates CHECK (ends_at > starts_at)
);

CREATE TABLE public.property_boosts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES public.customer_accounts (id) ON DELETE RESTRICT,
  submission_id   uuid REFERENCES public.listing_submissions (id) ON DELETE SET NULL,
  property_id     varchar REFERENCES public.properties (id) ON DELETE SET NULL,
  property_title  text,
  sticker_type    text NOT NULL CHECK (sticker_type IN ('top', 'tez_sotiladi', 'yaxshi_taklif')),
  duration_days   integer NOT NULL CHECK (duration_days BETWEEN 1 AND 365),
  billing         text NOT NULL CHECK (billing IN ('free', 'paid')),
  status          text NOT NULL CHECK (status IN
                    ('AWAITING_PAYMENT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'CANCELLED', 'REVOKED')),
  starts_at       timestamptz,
  ends_at         timestamptz,
  approved_at     timestamptz,
  reviewed_at     timestamptz,
  admin_note      text,
  idempotency_key text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_property_boost_idempotency UNIQUE (account_id, idempotency_key),
  CONSTRAINT chk_property_boost_window CHECK (status <> 'ACTIVE' OR (starts_at IS NOT NULL AND ends_at > starts_at))
);
CREATE INDEX idx_property_boosts_active ON public.property_boosts (property_id, ends_at) WHERE status = 'ACTIVE';
CREATE INDEX idx_property_boosts_account ON public.property_boosts (account_id, created_at DESC);
CREATE INDEX idx_property_boosts_status ON public.property_boosts (status, created_at);
COMMENT ON TABLE public.property_boosts IS
  'Monetization: paid stickers. Active from admin approval for duration_days; expiry is checked on read.';

CREATE TABLE public.payment_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.customer_accounts (id) ON DELETE RESTRICT,
  service          text NOT NULL CHECK (service IN ('listing', 'sticker')),
  submission_id    uuid REFERENCES public.listing_submissions (id) ON DELETE RESTRICT,
  boost_id         uuid REFERENCES public.property_boosts (id) ON DELETE RESTRICT,
  plan_id          uuid REFERENCES public.pricing_plans (id) ON DELETE SET NULL,
  plan_snapshot    jsonb NOT NULL,
  base_amount_uzs  bigint NOT NULL CHECK (base_amount_uzs > 0),
  discount_uzs     bigint NOT NULL DEFAULT 0 CHECK (discount_uzs >= 0),
  final_amount_uzs bigint NOT NULL CHECK (final_amount_uzs > 0),
  promo_code_id    uuid REFERENCES public.promo_codes (id) ON DELETE SET NULL,
  promotion_id     uuid REFERENCES public.promotions (id) ON DELETE SET NULL,
  discount_source  text CHECK (discount_source IN ('promo_code', 'promotion')),
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
  status_reason    text,
  provider         text,
  expires_at       timestamptz NOT NULL,
  paid_at          timestamptz,
  cancelled_at     timestamptz,
  refunded_at      timestamptz,
  fiscal_items     jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_order_amounts CHECK (final_amount_uzs = base_amount_uzs - discount_uzs),
  CONSTRAINT chk_order_target CHECK (
    (service = 'listing' AND submission_id IS NOT NULL AND boost_id IS NULL)
    OR (service = 'sticker' AND boost_id IS NOT NULL AND submission_id IS NULL)
  )
);
CREATE INDEX idx_payment_orders_account ON public.payment_orders (account_id, created_at DESC);
CREATE INDEX idx_payment_orders_status ON public.payment_orders (status, created_at DESC);
CREATE INDEX idx_payment_orders_submission ON public.payment_orders (submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX idx_payment_orders_boost ON public.payment_orders (boost_id) WHERE boost_id IS NOT NULL;
COMMENT ON TABLE public.payment_orders IS
  'Monetization: one priced order per payment attempt; keeps a copy of the plan and the discount.';

CREATE TABLE public.payment_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.payment_orders (id) ON DELETE RESTRICT,
  provider        text NOT NULL,
  provider_txn_id text NOT NULL,
  amount_uzs      bigint NOT NULL CHECK (amount_uzs > 0),
  state           text NOT NULL CHECK (state IN ('performed', 'failed')),
  raw             jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_transaction UNIQUE (provider, provider_txn_id)
);
CREATE INDEX idx_payment_transactions_order ON public.payment_transactions (order_id);

CREATE TABLE public.payment_webhook_logs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider     text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  signature_ok boolean NOT NULL,
  payload      jsonb,
  result       text,
  error        text
);
CREATE INDEX idx_payment_webhook_logs_received ON public.payment_webhook_logs (received_at DESC);

CREATE TABLE public.refunds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES public.payment_orders (id) ON DELETE RESTRICT,
  amount_uzs   bigint NOT NULL CHECK (amount_uzs > 0),
  status       text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN
                 ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'MANUAL_REQUIRED', 'MANUAL_CONFIRMED')),
  reason       text NOT NULL,
  initiated_by text NOT NULL CHECK (initiated_by IN ('system', 'admin', 'customer')),
  provider_ref text,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
-- At most one refund in progress or done per order (a FAILED one may be retried).
CREATE UNIQUE INDEX uq_refunds_active ON public.refunds (order_id) WHERE status <> 'FAILED';
CREATE INDEX idx_refunds_status ON public.refunds (status, created_at DESC);

CREATE TABLE public.promo_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes (id) ON DELETE RESTRICT,
  order_id      uuid NOT NULL UNIQUE REFERENCES public.payment_orders (id) ON DELETE RESTRICT,
  account_id    uuid NOT NULL REFERENCES public.customer_accounts (id) ON DELETE RESTRICT,
  discount_uzs  bigint NOT NULL CHECK (discount_uzs > 0),
  state         text NOT NULL CHECK (state IN ('reserved', 'consumed', 'released')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  settled_at    timestamptz
);
CREATE INDEX idx_promo_redemptions_code ON public.promo_redemptions (promo_code_id, state);
CREATE INDEX idx_promo_redemptions_account ON public.promo_redemptions (promo_code_id, account_id, state);

-- ================================================================ triggers ===
-- The append-only guard (1a) now names the table it protects.
CREATE OR REPLACE FUNCTION public.mon_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER trg_listing_submissions_updated_at BEFORE UPDATE ON public.listing_submissions
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_promo_codes_updated_at BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_promotions_updated_at BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_property_boosts_updated_at BEFORE UPDATE ON public.property_boosts
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_payment_orders_updated_at BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();
CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.mon_set_updated_at();

-- Payment records and webhook logs are financial evidence: insert only.
CREATE TRIGGER trg_payment_transactions_append_only BEFORE UPDATE OR DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.mon_audit_append_only();
CREATE TRIGGER trg_payment_transactions_no_truncate BEFORE TRUNCATE ON public.payment_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION public.mon_audit_append_only();
CREATE TRIGGER trg_payment_webhook_logs_append_only BEFORE UPDATE OR DELETE ON public.payment_webhook_logs
  FOR EACH ROW EXECUTE FUNCTION public.mon_audit_append_only();
CREATE TRIGGER trg_payment_webhook_logs_no_truncate BEFORE TRUNCATE ON public.payment_webhook_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.mon_audit_append_only();

-- ================================================================= helpers ===

-- Current settings merged over safe defaults (monetization OFF).
CREATE FUNCTION public.mon_settings()
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
           'order_ttl_minutes', 30,
           'revision_attempts', 3
         )
         || coalesce((SELECT CASE WHEN jsonb_typeof(s.value) = 'object' THEN s.value END
                      FROM public.app_settings s WHERE s.key = 'monetization_settings'), '{}'::jsonb);
$$;

CREATE FUNCTION public.mon_audit(
  p_actor_type text, p_actor_id text, p_action text, p_entity text, p_entity_id text,
  p_before jsonb DEFAULT NULL, p_after jsonb DEFAULT NULL, p_reason text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL, p_request_id text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  INSERT INTO public.monetization_audit_logs
    (actor_type, actor_id, action, entity, entity_id, before_state, after_state, reason, ip_hash, request_id)
  VALUES (p_actor_type, p_actor_id, p_action, p_entity, p_entity_id, p_before, p_after, p_reason, p_ip_hash, p_request_id);
$$;

-- Price for one product with the best discount. The promo code and a promotion are
-- never combined: the bigger discount wins, and at least 1 so'm stays payable.
-- p_lock = true locks the promo code row (used when an order is created).
CREATE FUNCTION public.mon_quote(
  p_account_id    uuid,
  p_service       text,
  p_sticker_type  text,
  p_duration_days integer,
  p_promo_code    text,
  p_lock          boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_plan               public.pricing_plans%ROWTYPE;
  v_promo              public.promo_codes%ROWTYPE;
  v_code               text := upper(btrim(coalesce(p_promo_code, '')));
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
  SELECT * INTO v_plan
  FROM public.pricing_plans
  WHERE is_active
    AND service = p_service
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
    'plan', jsonb_build_object('service', v_plan.service, 'sticker_type', v_plan.sticker_type,
                               'duration_days', v_plan.duration_days, 'price_uzs', v_plan.price_uzs),
    'base', v_base,
    'discount', v_discount,
    'final', v_base - v_discount,
    'discount_source', v_source,
    'promo_code_id', CASE WHEN v_source = 'promo_code' THEN v_promo.id END,
    'promo_error', v_promo_error,
    'promotion_id', CASE WHEN v_source = 'promotion' THEN v_promotion_id END,
    'promotion_name', CASE WHEN v_source = 'promotion' THEN v_promotion_name END
  );
END;
$$;

CREATE FUNCTION public.mon_create_order(
  p_account_id uuid, p_service text, p_submission_id uuid, p_boost_id uuid, p_quote jsonb
)
RETURNS public.payment_orders
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_ttl   integer := greatest(coalesce((public.mon_settings() ->> 'order_ttl_minutes')::integer, 30), 5);
BEGIN
  INSERT INTO public.payment_orders
    (account_id, service, submission_id, boost_id, plan_id, plan_snapshot, base_amount_uzs, discount_uzs,
     final_amount_uzs, promo_code_id, promotion_id, discount_source, expires_at)
  VALUES
    (p_account_id, p_service, p_submission_id, p_boost_id, (p_quote ->> 'plan_id')::uuid, p_quote -> 'plan',
     (p_quote ->> 'base')::bigint, (p_quote ->> 'discount')::bigint, (p_quote ->> 'final')::bigint,
     (p_quote ->> 'promo_code_id')::uuid, (p_quote ->> 'promotion_id')::uuid, p_quote ->> 'discount_source',
     now() + make_interval(mins => v_ttl))
  RETURNING * INTO v_order;

  IF v_order.promo_code_id IS NOT NULL THEN
    INSERT INTO public.promo_redemptions (promo_code_id, order_id, account_id, discount_uzs, state)
    VALUES (v_order.promo_code_id, v_order.id, p_account_id, v_order.discount_uzs, 'reserved');
  END IF;

  PERFORM public.mon_audit('customer', p_account_id::text, 'order.created', 'payment_order', v_order.id::text, NULL,
    jsonb_build_object('service', p_service, 'base', v_order.base_amount_uzs, 'discount', v_order.discount_uzs,
                       'final', v_order.final_amount_uzs, 'discount_source', v_order.discount_source));
  RETURN v_order;
END;
$$;

-- Give back a promo code use (order cancelled, rejected or refunded through no fault of the user).
CREATE FUNCTION public.mon_release_promo(p_order_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.promo_redemptions SET state = 'released', settled_at = now()
  WHERE order_id = p_order_id AND state IN ('reserved', 'consumed');
$$;

-- Cancel a PENDING order whose payment window has passed. Returns true if it expired now.
CREATE FUNCTION public.mon_expire_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.payment_orders
  SET status = 'CANCELLED', status_reason = 'expired', cancelled_at = now()
  WHERE id = p_order_id AND status = 'PENDING' AND expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    PERFORM public.mon_release_promo(p_order_id);
    PERFORM public.mon_audit('system', NULL, 'order.expired', 'payment_order', p_order_id::text);
  END IF;
  RETURN v_count > 0;
END;
$$;

-- ======================================================== listing terms ===

-- What a new listing would cost this account right now (read-only unless p_lock).
CREATE FUNCTION public.mon_listing_terms(
  p_account_id uuid, p_contact_phone text, p_promo_code text, p_lock boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_settings jsonb := public.mon_settings();
  v_limit    integer := coalesce((v_settings ->> 'free_listing_limit')::integer, 1);
  v_per30    integer := coalesce((v_settings ->> 'free_submissions_per_30_days')::integer, 3);
  v_live     integer := 0;
  v_recent   integer := 0;
  v_conflict boolean := false;
BEGIN
  IF NOT coalesce((v_settings ->> 'enabled')::boolean, false) THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;
  IF NOT coalesce((v_settings ->> 'listing_payment_enabled')::boolean, true) THEN
    RETURN jsonb_build_object('enabled', true, 'billing', 'free', 'free_reason', 'payments_disabled');
  END IF;

  IF coalesce((v_settings ->> 'free_first_listing_enabled')::boolean, true) THEN
    IF p_lock AND p_contact_phone IS NOT NULL THEN
      -- Serialise free-right decisions that involve the same phone across accounts.
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
                                'free_used', v_live, 'free_limit', v_limit);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true, 'billing', 'paid', 'phone_conflict', v_conflict,
    'free_used', v_live, 'free_limit', v_limit, 'free_recent', v_recent,
    'quote', public.mon_quote(p_account_id, 'listing', NULL, NULL, p_promo_code, p_lock)
  );
END;
$$;

-- ======================================================== submissions ===

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
  p_ip_hash           text
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
        'submission_id', v_existing.id, 'billing', v_existing.billing,
        'moderation_status', v_existing.moderation_status, 'idempotent', true,
        'order_id', (SELECT o.id FROM public.payment_orders o WHERE o.submission_id = v_existing.id
                     ORDER BY o.created_at DESC LIMIT 1));
    END IF;
  END IF;

  v_terms := public.mon_listing_terms(p_account_id, p_contact_phone, p_promo_code, true);
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
     payload, photos, billing, free_reason, moderation_status, flags, idempotency_key, ip_hash, submitted_at)
  VALUES
    (p_account_id, p_identity_id, coalesce(p_channel, 'web'), btrim(p_contact_name), p_contact_phone,
     coalesce(p_phone_verified, false), coalesce(p_preferred_channel, 'phone'),
     coalesce(p_payload, '{}'::jsonb), coalesce(p_photos, '{}'), v_billing, v_terms ->> 'free_reason',
     CASE WHEN v_billing = 'paid' THEN 'AWAITING_PAYMENT' ELSE 'PENDING_REVIEW' END,
     v_flags, p_idempotency_key, p_ip_hash,
     CASE WHEN v_billing = 'paid' THEN NULL ELSE now() END)
  RETURNING * INTO v_sub;

  IF v_terms ->> 'free_reason' = 'first_listing' THEN
    INSERT INTO public.free_listing_claims (account_id, submission_id, phone_e164, phone_verified, state)
    VALUES (p_account_id, v_sub.id, p_contact_phone, coalesce(p_phone_verified, false), 'reserved');
    PERFORM public.mon_audit('customer', p_account_id::text, 'free_claim.reserved', 'listing_submission', v_sub.id::text);
  END IF;

  PERFORM public.mon_audit('customer', p_account_id::text, 'submission.created', 'listing_submission', v_sub.id::text,
    NULL, jsonb_build_object('billing', v_billing, 'status', v_sub.moderation_status, 'flags', v_flags),
    NULL, p_ip_hash);

  IF v_billing = 'paid' THEN
    v_order := public.mon_create_order(p_account_id, 'listing', v_sub.id, NULL, v_quote);
  END IF;

  RETURN jsonb_build_object(
    'submission_id', v_sub.id, 'billing', v_billing, 'free_reason', v_terms ->> 'free_reason',
    'moderation_status', v_sub.moderation_status, 'idempotent', false,
    'order_id', v_order.id, 'amount', v_order.final_amount_uzs, 'base', v_order.base_amount_uzs,
    'discount', v_order.discount_uzs, 'promo_error', v_quote ->> 'promo_error',
    'phone_conflict', coalesce((v_terms ->> 'phone_conflict')::boolean, false));
END;
$$;

-- Return the open order of a submission awaiting payment, or create a new one
-- (after a failed, cancelled or expired attempt).
CREATE FUNCTION public.mon_ensure_listing_order(p_submission_id uuid, p_account_id uuid, p_promo_code text)
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
  WHERE submission_id = v_sub.id AND status = 'PENDING'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND v_order.expires_at <= now() THEN
    PERFORM public.mon_expire_order(v_order.id);
    v_order := NULL;
  END IF;

  IF v_order.id IS NULL THEN
    v_quote := public.mon_quote(p_account_id, 'listing', NULL, NULL, p_promo_code, true);
    IF NOT coalesce((v_quote ->> 'ok')::boolean, false) THEN
      RAISE EXCEPTION 'MON:%', coalesce(v_quote ->> 'reason', 'no_price');
    END IF;
    v_order := public.mon_create_order(p_account_id, 'listing', v_sub.id, NULL, v_quote);
  END IF;

  RETURN jsonb_build_object('order_id', v_order.id, 'amount', v_order.final_amount_uzs,
    'base', v_order.base_amount_uzs, 'discount', v_order.discount_uzs,
    'expires_at', v_order.expires_at, 'promo_error', v_quote ->> 'promo_error');
END;
$$;

-- The user fixes the application after the admin asked for a revision.
CREATE FUNCTION public.mon_resubmit_submission(
  p_submission_id uuid, p_account_id uuid, p_payload jsonb, p_photos text[],
  p_contact_name text, p_preferred_channel text
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sub public.listing_submissions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.listing_submissions
  WHERE id = p_submission_id AND account_id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;
  IF v_sub.moderation_status <> 'REVISION_REQUIRED' THEN
    RAISE EXCEPTION 'MON:invalid_state';
  END IF;

  UPDATE public.listing_submissions
  SET payload = coalesce(p_payload, payload),
      photos = coalesce(p_photos, photos),
      contact_name = coalesce(nullif(btrim(p_contact_name), ''), contact_name),
      preferred_channel = coalesce(p_preferred_channel, preferred_channel),
      moderation_status = 'PENDING_REVIEW',
      revision_count = revision_count + 1,
      submitted_at = now()
  WHERE id = v_sub.id;

  PERFORM public.mon_audit('customer', p_account_id::text, 'submission.resubmitted', 'listing_submission', v_sub.id::text,
    jsonb_build_object('status', v_sub.moderation_status, 'payload', v_sub.payload),
    jsonb_build_object('status', 'PENDING_REVIEW', 'payload', coalesce(p_payload, v_sub.payload)));
  RETURN 'PENDING_REVIEW';
END;
$$;

-- Admin corrects the application before deciding. Payment data is never touched.
CREATE FUNCTION public.mon_admin_update_submission(
  p_submission_id uuid, p_payload jsonb, p_photos text[], p_actor_id text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sub public.listing_submissions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.listing_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;
  IF v_sub.moderation_status NOT IN ('PENDING_REVIEW', 'REVISION_REQUIRED') THEN
    RAISE EXCEPTION 'MON:invalid_state';
  END IF;

  UPDATE public.listing_submissions
  SET payload = coalesce(p_payload, payload), photos = coalesce(p_photos, photos)
  WHERE id = v_sub.id;

  PERFORM public.mon_audit('admin', p_actor_id, 'submission.edited', 'listing_submission', v_sub.id::text,
    jsonb_build_object('payload', v_sub.payload, 'photos', to_jsonb(v_sub.photos)),
    jsonb_build_object('payload', coalesce(p_payload, v_sub.payload), 'photos', to_jsonb(coalesce(p_photos, v_sub.photos))));
END;
$$;

-- ================================================================ refunds ===

CREATE FUNCTION public.mon_request_refund(
  p_order_id uuid, p_reason text, p_initiated_by text, p_actor_id text, p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_id    uuid;
BEGIN
  SELECT * INTO v_order FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;
  IF v_order.status <> 'PAID' THEN
    RAISE EXCEPTION 'MON:order_not_paid';
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'MON:reason_required';
  END IF;

  SELECT r.id INTO v_id FROM public.refunds r WHERE r.order_id = p_order_id AND r.status <> 'FAILED';
  IF FOUND THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.refunds (order_id, amount_uzs, reason, initiated_by, note)
  VALUES (p_order_id, v_order.final_amount_uzs, p_reason, p_initiated_by, p_note)
  RETURNING id INTO v_id;

  PERFORM public.mon_audit(
    CASE p_initiated_by WHEN 'admin' THEN 'admin' WHEN 'customer' THEN 'customer' ELSE 'system' END,
    p_actor_id, 'refund.requested', 'refund', v_id::text, NULL,
    jsonb_build_object('order_id', p_order_id, 'amount', v_order.final_amount_uzs), p_reason);
  RETURN v_id;
END;
$$;

-- Refund outcome. The order becomes REFUNDED only when the money really went back
-- (SUCCEEDED from the provider, or MANUAL_CONFIRMED by an admin with a reference).
CREATE FUNCTION public.mon_settle_refund(
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
    UPDATE public.payment_orders SET status = 'REFUNDED', refunded_at = now()
    WHERE id = v_ref.order_id AND status = 'PAID';
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

-- ======================================================== order closing ===

CREATE FUNCTION public.mon_close_order(
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
  WHERE id = p_order_id AND status = 'PENDING' AND (p_account_id IS NULL OR account_id = p_account_id);
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

-- ============================================================= moderation ===

CREATE FUNCTION public.mon_moderate_submission(
  p_submission_id uuid, p_action text, p_note text, p_actor_id text,
  p_property_id text DEFAULT NULL, p_ip_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sub    public.listing_submissions%ROWTYPE;
  v_order  public.payment_orders%ROWTYPE;
  v_refund uuid;
  v_limit  integer := coalesce((public.mon_settings() ->> 'revision_attempts')::integer, 3);
  v_new    text;
BEGIN
  SELECT * INTO v_sub FROM public.listing_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;

  IF p_action = 'approve' THEN
    IF v_sub.moderation_status <> 'PENDING_REVIEW' THEN
      RAISE EXCEPTION 'MON:invalid_state';
    END IF;
    IF p_property_id IS NULL THEN
      RAISE EXCEPTION 'MON:property_required';
    END IF;
    v_new := 'APPROVED';
    UPDATE public.listing_submissions
    SET moderation_status = v_new, property_id = p_property_id, reviewed_at = now(), admin_note = p_note
    WHERE id = v_sub.id;
    UPDATE public.free_listing_claims SET state = 'consumed', settled_at = now()
    WHERE submission_id = v_sub.id AND state = 'reserved';

  ELSIF p_action = 'reject' THEN
    IF v_sub.moderation_status NOT IN ('PENDING_REVIEW', 'REVISION_REQUIRED') THEN
      RAISE EXCEPTION 'MON:invalid_state';
    END IF;
    IF coalesce(btrim(p_note), '') = '' THEN
      RAISE EXCEPTION 'MON:reason_required';
    END IF;
    v_new := 'REJECTED';
    UPDATE public.listing_submissions
    SET moderation_status = v_new, reviewed_at = now(), admin_note = p_note
    WHERE id = v_sub.id;
    UPDATE public.free_listing_claims SET state = 'released', settled_at = now()
    WHERE submission_id = v_sub.id AND state = 'reserved';
    SELECT * INTO v_order FROM public.payment_orders
    WHERE submission_id = v_sub.id AND status = 'PAID' ORDER BY paid_at DESC LIMIT 1;
    IF FOUND THEN
      v_refund := public.mon_request_refund(v_order.id, 'submission_rejected: ' || p_note, 'system', p_actor_id);
      PERFORM public.mon_release_promo(v_order.id);
    END IF;

  ELSIF p_action = 'request_revision' THEN
    IF v_sub.moderation_status <> 'PENDING_REVIEW' THEN
      RAISE EXCEPTION 'MON:invalid_state';
    END IF;
    IF coalesce(btrim(p_note), '') = '' THEN
      RAISE EXCEPTION 'MON:reason_required';
    END IF;
    IF v_sub.revision_count >= v_limit THEN
      RAISE EXCEPTION 'MON:revision_limit';
    END IF;
    v_new := 'REVISION_REQUIRED';
    UPDATE public.listing_submissions
    SET moderation_status = v_new, reviewed_at = now(), admin_note = p_note
    WHERE id = v_sub.id;

  ELSE
    RAISE EXCEPTION 'MON:invalid_action';
  END IF;

  PERFORM public.mon_audit('admin', p_actor_id, 'submission.' || p_action, 'listing_submission', v_sub.id::text,
    jsonb_build_object('status', v_sub.moderation_status),
    jsonb_build_object('status', v_new, 'property_id', p_property_id, 'refund_id', v_refund),
    p_note, p_ip_hash);
  RETURN jsonb_build_object('status', v_new, 'refund_id', v_refund);
END;
$$;

-- The user withdraws an application that has not been decided yet.
CREATE FUNCTION public.mon_cancel_submission(p_submission_id uuid, p_account_id uuid)
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
    FOR v_order IN SELECT * FROM public.payment_orders WHERE submission_id = v_sub.id AND status = 'PENDING' LOOP
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

-- =============================================================== stickers ===

CREATE FUNCTION public.mon_request_boost(
  p_account_id uuid, p_property_id text, p_sticker_type text, p_duration_days integer,
  p_promo_code text, p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_settings jsonb := public.mon_settings();
  v_account  public.customer_accounts%ROWTYPE;
  v_existing public.property_boosts%ROWTYPE;
  v_sub      public.listing_submissions%ROWTYPE;
  v_boost    public.property_boosts%ROWTYPE;
  v_order    public.payment_orders%ROWTYPE;
  v_quote    jsonb;
  v_status   text;
  v_title    text;
  v_billing  text;
BEGIN
  IF NOT coalesce((v_settings ->> 'enabled')::boolean, false) THEN
    RAISE EXCEPTION 'MON:monetization_disabled';
  END IF;

  SELECT * INTO v_account FROM public.customer_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:account_not_found';
  END IF;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'MON:account_blocked';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.property_boosts
    WHERE account_id = p_account_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('boost_id', v_existing.id, 'status', v_existing.status, 'idempotent', true,
        'order_id', (SELECT o.id FROM public.payment_orders o WHERE o.boost_id = v_existing.id
                     ORDER BY o.created_at DESC LIMIT 1));
    END IF;
  END IF;

  SELECT * INTO v_sub FROM public.listing_submissions
  WHERE account_id = p_account_id AND property_id = p_property_id AND moderation_status = 'APPROVED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_owner';
  END IF;

  SELECT p.status, p.title_uz INTO v_status, v_title FROM public.properties p WHERE p.id = p_property_id;
  IF v_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'MON:not_published';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.property_boosts b
    WHERE b.property_id = p_property_id AND b.sticker_type = p_sticker_type
      AND b.status IN ('AWAITING_PAYMENT', 'PENDING_APPROVAL')
  ) THEN
    RAISE EXCEPTION 'MON:already_pending';
  END IF;

  IF coalesce((v_settings ->> 'sticker_payment_enabled')::boolean, true) THEN
    v_quote := public.mon_quote(p_account_id, 'sticker', p_sticker_type, p_duration_days, p_promo_code, true);
    IF NOT coalesce((v_quote ->> 'ok')::boolean, false) THEN
      RAISE EXCEPTION 'MON:%', coalesce(v_quote ->> 'reason', 'no_price');
    END IF;
    v_billing := 'paid';
  ELSE
    v_billing := 'free';
  END IF;

  INSERT INTO public.property_boosts
    (account_id, submission_id, property_id, property_title, sticker_type, duration_days, billing, status, idempotency_key)
  VALUES
    (p_account_id, v_sub.id, p_property_id, v_title, p_sticker_type, p_duration_days, v_billing,
     CASE WHEN v_billing = 'paid' THEN 'AWAITING_PAYMENT' ELSE 'PENDING_APPROVAL' END, p_idempotency_key)
  RETURNING * INTO v_boost;

  PERFORM public.mon_audit('customer', p_account_id::text, 'boost.requested', 'property_boost', v_boost.id::text, NULL,
    jsonb_build_object('property_id', p_property_id, 'sticker_type', p_sticker_type,
                       'duration_days', p_duration_days, 'billing', v_billing));

  IF v_billing = 'paid' THEN
    v_order := public.mon_create_order(p_account_id, 'sticker', NULL, v_boost.id, v_quote);
  END IF;

  RETURN jsonb_build_object('boost_id', v_boost.id, 'status', v_boost.status, 'billing', v_billing, 'idempotent', false,
    'order_id', v_order.id, 'amount', v_order.final_amount_uzs, 'base', v_order.base_amount_uzs,
    'discount', v_order.discount_uzs, 'promo_error', v_quote ->> 'promo_error');
END;
$$;

CREATE FUNCTION public.mon_ensure_boost_order(p_boost_id uuid, p_account_id uuid, p_promo_code text)
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
  WHERE boost_id = v_boost.id AND status = 'PENDING'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND v_order.expires_at <= now() THEN
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

  RETURN jsonb_build_object('order_id', v_order.id, 'amount', v_order.final_amount_uzs,
    'base', v_order.base_amount_uzs, 'discount', v_order.discount_uzs,
    'expires_at', v_order.expires_at, 'promo_error', v_quote ->> 'promo_error');
END;
$$;

CREATE FUNCTION public.mon_moderate_boost(p_boost_id uuid, p_action text, p_note text, p_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_boost  public.property_boosts%ROWTYPE;
  v_order  public.payment_orders%ROWTYPE;
  v_last   timestamptz;
  v_start  timestamptz;
  v_refund uuid;
  v_new    text;
BEGIN
  SELECT * INTO v_boost FROM public.property_boosts WHERE id = p_boost_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MON:not_found';
  END IF;

  IF p_action = 'approve' THEN
    IF v_boost.status <> 'PENDING_APPROVAL' THEN
      RAISE EXCEPTION 'MON:invalid_state';
    END IF;
    IF v_boost.property_id IS NULL THEN
      RAISE EXCEPTION 'MON:property_missing';
    END IF;
    -- A new period starts when the current one of the same sticker ends.
    PERFORM pg_advisory_xact_lock(hashtextextended('mon_boost:' || v_boost.property_id || ':' || v_boost.sticker_type, 0));
    SELECT max(b.ends_at) INTO v_last FROM public.property_boosts b
    WHERE b.property_id = v_boost.property_id AND b.sticker_type = v_boost.sticker_type
      AND b.status = 'ACTIVE' AND b.ends_at > now();
    v_start := greatest(now(), coalesce(v_last, now()));
    v_new := 'ACTIVE';
    UPDATE public.property_boosts
    SET status = v_new, starts_at = v_start, ends_at = v_start + make_interval(days => v_boost.duration_days),
        approved_at = now(), reviewed_at = now(), admin_note = p_note
    WHERE id = v_boost.id;

  ELSIF p_action = 'reject' THEN
    IF v_boost.status <> 'PENDING_APPROVAL' THEN
      RAISE EXCEPTION 'MON:invalid_state';
    END IF;
    IF coalesce(btrim(p_note), '') = '' THEN
      RAISE EXCEPTION 'MON:reason_required';
    END IF;
    v_new := 'REJECTED';
    UPDATE public.property_boosts SET status = v_new, reviewed_at = now(), admin_note = p_note WHERE id = v_boost.id;
    SELECT * INTO v_order FROM public.payment_orders
    WHERE boost_id = v_boost.id AND status = 'PAID' ORDER BY paid_at DESC LIMIT 1;
    IF FOUND THEN
      v_refund := public.mon_request_refund(v_order.id, 'boost_rejected: ' || p_note, 'system', p_actor_id);
      PERFORM public.mon_release_promo(v_order.id);
    END IF;

  ELSIF p_action = 'revoke' THEN
    IF v_boost.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'MON:invalid_state';
    END IF;
    IF coalesce(btrim(p_note), '') = '' THEN
      RAISE EXCEPTION 'MON:reason_required';
    END IF;
    v_new := 'REVOKED';
    UPDATE public.property_boosts SET status = v_new, reviewed_at = now(), admin_note = p_note WHERE id = v_boost.id;

  ELSE
    RAISE EXCEPTION 'MON:invalid_action';
  END IF;

  PERFORM public.mon_audit('admin', p_actor_id, 'boost.' || p_action, 'property_boost', v_boost.id::text,
    jsonb_build_object('status', v_boost.status),
    jsonb_build_object('status', v_new, 'starts_at', v_start, 'refund_id', v_refund), p_note);
  RETURN jsonb_build_object('status', v_new, 'starts_at', v_start,
    'ends_at', CASE WHEN v_new = 'ACTIVE' THEN v_start + make_interval(days => v_boost.duration_days) END,
    'refund_id', v_refund);
END;
$$;

CREATE FUNCTION public.mon_cancel_boost(p_boost_id uuid, p_account_id uuid)
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
    FOR v_order IN SELECT * FROM public.payment_orders WHERE boost_id = v_boost.id AND status = 'PENDING' LOOP
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

-- =============================================================== payments ===

-- Apply a payment confirmed by a provider whose signature the server already
-- verified. Idempotent: the same provider transaction is counted once. The amount
-- must match the order exactly. A paid item goes to the admin queue, never public.
CREATE FUNCTION public.mon_apply_payment(
  p_order_id uuid, p_provider text, p_provider_txn_id text, p_amount_uzs bigint, p_raw jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order  public.payment_orders%ROWTYPE;
  v_result text;
BEGIN
  SELECT * INTO v_order FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'unknown_order';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payment_transactions t
             WHERE t.provider = p_provider AND t.provider_txn_id = p_provider_txn_id) THEN
    RETURN 'duplicate';
  END IF;

  IF v_order.status = 'PENDING' AND v_order.expires_at <= now() THEN
    PERFORM public.mon_expire_order(v_order.id);
    v_result := 'expired';
  ELSIF v_order.status <> 'PENDING' THEN
    v_result := 'not_pending';
  ELSIF p_amount_uzs IS DISTINCT FROM v_order.final_amount_uzs THEN
    v_result := 'amount_mismatch';
  ELSE
    v_result := 'paid';
  END IF;

  INSERT INTO public.payment_transactions (order_id, provider, provider_txn_id, amount_uzs, state, raw)
  VALUES (v_order.id, p_provider, p_provider_txn_id, greatest(coalesce(p_amount_uzs, 1), 1),
          CASE WHEN v_result = 'paid' THEN 'performed' ELSE 'failed' END,
          coalesce(p_raw, '{}'::jsonb) || jsonb_build_object('result', v_result));

  IF v_result <> 'paid' THEN
    PERFORM public.mon_audit('provider', p_provider, 'payment.rejected', 'payment_order', v_order.id::text, NULL,
      jsonb_build_object('result', v_result, 'amount', p_amount_uzs, 'expected', v_order.final_amount_uzs,
                         'txn', p_provider_txn_id));
    RETURN v_result;
  END IF;

  UPDATE public.payment_orders SET status = 'PAID', paid_at = now(), provider = p_provider WHERE id = v_order.id;
  UPDATE public.promo_redemptions SET state = 'consumed', settled_at = now()
  WHERE order_id = v_order.id AND state = 'reserved';

  IF v_order.submission_id IS NOT NULL THEN
    UPDATE public.listing_submissions SET moderation_status = 'PENDING_REVIEW', submitted_at = now()
    WHERE id = v_order.submission_id AND moderation_status = 'AWAITING_PAYMENT';
  END IF;
  IF v_order.boost_id IS NOT NULL THEN
    UPDATE public.property_boosts SET status = 'PENDING_APPROVAL'
    WHERE id = v_order.boost_id AND status = 'AWAITING_PAYMENT';
  END IF;

  PERFORM public.mon_audit('provider', p_provider, 'order.paid', 'payment_order', v_order.id::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object('status', 'PAID', 'amount', p_amount_uzs, 'txn', p_provider_txn_id));
  RETURN 'paid';
END;
$$;

-- ================================================================ pricing ===

-- Set the active price of one product (the previous price is kept, inactive).
CREATE FUNCTION public.mon_set_price(
  p_service text, p_sticker_type text, p_duration_days integer, p_price_uzs bigint, p_actor_id text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_old public.pricing_plans%ROWTYPE;
  v_id  uuid;
  v_sticker text := CASE WHEN p_service = 'sticker' THEN p_sticker_type END;
  v_days integer := CASE WHEN p_service = 'sticker' THEN p_duration_days END;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('mon_price:' || p_service || ':' || coalesce(v_sticker, '') || ':' || coalesce(v_days, 0), 0));
  SELECT * INTO v_old FROM public.pricing_plans
  WHERE is_active AND service = p_service
    AND sticker_type IS NOT DISTINCT FROM v_sticker AND duration_days IS NOT DISTINCT FROM v_days
  FOR UPDATE;
  IF FOUND THEN
    UPDATE public.pricing_plans SET is_active = false WHERE id = v_old.id;
  END IF;
  INSERT INTO public.pricing_plans (service, sticker_type, duration_days, price_uzs, is_active)
  VALUES (p_service, v_sticker, v_days, p_price_uzs, true)
  RETURNING id INTO v_id;
  PERFORM public.mon_audit('admin', p_actor_id, 'price.set', 'pricing_plan', v_id::text,
    CASE WHEN v_old.id IS NOT NULL THEN jsonb_build_object('plan_id', v_old.id, 'price_uzs', v_old.price_uzs) END,
    jsonb_build_object('service', p_service, 'sticker_type', v_sticker, 'duration_days', v_days, 'price_uzs', p_price_uzs));
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.mon_deactivate_price(p_plan_id uuid, p_actor_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.pricing_plans SET is_active = false WHERE id = p_plan_id AND is_active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    PERFORM public.mon_audit('admin', p_actor_id, 'price.deactivated', 'pricing_plan', p_plan_id::text);
  END IF;
END;
$$;

-- ================================================================ storage ===
-- Private bucket for photos of applications that are not moderated yet. Only the
-- server (service role) can read them; admins see them through short signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('listing-submissions', 'listing-submissions', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ================================================================ security ===
ALTER TABLE public.listing_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_listing_claims  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_boosts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.listing_submissions, public.free_listing_claims, public.promo_codes, public.promotions,
  public.property_boosts, public.payment_orders, public.payment_transactions, public.payment_webhook_logs,
  public.refunds, public.promo_redemptions
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE         ON TABLE public.listing_submissions  TO service_role;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.free_listing_claims  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promo_codes          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promotions           TO service_role;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.property_boosts      TO service_role;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.payment_orders       TO service_role;
GRANT SELECT, INSERT                 ON TABLE public.payment_transactions TO service_role;
GRANT SELECT, INSERT                 ON TABLE public.payment_webhook_logs TO service_role;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.refunds              TO service_role;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.promo_redemptions    TO service_role;

REVOKE ALL ON SEQUENCE public.payment_webhook_logs_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.payment_webhook_logs_id_seq TO service_role;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mon_settings()',
    'public.mon_audit(text,text,text,text,text,jsonb,jsonb,text,text,text)',
    'public.mon_quote(uuid,text,text,integer,text,boolean)',
    'public.mon_create_order(uuid,text,uuid,uuid,jsonb)',
    'public.mon_release_promo(uuid)',
    'public.mon_expire_order(uuid)',
    'public.mon_listing_terms(uuid,text,text,boolean)',
    'public.mon_submit_listing(uuid,uuid,text,text,text,boolean,text,jsonb,text[],text,text,text)',
    'public.mon_ensure_listing_order(uuid,uuid,text)',
    'public.mon_resubmit_submission(uuid,uuid,jsonb,text[],text,text)',
    'public.mon_admin_update_submission(uuid,jsonb,text[],text)',
    'public.mon_request_refund(uuid,text,text,text,text)',
    'public.mon_settle_refund(uuid,text,text,text,text,text)',
    'public.mon_close_order(uuid,text,text,text,text,uuid)',
    'public.mon_moderate_submission(uuid,text,text,text,text,text)',
    'public.mon_cancel_submission(uuid,uuid)',
    'public.mon_request_boost(uuid,text,text,integer,text,text)',
    'public.mon_ensure_boost_order(uuid,uuid,text)',
    'public.mon_moderate_boost(uuid,text,text,text)',
    'public.mon_cancel_boost(uuid,uuid)',
    'public.mon_apply_payment(uuid,text,text,bigint,jsonb)',
    'public.mon_set_price(text,text,integer,bigint,text)',
    'public.mon_deactivate_price(uuid,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
