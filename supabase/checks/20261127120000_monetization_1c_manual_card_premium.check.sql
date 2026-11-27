-- =============================================================================
-- Checks for 20261127120000_monetization_1c_manual_card_premium.sql — TEST project only.
--
-- Runs as service_role (the role the server uses): Premium tier, manual card
-- payment (receipt, review, reject, info request, approve once), receipt reuse,
-- refunds kept apart from payments, and the client lock-down.
-- Everything is rolled back at the end, so the database is left unchanged.
-- =============================================================================

CREATE OR REPLACE FUNCTION pg_temp.mon_check_1c()
RETURNS TABLE (check_name text, ok boolean, detail text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  r      jsonb := '[]'::jsonb;
  v_res  text;
  v_j    jsonb;
  v_a    uuid; v_b uuid;
  v_s1   uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid;
  v_o1   uuid; v_o2 uuid; v_o3 uuid; v_o4 uuid;
  v_ref  uuid;
  v_n    integer;
  v_txt  text;
  v_sha  text;
  c_tables constant text[] := ARRAY['payment_methods', 'payment_receipts', 'payment_reviews'];
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE service_role';

    SELECT a.account_id INTO v_a FROM public.mon_resolve_customer_account('telegram', '920000000001', NULL, '+998910000001', true) a;
    SELECT a.account_id INTO v_b FROM public.mon_resolve_customer_account('telegram', '920000000002', NULL, '+998910000002', true) a;
    INSERT INTO public.app_settings (key, value) VALUES ('monetization_settings', '{"enabled": true}'::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    PERFORM public.mon_set_price('listing', NULL, NULL, 50000, 'check');
    PERFORM public.mon_set_price('listing', NULL, NULL, 120000, 'check', 'premium');
    PERFORM public.mon_set_price('sticker', 'top', 7, 40000, 'check');

    -- 1. prices: Standard 50 000, Premium 120 000
    v_j := public.mon_quote(v_a, 'listing', NULL, NULL, NULL);
    r := r || jsonb_build_object('n', 'Standard costs 50 000', 'ok', (v_j ->> 'final')::bigint = 50000, 'd', v_j ->> 'final');
    v_j := public.mon_quote(v_a, 'listing', NULL, NULL, NULL, false, 'premium');
    r := r || jsonb_build_object('n', 'Premium costs 120 000', 'ok', (v_j ->> 'final')::bigint = 120000 AND v_j -> 'plan' ->> 'listing_tier' = 'premium', 'd', v_j ->> 'final');

    -- 2. Premium is never free, even as the first listing
    v_j := public.mon_listing_terms(v_a, '+998910000001', NULL, false, 'premium');
    r := r || jsonb_build_object('n', 'Premium is paid even for the first listing', 'ok', v_j ->> 'billing' = 'paid', 'd', v_j ->> 'billing');
    v_j := public.mon_listing_terms(v_a, '+998910000001', NULL, false, 'standard');
    r := r || jsonb_build_object('n', 'the first Standard listing is free', 'ok', v_j ->> 'billing' = 'free', 'd', v_j ->> 'billing');

    -- 3. no card yet -> receipts are refused
    v_j := public.mon_submit_listing(v_a, NULL, 'web', 'A', '+998910000001', true, 'phone', '{}', '{}', NULL, 'chk-p1', NULL, 'premium');
    v_s1 := (v_j ->> 'submission_id')::uuid; v_o1 := (v_j ->> 'order_id')::uuid;
    SELECT listing_tier || '/' || moderation_status INTO v_txt FROM public.listing_submissions WHERE id = v_s1;
    r := r || jsonb_build_object('n', 'a Premium application waits for payment', 'ok', v_txt = 'premium/AWAITING_PAYMENT' AND (v_j ->> 'amount')::bigint = 120000, 'd', v_txt);
    v_sha := repeat('a', 64);
    BEGIN
      PERFORM public.mon_submit_receipt(v_o1, v_a, v_a || '/' || v_o1 || '/' || gen_random_uuid() || '.jpg', v_sha, 'image/jpeg', 1000, NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'without an active card no receipt is accepted', 'ok', v_res = 'MON:payments_closed', 'd', v_res);

    -- 4. admin sets the card (invalid numbers refused)
    BEGIN
      PERFORM public.mon_set_payment_method('1234', 'Test Holder', NULL, NULL, true, 'admin');
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'an invalid card number is refused', 'ok', v_res = 'MON:invalid_card', 'd', v_res);
    PERFORM public.mon_set_payment_method('0000 1111 2222 3333', 'TEST KARTA', 'Test bank', 'Izohga buyurtma ID', true, 'admin');

    -- 5. another account cannot use the order; a bad path is refused
    BEGIN
      PERFORM public.mon_submit_receipt(v_o1, v_b, v_b || '/' || v_o1 || '/' || gen_random_uuid() || '.jpg', v_sha, 'image/jpeg', 1000, NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'another account cannot send a receipt for the order', 'ok', v_res = 'MON:not_found', 'd', v_res);
    BEGIN
      PERFORM public.mon_submit_receipt(v_o1, v_a, v_b || '/' || v_o1 || '/' || gen_random_uuid() || '.jpg', v_sha, 'image/jpeg', 1000, NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'a receipt stored under another account is refused', 'ok', v_res = 'MON:invalid_receipt', 'd', v_res);

    -- 6. receipt -> RECEIPT_SUBMITTED; the listing is still not in moderation
    PERFORM public.mon_submit_receipt(v_o1, v_a, v_a || '/' || v_o1 || '/' || gen_random_uuid() || '.jpg', v_sha, 'image/jpeg', 1000, 'Payme');
    SELECT o.status || '/' || s.moderation_status INTO v_txt FROM public.payment_orders o JOIN public.listing_submissions s ON s.id = o.submission_id WHERE o.id = v_o1;
    r := r || jsonb_build_object('n', 'a receipt alone is not a payment', 'ok', v_txt = 'RECEIPT_SUBMITTED/AWAITING_PAYMENT', 'd', v_txt);
    SELECT card_snapshot ->> 'last4' INTO v_txt FROM public.payment_receipts WHERE order_id = v_o1;
    r := r || jsonb_build_object('n', 'the receipt remembers the card shown', 'ok', v_txt = '3333', 'd', v_txt);
    BEGIN
      PERFORM public.mon_submit_receipt(v_o1, v_a, v_a || '/' || v_o1 || '/' || gen_random_uuid() || '.jpg', repeat('b', 64), 'image/jpeg', 1000, NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'no second receipt while one is being checked', 'ok', v_res = 'MON:receipt_under_review', 'd', v_res);
    BEGIN
      PERFORM public.mon_cancel_submission(v_s1, v_a);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'the customer cannot withdraw while the receipt is checked', 'ok', v_res = 'MON:payment_under_review', 'd', v_res);

    -- 7. review: start, reject (reason required), resend, info request, approve
    v_j := public.mon_review_payment(v_o1, 'start', NULL, 'admin');
    r := r || jsonb_build_object('n', 'start review -> UNDER_REVIEW', 'ok', v_j ->> 'status' = 'UNDER_REVIEW', 'd', v_j ->> 'status');
    BEGIN
      PERFORM public.mon_review_payment(v_o1, 'reject', '  ', 'admin');
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'rejecting needs a reason', 'ok', v_res = 'MON:reason_required', 'd', v_res);
    PERFORM public.mon_review_payment(v_o1, 'reject', 'Summa tushmagan', 'admin');
    SELECT status || '/' || coalesce(status_reason, '') INTO v_txt FROM public.payment_orders WHERE id = v_o1;
    r := r || jsonb_build_object('n', 'reject -> REJECTED with the reason', 'ok', v_txt = 'REJECTED/Summa tushmagan', 'd', v_txt);
    BEGIN
      PERFORM public.mon_submit_receipt(v_o1, v_a, v_a || '/' || v_o1 || '/' || gen_random_uuid() || '.jpg', v_sha, 'image/jpeg', 1000, NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'the same receipt cannot be sent again', 'ok', v_res = 'MON:receipt_reused', 'd', v_res);
    PERFORM public.mon_submit_receipt(v_o1, v_a, v_a || '/' || v_o1 || '/' || gen_random_uuid() || '.png', repeat('c', 64), 'image/png', 2000, NULL);
    PERFORM public.mon_review_payment(v_o1, 'request_info', 'To‘liq skrinshot kerak', 'admin');
    SELECT status INTO v_txt FROM public.payment_orders WHERE id = v_o1;
    r := r || jsonb_build_object('n', 'info request -> INFO_REQUESTED', 'ok', v_txt = 'INFO_REQUESTED', 'd', v_txt);
    PERFORM public.mon_submit_receipt(v_o1, v_a, v_a || '/' || v_o1 || '/' || gen_random_uuid() || '.pdf', repeat('d', 64), 'application/pdf', 3000, NULL);
    v_j := public.mon_review_payment(v_o1, 'approve', NULL, 'admin');
    SELECT o.status || '/' || s.moderation_status || '/' || coalesce(s.property_id, '-') INTO v_txt
    FROM public.payment_orders o JOIN public.listing_submissions s ON s.id = o.submission_id WHERE o.id = v_o1;
    r := r || jsonb_build_object('n', 'approve -> PAID, listing goes to moderation (not published)', 'ok', v_txt = 'PAID/PENDING_REVIEW/-', 'd', v_txt);
    SELECT count(*) INTO v_n FROM public.payment_transactions WHERE order_id = v_o1 AND provider = 'manual_card' AND state = 'performed';
    r := r || jsonb_build_object('n', 'one payment record is written', 'ok', v_n = 1, 'd', v_n);
    SELECT count(*) INTO v_n FROM public.property_boosts b JOIN public.listing_submissions s ON s.id = b.submission_id WHERE s.id = v_s1;
    r := r || jsonb_build_object('n', 'Premium does not create any TOP sticker', 'ok', v_n = 0, 'd', v_n);
    BEGIN
      PERFORM public.mon_review_payment(v_o1, 'approve', NULL, 'admin');
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'an order cannot be approved twice', 'ok', v_res = 'MON:already_paid', 'd', v_res);
    -- (one transaction: created_at is the same for all rows, so compare without order)
    SELECT string_agg(decision, ',' ORDER BY decision) INTO v_txt FROM public.payment_reviews WHERE order_id = v_o1;
    r := r || jsonb_build_object('n', 'every admin decision is recorded', 'ok', v_txt = 'approved,info_requested,rejected,started', 'd', v_txt);
    SELECT string_agg(left(sha256, 1) || '=' || state, ',' ORDER BY sha256) INTO v_txt FROM public.payment_receipts WHERE order_id = v_o1;
    r := r || jsonb_build_object('n', 'receipt states: first rejected, second superseded, last accepted', 'ok', v_txt = 'a=rejected,c=superseded,d=accepted', 'd', v_txt);
    BEGIN
      UPDATE public.payment_reviews SET note = 'x' WHERE order_id = v_o1;
      v_res := 'update allowed';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'payment reviews cannot be edited', 'ok', v_res <> 'update allowed', 'd', v_res);

    -- 8. a receipt used on one order cannot be used on another
    v_j := public.mon_submit_listing(v_b, NULL, 'web', 'B', '+998910000002', true, 'phone', '{}', '{}', NULL, 'chk-p2', NULL, 'premium');
    v_o2 := (v_j ->> 'order_id')::uuid; v_s2 := (v_j ->> 'submission_id')::uuid;
    BEGIN
      PERFORM public.mon_submit_receipt(v_o2, v_b, v_b || '/' || v_o2 || '/' || gen_random_uuid() || '.pdf', repeat('d', 64), 'application/pdf', 3000, NULL);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN v_res := SQLERRM; END;
    r := r || jsonb_build_object('n', 'a receipt of another order is refused', 'ok', v_res = 'MON:receipt_reused', 'd', v_res);

    -- 9. refunds stay apart: rejecting the paid listing requests a refund, the payment stays PAID
    v_j := public.mon_moderate_submission(v_s1, 'reject', 'Hujjat yo‘q', 'admin');
    v_ref := (v_j ->> 'refund_id')::uuid;
    PERFORM public.mon_settle_refund(v_ref, 'MANUAL_REQUIRED', NULL, NULL, 'admin', 'admin');
    PERFORM public.mon_settle_refund(v_ref, 'MANUAL_CONFIRMED', 'BANK-REF-1', NULL, 'admin', 'admin');
    SELECT o.status || '/' || f.status INTO v_txt FROM public.payment_orders o JOIN public.refunds f ON f.order_id = o.id WHERE o.id = v_o1;
    r := r || jsonb_build_object('n', 'refund is recorded apart; the payment stays PAID', 'ok', v_txt = 'PAID/MANUAL_CONFIRMED', 'd', v_txt);

    -- 10. a service closed while the receipt waited: approval opens a refund
    PERFORM public.mon_submit_receipt(v_o2, v_b, v_b || '/' || v_o2 || '/' || gen_random_uuid() || '.jpg', repeat('e', 64), 'image/jpeg', 1000, NULL);
    UPDATE public.listing_submissions SET moderation_status = 'CANCELLED_BY_USER' WHERE id = v_s2; -- simulated
    v_j := public.mon_review_payment(v_o2, 'approve', NULL, 'admin');
    SELECT count(*) INTO v_n FROM public.refunds WHERE order_id = v_o2 AND status = 'REQUESTED';
    r := r || jsonb_build_object('n', 'approving a payment for a closed service opens a refund', 'ok', v_j ->> 'target' = 'closed' AND v_n = 1, 'd', v_j);

    -- 11. cancel an unpaid order and open a new one (B uses the free right first)
    v_j := public.mon_submit_listing(v_b, NULL, 'web', 'B', '+998910000002', true, 'phone', '{}', '{}', NULL, 'chk-s4', NULL, 'standard');
    r := r || jsonb_build_object('n', 'B''s first Standard listing is free', 'ok', v_j ->> 'billing' = 'free', 'd', v_j ->> 'billing');
    v_j := public.mon_submit_listing(v_b, NULL, 'web', 'B', '+998910000002', true, 'phone', '{}', '{}', NULL, 'chk-s3', NULL, 'standard');
    v_s3 := (v_j ->> 'submission_id')::uuid; v_o3 := (v_j ->> 'order_id')::uuid;
    r := r || jsonb_build_object('n', 'a second Standard listing is paid', 'ok', v_o3 IS NOT NULL AND (v_j ->> 'amount')::bigint = 50000, 'd', v_j ->> 'amount');
    PERFORM public.mon_close_order(v_o3, 'CANCELLED', 'check', 'customer', v_b::text, v_b);
    SELECT status INTO v_txt FROM public.payment_orders WHERE id = v_o3;
    r := r || jsonb_build_object('n', 'the customer can cancel an unpaid order', 'ok', v_txt = 'CANCELLED', 'd', v_txt);
    v_j := public.mon_ensure_listing_order(v_s3, v_b, NULL);
    v_o4 := (v_j ->> 'order_id')::uuid;
    r := r || jsonb_build_object('n', 'a new order can be opened after cancelling', 'ok', v_o4 IS NOT NULL AND v_o4 <> v_o3, 'd', v_j ->> 'status');
    v_j := public.mon_ensure_listing_order(v_s3, v_b, NULL);
    r := r || jsonb_build_object('n', 'the open order is reused, not duplicated', 'ok', (v_j ->> 'order_id')::uuid = v_o4, 'd', v_j ->> 'order_id');

    EXECUTE 'RESET ROLE';

    -- 12. clients are locked out
    SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (c_tables) AND c.relrowsecurity;
    r := r || jsonb_build_object('n', 'RLS is enabled on the 3 new tables', 'ok', v_n = 3, 'd', v_n);
    SELECT count(*) INTO v_n
    FROM unnest(c_tables) AS t(name), unnest(ARRAY['anon', 'authenticated']) AS g(role_name),
         unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p(priv)
    WHERE has_table_privilege(g.role_name, 'public.' || t.name, p.priv);
    r := r || jsonb_build_object('n', 'anon/authenticated have no privilege on the new tables', 'ok', v_n = 0, 'd', v_n);
    SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace, unnest(ARRAY['anon', 'authenticated']) AS g(role_name)
    WHERE n.nspname = 'public' AND p.proname LIKE 'mon\_%' AND has_function_privilege(g.role_name, p.oid, 'EXECUTE');
    r := r || jsonb_build_object('n', 'anon/authenticated cannot execute any mon_ function (no browser can approve)', 'ok', v_n = 0, 'd', v_n);
    SELECT count(*) INTO v_n FROM storage.buckets WHERE id = 'payment-receipts' AND NOT public;
    r := r || jsonb_build_object('n', 'the receipts bucket is private', 'ok', v_n = 1, 'd', v_n);
    SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
    r := r || jsonb_build_object('n', 'no storage policy opens files to clients', 'ok', v_n = 0, 'd', v_n);

    RAISE EXCEPTION USING MESSAGE = 'mon_check_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'mon_check_rollback' THEN
      RAISE;
    END IF;
  END;

  RETURN QUERY SELECT e->>'n', (e->>'ok')::boolean, left(e->>'d', 300) FROM jsonb_array_elements(r) AS e;
END;
$fn$;

SELECT * FROM pg_temp.mon_check_1c();
