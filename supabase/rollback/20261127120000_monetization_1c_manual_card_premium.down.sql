-- =============================================================================
-- Rollback for 20261127120000_monetization_1c_manual_card_premium.sql
-- (generated from the 1b migration: the original function bodies are restored verbatim)
--
-- Refuses to run when manual-payment or Premium data exists, so no payment
-- evidence can be lost by accident. Export that data first if a rollback is
-- really needed. Storage: empty and delete the private bucket "payment-receipts"
-- through the Supabase dashboard / Storage API (SQL deletes on storage are blocked).
-- Test inside a transaction on the TEST project first: BEGIN; <this file>; ROLLBACK;
-- =============================================================================

DO $$
DECLARE
  v_orders   integer;
  v_receipts integer;
  v_premium  integer;
BEGIN
  SELECT count(*) INTO v_orders FROM public.payment_orders
  WHERE status IN ('RECEIPT_SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'REJECTED') OR payment_method_id IS NOT NULL;
  SELECT count(*) INTO v_receipts FROM public.payment_receipts;
  SELECT count(*) INTO v_premium FROM public.listing_submissions WHERE listing_tier = 'premium';
  IF v_orders + v_receipts + v_premium > 0 THEN
    RAISE EXCEPTION 'rollback refused: % manual-payment orders, % receipts, % premium applications exist (export them first)',
      v_orders, v_receipts, v_premium;
  END IF;
END $$;

-- new functions
DROP FUNCTION IF EXISTS public.mon_review_payment(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.mon_submit_receipt(uuid, uuid, text, text, text, integer, text);
DROP FUNCTION IF EXISTS public.mon_set_payment_method(text, text, text, text, boolean, text);

-- functions whose parameters changed: drop the 1c version, restore the 1b version
DROP FUNCTION IF EXISTS public.mon_quote(uuid, text, text, integer, text, boolean, text);
DROP FUNCTION IF EXISTS public.mon_set_price(text, text, integer, bigint, text, text);
DROP FUNCTION IF EXISTS public.mon_listing_terms(uuid, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.mon_submit_listing(uuid, uuid, text, text, text, boolean, text, jsonb, text[], text, text, text, text);

CREATE OR REPLACE FUNCTION public.mon_quote(
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


CREATE OR REPLACE FUNCTION public.mon_set_price(
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


CREATE OR REPLACE FUNCTION public.mon_listing_terms(
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


CREATE OR REPLACE FUNCTION public.mon_submit_listing(
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


-- functions replaced in place: restore the 1b bodies
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
           'order_ttl_minutes', 30,
           'revision_attempts', 3
         )
         || coalesce((SELECT CASE WHEN jsonb_typeof(s.value) = 'object' THEN s.value END
                      FROM public.app_settings s WHERE s.key = 'monetization_settings'), '{}'::jsonb);
$$;


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


-- tables and columns added by 1c
DROP TABLE IF EXISTS public.payment_reviews;
ALTER TABLE public.payment_orders DROP COLUMN IF EXISTS payment_method_id;
DROP TABLE IF EXISTS public.payment_receipts;
DROP TABLE IF EXISTS public.payment_methods;
DROP INDEX IF EXISTS public.idx_payment_orders_review;
ALTER TABLE public.payment_orders DROP COLUMN IF EXISTS reviewed_at, DROP COLUMN IF EXISTS reviewed_by;
ALTER TABLE public.payment_orders DROP CONSTRAINT payment_orders_status_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_status_check
  CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'));

ALTER TABLE public.listing_submissions DROP COLUMN IF EXISTS listing_tier;

-- Premium prices exist only in 1c (no application used them: checked above).
DELETE FROM public.pricing_plans WHERE listing_tier = 'premium';
DROP INDEX public.uq_pricing_plans_active;
ALTER TABLE public.pricing_plans DROP CONSTRAINT chk_pricing_plan_shape;
ALTER TABLE public.pricing_plans DROP COLUMN listing_tier;
ALTER TABLE public.pricing_plans ADD CONSTRAINT chk_pricing_plan_shape CHECK (
  (service = 'listing' AND sticker_type IS NULL AND duration_days IS NULL)
  OR (service = 'sticker' AND sticker_type IS NOT NULL AND duration_days IS NOT NULL)
);
CREATE UNIQUE INDEX uq_pricing_plans_active
  ON public.pricing_plans (service, coalesce(sticker_type, ''), coalesce(duration_days, 0))
  WHERE is_active;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mon_settings()',
    'public.mon_quote(uuid,text,text,integer,text,boolean)',
    'public.mon_set_price(text,text,integer,bigint,text)',
    'public.mon_listing_terms(uuid,text,text,boolean)',
    'public.mon_submit_listing(uuid,uuid,text,text,text,boolean,text,jsonb,text[],text,text,text)',
    'public.mon_ensure_listing_order(uuid,uuid,text)',
    'public.mon_ensure_boost_order(uuid,uuid,text)',
    'public.mon_close_order(uuid,text,text,text,text,uuid)',
    'public.mon_cancel_submission(uuid,uuid)',
    'public.mon_cancel_boost(uuid,uuid)',
    'public.mon_settle_refund(uuid,text,text,text,text,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
