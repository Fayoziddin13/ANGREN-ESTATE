-- =============================================================================
-- Checks for 20261126160000_monetization_1b_listings_payments.sql — TEST project only.
--
-- Runs the business flows end to end as service_role (the role the server uses):
-- free first listing, paid listing with promo, idempotency, payments (wrong amount,
-- duplicate, expired), moderation, refunds, cancellation, blocking, stickers with a
-- queue, promotions, and the client-side lock-down (RLS / privileges).
-- Everything is rolled back at the end, so the database is left unchanged.
-- =============================================================================

CREATE OR REPLACE FUNCTION pg_temp.mon_check_1b()
RETURNS TABLE (check_name text, ok boolean, detail text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  r      jsonb := '[]'::jsonb;
  v_res  text;
  v_j    jsonb;
  v_j2   jsonb;
  v_a    uuid; v_b uuid; v_c uuid; v_d uuid;
  v_a1   uuid; v_a2 uuid; v_b1 uuid; v_c1 uuid; v_d1 uuid;
  v_o1   uuid; v_o2 uuid; v_o3 uuid;
  v_ref  uuid;
  v_bo1  uuid; v_bo2 uuid;
  v_s1   timestamptz; v_e1 timestamptz; v_s2 timestamptz;
  v_n    integer;
  v_txt  text;
  c_tables constant text[] := ARRAY['listing_submissions', 'free_listing_claims', 'promo_codes', 'promotions',
    'property_boosts', 'payment_orders', 'payment_transactions', 'payment_webhook_logs', 'refunds', 'promo_redemptions'];
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE service_role';

    -- ------------------------------------------------------------- setup
    SELECT a.account_id INTO v_a FROM public.mon_resolve_customer_account('telegram', '910000000001', NULL, '+998900000001', true) a;
    SELECT a.account_id INTO v_b FROM public.mon_resolve_customer_account('telegram', '910000000002', NULL, '+998900000002', true) a;
    SELECT a.account_id INTO v_c FROM public.mon_resolve_customer_account('google', '22222222-3333-4444-8555-666666666666', 'c@example.com') a;
    SELECT a.account_id INTO v_d FROM public.mon_resolve_customer_account('telegram', '910000000004', NULL, '+998900000004', true) a;

    -- 1. monetization is off by default
    v_j := public.mon_listing_terms(v_a, '+998900000001', NULL);
    r := r || jsonb_build_object('n', 'monetization is OFF by default', 'ok', (v_j ->> 'enabled')::boolean = false, 'd', v_j);
    BEGIN
      PERFORM public.mon_submit_listing(v_a, NULL, 'web', 'A', '+998900000001', true, 'phone', '{}', '{}', NULL, NULL, NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'submitting while OFF is refused', 'ok', v_res = 'MON:monetization_disabled', 'd', v_res);

    INSERT INTO public.app_settings (key, value) VALUES ('monetization_settings', '{"enabled": true}'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    PERFORM public.mon_set_price('listing', NULL, NULL, 50000, 'check');
    PERFORM public.mon_set_price('sticker', 'top', 3, 20000, 'check');
    PERFORM public.mon_set_price('sticker', 'top', 7, 40000, 'check');
    PERFORM public.mon_set_price('sticker', 'top', 30, 120000, 'check');
    INSERT INTO public.promo_codes (code, discount_type, discount_value, max_uses, per_account_limit)
    VALUES ('CHECK10', 'percent', 10, 1, 1);

    -- 2. free first listing
    v_j := public.mon_listing_terms(v_a, '+998900000001', NULL);
    r := r || jsonb_build_object('n', 'first listing is free', 'ok', v_j ->> 'billing' = 'free' AND v_j ->> 'free_reason' = 'first_listing', 'd', v_j);
    v_j := public.mon_submit_listing(v_a, NULL, 'web', 'User A', '+998900000001', true, 'phone',
      '{"location": "Angren 5"}', '{}', NULL, 'k-a1', 'ip1');
    v_a1 := (v_j ->> 'submission_id')::uuid;
    SELECT count(*) INTO v_n FROM public.free_listing_claims WHERE submission_id = v_a1 AND state = 'reserved';
    r := r || jsonb_build_object('n', 'free submission goes straight to review with a reserved right', 'ok',
      v_j ->> 'billing' = 'free' AND v_j ->> 'moderation_status' = 'PENDING_REVIEW' AND v_n = 1, 'd', v_j);

    -- 3. second listing is paid; promo code is normalised and applied
    v_j := public.mon_listing_terms(v_a, '+998900000001', NULL);
    r := r || jsonb_build_object('n', 'second listing is paid (50 000)', 'ok',
      v_j ->> 'billing' = 'paid' AND (v_j -> 'quote' ->> 'final')::bigint = 50000, 'd', v_j);
    v_j := public.mon_submit_listing(v_a, NULL, 'web', 'User A', '+998900000001', true, 'phone',
      '{"location": "Angren 6"}', '{}', ' check10 ', 'k-a2', 'ip1');
    v_a2 := (v_j ->> 'submission_id')::uuid;
    v_o1 := (v_j ->> 'order_id')::uuid;
    r := r || jsonb_build_object('n', 'paid submission waits for payment, promo gives 10% (45 000)', 'ok',
      v_j ->> 'moderation_status' = 'AWAITING_PAYMENT' AND (v_j ->> 'amount')::bigint = 45000, 'd', v_j);

    v_j := public.mon_submit_listing(v_a, NULL, 'web', 'User A', '+998900000001', true, 'phone',
      '{"location": "Angren 6"}', '{}', 'CHECK10', 'k-a2', 'ip1');
    r := r || jsonb_build_object('n', 'repeating the same request is idempotent', 'ok',
      (v_j ->> 'idempotent')::boolean AND (v_j ->> 'submission_id')::uuid = v_a2, 'd', v_j);

    -- 4. same phone on another account: not free; promo limit already reached
    v_j := public.mon_submit_listing(v_b, NULL, 'web', 'User B', '+998900000001', false, 'phone',
      '{"location": "Angren 7"}', '{}', 'CHECK10', 'k-b1', 'ip2');
    v_b1 := (v_j ->> 'submission_id')::uuid;
    v_o2 := (v_j ->> 'order_id')::uuid;
    r := r || jsonb_build_object('n', 'a phone already used for a free listing makes it paid', 'ok',
      v_j ->> 'billing' = 'paid' AND (v_j ->> 'phone_conflict')::boolean, 'd', v_j);
    r := r || jsonb_build_object('n', 'promo with max_uses=1 is refused for the second user', 'ok',
      v_j ->> 'promo_error' = 'limit_reached' AND (v_j ->> 'amount')::bigint = 50000, 'd', v_j);

    -- 5. payments
    v_res := public.mon_apply_payment(v_o1, 'mock', 'T1', 1000, NULL);
    r := r || jsonb_build_object('n', 'wrong amount is rejected', 'ok', v_res = 'amount_mismatch', 'd', v_res);
    v_res := public.mon_apply_payment(v_o1, 'mock', 'T1b', 45000, NULL);
    r := r || jsonb_build_object('n', 'correct payment is applied', 'ok', v_res = 'paid', 'd', v_res);
    v_res := public.mon_apply_payment(v_o1, 'mock', 'T1b', 45000, NULL);
    r := r || jsonb_build_object('n', 'the same provider transaction is counted once', 'ok', v_res = 'duplicate', 'd', v_res);
    v_res := public.mon_apply_payment(v_o1, 'mock', 'T1c', 45000, NULL);
    r := r || jsonb_build_object('n', 'a second payment for a paid order is refused', 'ok', v_res = 'not_pending', 'd', v_res);
    SELECT moderation_status INTO v_txt FROM public.listing_submissions WHERE id = v_a2;
    SELECT count(*) INTO v_n FROM public.promo_redemptions WHERE order_id = v_o1 AND state = 'consumed';
    r := r || jsonb_build_object('n', 'paid listing moves to admin review, promo consumed', 'ok',
      v_txt = 'PENDING_REVIEW' AND v_n = 1, 'd', v_txt);
    SELECT count(*) INTO v_n FROM public.properties WHERE id IN (SELECT property_id FROM public.listing_submissions WHERE id = v_a2);
    r := r || jsonb_build_object('n', 'a paid but unapproved listing has no property at all', 'ok', v_n = 0, 'd', v_n);

    -- 6. moderation: revision, approval (draft property created by the server first)
    BEGIN
      PERFORM public.mon_moderate_submission(v_a1, 'request_revision', '', 'admin');
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a revision request needs a reason', 'ok', v_res = 'MON:reason_required', 'd', v_res);
    v_j := public.mon_moderate_submission(v_a1, 'request_revision', 'Add photos', 'admin');
    v_res := public.mon_resubmit_submission(v_a1, v_a, '{"location": "Angren 5, dom 3"}', NULL, NULL, NULL);
    SELECT revision_count INTO v_n FROM public.listing_submissions WHERE id = v_a1;
    r := r || jsonb_build_object('n', 'revision and resubmission work', 'ok',
      v_j ->> 'status' = 'REVISION_REQUIRED' AND v_res = 'PENDING_REVIEW' AND v_n = 1, 'd', v_n);

    INSERT INTO public.properties (id, slug, status, deal_type, property_type, title_uz, title_ru, price, price_uzs,
      area, area_sqm, district, address, latitude, longitude, contact_phone)
    VALUES ('prop-check-1', 'prop-check-1', 'draft', 'sale', 'apartment', 'Check', 'Check', 100, 100,
      50, 50, 'Markaz', 'Angren', 41.0, 70.1, '+998900000001');
    v_j := public.mon_moderate_submission(v_a1, 'approve', NULL, 'admin', 'prop-check-1');
    SELECT state INTO v_txt FROM public.free_listing_claims WHERE submission_id = v_a1;
    r := r || jsonb_build_object('n', 'approval links the draft property and consumes the free right', 'ok',
      v_j ->> 'status' = 'APPROVED' AND v_txt = 'consumed', 'd', v_txt);

    -- 7. rejection of a paid listing => refund (order REFUNDED only when it succeeded)
    v_j := public.mon_moderate_submission(v_a2, 'reject', 'Duplicate', 'admin');
    v_ref := (v_j ->> 'refund_id')::uuid;
    SELECT status INTO v_txt FROM public.payment_orders WHERE id = v_o1;
    SELECT count(*) INTO v_n FROM public.promo_redemptions WHERE order_id = v_o1 AND state = 'released';
    r := r || jsonb_build_object('n', 'rejecting a paid listing requests a refund; order stays PAID until it succeeds', 'ok',
      v_ref IS NOT NULL AND v_txt = 'PAID' AND v_n = 1, 'd', v_txt);
    PERFORM public.mon_settle_refund(v_ref, 'PROCESSING', NULL, NULL, 'system', NULL);
    PERFORM public.mon_settle_refund(v_ref, 'SUCCEEDED', 'mock-ref-1', NULL, 'provider', 'mock');
    SELECT o.status || '/' || r2.status INTO v_txt FROM public.payment_orders o JOIN public.refunds r2 ON r2.order_id = o.id WHERE o.id = v_o1;
    -- Since 1c the payment stays PAID; the refund result lives only in public.refunds.
    r := r || jsonb_build_object('n', 'a succeeded refund is recorded in refunds; the payment stays PAID (1c)', 'ok', v_txt = 'PAID/SUCCEEDED', 'd', v_txt);
    BEGIN
      PERFORM public.mon_settle_refund(v_ref, 'FAILED', NULL, NULL, 'system', NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a finished refund cannot be changed', 'ok', v_res = 'MON:invalid_transition', 'd', v_res);

    -- 8. a rejected free listing gives the free right back
    v_j := public.mon_submit_listing(v_d, NULL, 'telegram', 'User D', '+998900000004', true, 'telegram',
      '{}', '{}', NULL, 'k-d1', NULL);
    v_d1 := (v_j ->> 'submission_id')::uuid;
    PERFORM public.mon_moderate_submission(v_d1, 'reject', 'Spam', 'admin');
    v_j := public.mon_listing_terms(v_d, '+998900000004', NULL);
    r := r || jsonb_build_object('n', 'after a free listing is rejected the right is free again', 'ok',
      v_j ->> 'billing' = 'free', 'd', v_j);

    -- 9. an expired order cannot be paid; a new one can be created
    UPDATE public.payment_orders SET expires_at = now() - interval '1 minute' WHERE id = v_o2;
    v_res := public.mon_apply_payment(v_o2, 'mock', 'T3', 50000, NULL);
    SELECT status INTO v_txt FROM public.payment_orders WHERE id = v_o2;
    r := r || jsonb_build_object('n', 'payment after the order expired is refused', 'ok',
      v_res = 'expired' AND v_txt = 'CANCELLED', 'd', v_res || ' / ' || v_txt);
    v_j := public.mon_ensure_listing_order(v_b1, v_b, NULL);
    v_o3 := (v_j ->> 'order_id')::uuid;
    r := r || jsonb_build_object('n', 'a new order is created for another attempt', 'ok',
      v_o3 IS NOT NULL AND v_o3 <> v_o2 AND (v_j ->> 'amount')::bigint = 50000, 'd', v_j);

    -- 10. cancelling: paid & under review => refund; free => right released
    PERFORM public.mon_apply_payment(v_o3, 'mock', 'T4', 50000, NULL);
    v_j := public.mon_cancel_submission(v_b1, v_b);
    r := r || jsonb_build_object('n', 'cancelling a paid listing under review requests a refund', 'ok',
      v_j ->> 'status' = 'CANCELLED_BY_USER' AND v_j ->> 'refund_id' IS NOT NULL, 'd', v_j);
    v_j := public.mon_submit_listing(v_c, NULL, 'web', 'User C', '+998900000003', false, 'phone', '{}', '{}', NULL, 'k-c1', NULL);
    v_c1 := (v_j ->> 'submission_id')::uuid;
    PERFORM public.mon_cancel_submission(v_c1, v_c);
    SELECT state INTO v_txt FROM public.free_listing_claims WHERE submission_id = v_c1;
    r := r || jsonb_build_object('n', 'cancelling a free listing releases the right', 'ok', v_txt = 'released', 'd', v_txt);
    BEGIN
      PERFORM public.mon_cancel_submission(v_a1, v_b);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a user cannot touch another user''s listing', 'ok', v_res = 'MON:not_found', 'd', v_res);

    -- 11. a blocked account cannot submit
    PERFORM public.mon_set_customer_account_status(v_d, 'blocked', 'check', 'admin');
    BEGIN
      PERFORM public.mon_submit_listing(v_d, NULL, 'web', 'User D', '+998900000004', true, 'phone', '{}', '{}', NULL, 'k-d2', NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a blocked account cannot submit', 'ok', v_res = 'MON:account_blocked', 'd', v_res);

    -- 12. stickers: ownership, payment, approval queue, refund revokes
    UPDATE public.properties SET status = 'published' WHERE id = 'prop-check-1';
    BEGIN
      PERFORM public.mon_request_boost(v_b, 'prop-check-1', 'top', 7, NULL, 'kb-x');
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'only the owner can buy a sticker', 'ok', v_res = 'MON:not_owner', 'd', v_res);

    v_j := public.mon_request_boost(v_a, 'prop-check-1', 'top', 7, NULL, 'kb-1');
    v_bo1 := (v_j ->> 'boost_id')::uuid;
    BEGIN
      PERFORM public.mon_request_boost(v_a, 'prop-check-1', 'top', 3, NULL, 'kb-2');
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'one pending request per sticker type', 'ok', v_res = 'MON:already_pending', 'd', v_res);
    PERFORM public.mon_apply_payment((v_j ->> 'order_id')::uuid, 'mock', 'TB1', 40000, NULL);
    SELECT status INTO v_txt FROM public.property_boosts WHERE id = v_bo1;
    r := r || jsonb_build_object('n', 'a paid sticker waits for admin approval', 'ok', v_txt = 'PENDING_APPROVAL', 'd', v_txt);
    v_j2 := public.mon_moderate_boost(v_bo1, 'approve', NULL, 'admin');
    v_s1 := (v_j2 ->> 'starts_at')::timestamptz;
    v_e1 := (v_j2 ->> 'ends_at')::timestamptz;
    r := r || jsonb_build_object('n', 'a 7-day sticker runs 7 days from approval', 'ok',
      v_j2 ->> 'status' = 'ACTIVE' AND v_e1 - v_s1 = interval '7 days', 'd', v_j2);

    v_j := public.mon_request_boost(v_a, 'prop-check-1', 'top', 3, NULL, 'kb-3');
    v_bo2 := (v_j ->> 'boost_id')::uuid;
    PERFORM public.mon_apply_payment((v_j ->> 'order_id')::uuid, 'mock', 'TB2', 20000, NULL);
    v_j2 := public.mon_moderate_boost(v_bo2, 'approve', NULL, 'admin');
    v_s2 := (v_j2 ->> 'starts_at')::timestamptz;
    r := r || jsonb_build_object('n', 'buying again while active queues the new period after the current one', 'ok',
      v_s2 = v_e1, 'd', v_j2);

    v_ref := public.mon_request_refund((SELECT o.id FROM public.payment_orders o WHERE o.boost_id = v_bo1 AND o.status = 'PAID'),
      'admin exception', 'admin', 'admin');
    PERFORM public.mon_settle_refund(v_ref, 'SUCCEEDED', 'mock-ref-2', NULL, 'provider', 'mock');
    SELECT status INTO v_txt FROM public.property_boosts WHERE id = v_bo1;
    r := r || jsonb_build_object('n', 'a refunded sticker is revoked at once', 'ok', v_txt = 'REVOKED', 'd', v_txt);

    -- 13. promotions and promo limits
    INSERT INTO public.promotions (name, discount_type, discount_value, services, starts_at, ends_at)
    VALUES ('Check sale', 'percent', 20, ARRAY['listing'], now() - interval '1 day', now() + interval '1 day');
    v_j := public.mon_quote(v_c, 'listing', NULL, NULL, NULL);
    r := r || jsonb_build_object('n', 'a running promotion is applied (20%)', 'ok',
      v_j ->> 'discount_source' = 'promotion' AND (v_j ->> 'final')::bigint = 40000, 'd', v_j);
    INSERT INTO public.promo_codes (code, discount_type, discount_value) VALUES ('BIG30', 'percent', 30);
    v_j := public.mon_quote(v_c, 'listing', NULL, NULL, 'big30');
    r := r || jsonb_build_object('n', 'promo and promotion are not combined: the bigger wins', 'ok',
      v_j ->> 'discount_source' = 'promo_code' AND (v_j ->> 'final')::bigint = 35000, 'd', v_j);
    INSERT INTO public.promo_codes (code, discount_type, discount_value) VALUES ('HUGE', 'fixed', 9999999);
    v_j := public.mon_quote(v_c, 'listing', NULL, NULL, 'HUGE');
    r := r || jsonb_build_object('n', 'a discount never makes the price zero', 'ok', (v_j ->> 'final')::bigint = 1, 'd', v_j);
    v_j := public.mon_quote(v_c, 'listing', NULL, NULL, 'NOPE');
    r := r || jsonb_build_object('n', 'an unknown promo code is reported, price unchanged', 'ok',
      v_j ->> 'promo_error' = 'invalid' AND (v_j ->> 'final')::bigint = 40000, 'd', v_j);
    BEGIN
      INSERT INTO public.promo_codes (code, discount_type, discount_value) VALUES ('FREE100', 'percent', 100);
      v_res := 'accepted';
    EXCEPTION WHEN check_violation THEN v_res := 'rejected';
    WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a 100% promo code cannot be created', 'ok', v_res = 'rejected', 'd', v_res);

    -- 14. financial records are insert-only
    BEGIN
      UPDATE public.payment_transactions SET amount_uzs = 1 WHERE provider_txn_id = 'T1b';
      v_res := 'update allowed';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'payment transactions cannot be edited', 'ok', v_res IS DISTINCT FROM 'update allowed', 'd', v_res);

    EXECUTE 'RESET ROLE';

    -- 15. clients are locked out
    SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (c_tables) AND c.relrowsecurity;
    r := r || jsonb_build_object('n', 'RLS is enabled on all 10 new tables', 'ok', v_n = 10, 'd', v_n);
    SELECT count(*) INTO v_n
    FROM unnest(c_tables) AS t(name), unnest(ARRAY['anon', 'authenticated']) AS g(role_name),
         unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p(priv)
    WHERE has_table_privilege(g.role_name, 'public.' || t.name, p.priv);
    r := r || jsonb_build_object('n', 'anon/authenticated have no privilege on the new tables', 'ok', v_n = 0, 'd', v_n);
    SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace, unnest(ARRAY['anon', 'authenticated']) AS g(role_name)
    WHERE n.nspname = 'public' AND p.proname LIKE 'mon\_%' AND has_function_privilege(g.role_name, p.oid, 'EXECUTE');
    r := r || jsonb_build_object('n', 'anon/authenticated cannot execute any mon_ function', 'ok', v_n = 0, 'd', v_n);

    RAISE EXCEPTION USING MESSAGE = 'mon_check_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'mon_check_rollback' THEN
      RAISE;
    END IF;
  END;

  RETURN QUERY SELECT e->>'n', (e->>'ok')::boolean, left(e->>'d', 300) FROM jsonb_array_elements(r) AS e;
END;
$fn$;

SELECT * FROM pg_temp.mon_check_1b();
