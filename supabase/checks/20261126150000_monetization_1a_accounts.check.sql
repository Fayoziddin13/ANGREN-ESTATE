-- =============================================================================
-- Checks for 20261126150000_monetization_1a_accounts.sql — TEST project only.
--
-- Run the whole file at once as the `postgres` role (Supabase SQL editor, or MCP
-- execute_sql on the test project). Returns one row per check: check_name, ok, detail.
--
-- Nothing is left behind: the checks run inside a block that ends with a deliberate
-- exception, so every row they create (accounts, prices, even audit entries) is
-- rolled back. Roles are switched with SET LOCAL ROLE to test what anon,
-- authenticated and service_role can really do. Error messages are matched
-- exactly, so an unrelated failure is reported instead of being counted as a pass.
-- =============================================================================

CREATE OR REPLACE FUNCTION pg_temp.mon_check_1a()
RETURNS TABLE (check_name text, ok boolean, detail text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  r        jsonb := '[]'::jsonb;
  v_count  integer;
  v_id     bigint;
  v_acc1   uuid;
  v_acc2   uuid;
  v_new1   boolean;
  v_new2   boolean;
  v_phone  text;
  v_ver    boolean;
  v_status text;
  v_res    text;
  c_tables constant text[] := ARRAY['customer_accounts', 'customer_identities', 'pricing_plans', 'monetization_audit_logs'];
  c_funcs  constant text[] := ARRAY[
    'public.mon_resolve_customer_account(text,text,text,text,boolean,text,text)',
    'public.mon_set_customer_account_status(uuid,text,text,text,text,text)'];
BEGIN
  BEGIN
    -- ------------------------------------------------- structure and privileges
    SELECT count(*) INTO v_count
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (c_tables) AND c.relrowsecurity;
    r := r || jsonb_build_object('n', 'RLS is enabled on all 4 tables', 'ok', v_count = 4, 'd', v_count);

    SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY (c_tables);
    r := r || jsonb_build_object('n', 'no RLS policies (server-only access)', 'ok', v_count = 0, 'd', v_count);

    SELECT count(*) INTO v_count
    FROM unnest(c_tables) AS t(name),
         unnest(ARRAY['anon', 'authenticated']) AS g(role_name),
         unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS p(priv)
    WHERE has_table_privilege(g.role_name, 'public.' || t.name, p.priv);
    r := r || jsonb_build_object('n', 'anon/authenticated have no privilege on the tables', 'ok', v_count = 0, 'd', v_count);

    SELECT count(*) INTO v_count
    FROM unnest(c_funcs) AS f(sig), unnest(ARRAY['anon', 'authenticated']) AS g(role_name)
    WHERE has_function_privilege(g.role_name, f.sig, 'EXECUTE');
    r := r || jsonb_build_object('n', 'anon/authenticated cannot execute the functions', 'ok', v_count = 0, 'd', v_count);

    SELECT count(*) INTO v_count FROM unnest(c_funcs) AS f(sig) WHERE has_function_privilege('service_role', f.sig, 'EXECUTE');
    r := r || jsonb_build_object('n', 'service_role can execute the functions', 'ok', v_count = 2, 'd', v_count);

    r := r || jsonb_build_object('n', 'service_role has no UPDATE/DELETE on the audit log',
      'ok', NOT has_table_privilege('service_role', 'public.monetization_audit_logs', 'UPDATE')
            AND NOT has_table_privilege('service_role', 'public.monetization_audit_logs', 'DELETE'), 'd', null);

    SELECT count(*) INTO v_count FROM pg_trigger
    WHERE NOT tgisinternal AND tgname IN ('trg_mon_audit_no_update_delete', 'trg_mon_audit_no_truncate',
      'trg_customer_accounts_updated_at', 'trg_customer_identities_updated_at', 'trg_pricing_plans_updated_at');
    r := r || jsonb_build_object('n', 'all 5 triggers exist', 'ok', v_count = 5, 'd', v_count);

    -- --------------------------------------------- runtime denial for clients
    BEGIN
      EXECUTE 'SET LOCAL ROLE anon';
      PERFORM 1 FROM public.customer_accounts LIMIT 1;
      v_res := 'read allowed';
    EXCEPTION WHEN OTHERS THEN
      v_res := CASE WHEN SQLERRM LIKE 'permission denied for table customer_accounts%' THEN 'denied' ELSE SQLERRM END;
    END;
    EXECUTE 'RESET ROLE';
    r := r || jsonb_build_object('n', 'anon: SELECT customer_accounts is denied', 'ok', v_res = 'denied', 'd', v_res);

    BEGIN
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM * FROM public.mon_resolve_customer_account('telegram', '900000000009');
      v_res := 'executed';
    EXCEPTION WHEN OTHERS THEN
      v_res := CASE WHEN SQLERRM LIKE 'permission denied for function mon_resolve_customer_account%' THEN 'denied' ELSE SQLERRM END;
    END;
    EXECUTE 'RESET ROLE';
    r := r || jsonb_build_object('n', 'authenticated: cannot call mon_resolve_customer_account', 'ok', v_res = 'denied', 'd', v_res);

    -- ------------------------------------------------- account resolution
    BEGIN
      EXECUTE 'SET LOCAL ROLE service_role';
      SELECT a.account_id, a.is_new INTO v_acc1, v_new1
      FROM public.mon_resolve_customer_account('telegram', '900000000001', NULL, '+998901234567', true, 'check_user', 'Check') a;
      SELECT a.account_id, a.is_new INTO v_acc2, v_new2
      FROM public.mon_resolve_customer_account('telegram', '900000000001', NULL, '+998907777777', false) a;
      SELECT i.phone_e164, i.phone_verified INTO v_phone, v_ver
      FROM public.customer_identities i WHERE i.provider = 'telegram' AND i.provider_subject = '900000000001';
      EXECUTE 'RESET ROLE';
      r := r || jsonb_build_object('n', 'same identity resolves to the same account', 'ok',
        v_acc1 IS NOT NULL AND v_acc1 = v_acc2 AND v_new1 AND NOT v_new2, 'd', format('%s %s %s', v_acc1, v_new1, v_new2));
      r := r || jsonb_build_object('n', 'a verified phone is not replaced by an unverified one', 'ok',
        v_phone = '+998901234567' AND v_ver, 'd', format('%s %s', v_phone, v_ver));
    EXCEPTION WHEN OTHERS THEN
      r := r || jsonb_build_object('n', 'service_role: resolve account', 'ok', false, 'd', SQLERRM);
    END;

    SELECT count(*) INTO v_count FROM public.monetization_audit_logs
    WHERE entity = 'customer_account' AND entity_id = v_acc1::text AND action = 'account.created';
    r := r || jsonb_build_object('n', 'account creation is written to the audit log', 'ok', v_count = 1, 'd', v_count);

    BEGIN
      EXECUTE 'SET LOCAL ROLE service_role';
      PERFORM * FROM public.mon_resolve_customer_account('google', '11111111-2222-4333-8444-555555555555', 'check@example.com');
      EXECUTE 'RESET ROLE';
      v_res := 'ok';
    EXCEPTION WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a Google identity (auth uuid) is accepted', 'ok', v_res = 'ok', 'd', v_res);

    BEGIN
      PERFORM * FROM public.mon_resolve_customer_account('facebook', '1');
      v_res := 'accepted';
    EXCEPTION WHEN invalid_parameter_value THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'an unknown provider is rejected', 'ok', v_res = 'rejected', 'd', v_res);

    BEGIN
      PERFORM * FROM public.mon_resolve_customer_account('telegram', 'tg_900000000002');
      v_res := 'accepted';
    EXCEPTION WHEN check_violation THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a "tg_" prefixed Telegram subject is rejected', 'ok', v_res = 'rejected', 'd', v_res);

    BEGIN
      PERFORM * FROM public.mon_resolve_customer_account('telegram', '900000000003', NULL, '998901234567', true);
      v_res := 'accepted';
    EXCEPTION WHEN check_violation THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a phone that is not E.164 is rejected', 'ok', v_res = 'rejected', 'd', v_res);

    BEGIN
      INSERT INTO public.customer_identities (account_id, provider, provider_subject)
      VALUES (v_acc1, 'telegram', '900000000001');
      v_res := 'accepted';
    EXCEPTION WHEN unique_violation THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'one identity cannot belong to two accounts', 'ok', v_res = 'rejected', 'd', v_res);

    -- ------------------------------------------------------ account status
    BEGIN
      EXECUTE 'SET LOCAL ROLE service_role';
      PERFORM public.mon_set_customer_account_status(v_acc1, 'blocked', '  ', 'check-admin');
      v_res := 'accepted';
    EXCEPTION WHEN invalid_parameter_value THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    EXECUTE 'RESET ROLE';
    r := r || jsonb_build_object('n', 'blocking without a reason is rejected', 'ok', v_res = 'rejected', 'd', v_res);

    BEGIN
      EXECUTE 'SET LOCAL ROLE service_role';
      SELECT s.status INTO v_status
      FROM public.mon_set_customer_account_status(v_acc1, 'blocked', 'check: spam', 'check-admin') s;
      EXECUTE 'RESET ROLE';
    EXCEPTION WHEN OTHERS THEN
      v_status := 'error: ' || SQLERRM;
    END;
    SELECT count(*) INTO v_count FROM public.monetization_audit_logs
    WHERE entity_id = v_acc1::text AND action = 'account.status_changed' AND reason = 'check: spam';
    r := r || jsonb_build_object('n', 'blocking with a reason works and is audited', 'ok',
      v_status = 'blocked' AND v_count = 1, 'd', format('%s, audit rows: %s', v_status, v_count));

    -- --------------------------------------------------- audit is append-only
    INSERT INTO public.monetization_audit_logs (actor_type, action, entity) VALUES ('system', 'check.row', 'check')
    RETURNING id INTO v_id;

    BEGIN
      UPDATE public.monetization_audit_logs SET reason = 'tampered' WHERE id = v_id;
      v_res := 'update allowed';
    EXCEPTION WHEN OTHERS THEN
      v_res := CASE WHEN SQLERRM LIKE 'monetization_audit_logs is append-only%' THEN 'blocked' ELSE SQLERRM END;
    END;
    r := r || jsonb_build_object('n', 'audit UPDATE is blocked, even for the owner', 'ok', v_res = 'blocked', 'd', v_res);

    BEGIN
      DELETE FROM public.monetization_audit_logs WHERE id = v_id;
      v_res := 'delete allowed';
    EXCEPTION WHEN OTHERS THEN
      v_res := CASE WHEN SQLERRM LIKE 'monetization_audit_logs is append-only%' THEN 'blocked' ELSE SQLERRM END;
    END;
    r := r || jsonb_build_object('n', 'audit DELETE is blocked, even for the owner', 'ok', v_res = 'blocked', 'd', v_res);

    BEGIN
      TRUNCATE public.monetization_audit_logs;
      v_res := 'truncate allowed';
    EXCEPTION WHEN OTHERS THEN
      v_res := CASE WHEN SQLERRM LIKE 'monetization_audit_logs is append-only%' THEN 'blocked' ELSE SQLERRM END;
    END;
    r := r || jsonb_build_object('n', 'audit TRUNCATE is blocked, even for the owner', 'ok', v_res = 'blocked', 'd', v_res);

    BEGIN
      EXECUTE 'SET LOCAL ROLE service_role';
      UPDATE public.monetization_audit_logs SET reason = 'tampered' WHERE id = v_id;
      v_res := 'update allowed';
    EXCEPTION WHEN OTHERS THEN
      v_res := CASE WHEN SQLERRM LIKE 'permission denied for table monetization_audit_logs%' THEN 'denied' ELSE SQLERRM END;
    END;
    EXECUTE 'RESET ROLE';
    r := r || jsonb_build_object('n', 'service_role cannot UPDATE the audit log', 'ok', v_res = 'denied', 'd', v_res);

    -- ------------------------------------------------------------ pricing
    INSERT INTO public.pricing_plans (service, sticker_type, duration_days, price_uzs)
    VALUES ('sticker', 'top', 7, 50000);

    BEGIN
      INSERT INTO public.pricing_plans (service, sticker_type, duration_days, price_uzs)
      VALUES ('sticker', 'top', 7, 60000);
      v_res := 'accepted';
    EXCEPTION WHEN unique_violation THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a second active price for the same sticker and duration is rejected', 'ok', v_res = 'rejected', 'd', v_res);

    BEGIN
      INSERT INTO public.pricing_plans (service, sticker_type, duration_days, price_uzs, is_active)
      VALUES ('sticker', 'top', 7, 45000, false);
      v_res := 'accepted';
    EXCEPTION WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'an inactive old price can be kept next to the active one', 'ok', v_res = 'accepted', 'd', v_res);

    BEGIN
      INSERT INTO public.pricing_plans (service, sticker_type, duration_days, price_uzs) VALUES ('listing', 'top', NULL, 10000);
      v_res := 'accepted';
    EXCEPTION WHEN check_violation THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a listing price with a sticker type is rejected', 'ok', v_res = 'rejected', 'd', v_res);

    BEGIN
      INSERT INTO public.pricing_plans (service, sticker_type, duration_days, price_uzs) VALUES ('sticker', 'top', NULL, 10000);
      v_res := 'accepted';
    EXCEPTION WHEN check_violation THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a sticker price without a duration is rejected', 'ok', v_res = 'rejected', 'd', v_res);

    BEGIN
      INSERT INTO public.pricing_plans (service, price_uzs) VALUES ('listing', 0);
      v_res := 'accepted';
    EXCEPTION WHEN check_violation THEN
      v_res := 'rejected';
    WHEN OTHERS THEN
      v_res := SQLERRM;
    END;
    r := r || jsonb_build_object('n', 'a zero price is rejected', 'ok', v_res = 'rejected', 'd', v_res);

    -- Undo everything the checks created.
    RAISE EXCEPTION USING MESSAGE = 'mon_check_rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'mon_check_rollback' THEN
      RAISE;
    END IF;
  END;

  RETURN QUERY
  SELECT e->>'n', (e->>'ok')::boolean, e->>'d'
  FROM jsonb_array_elements(r) AS e;
END;
$fn$;

SELECT * FROM pg_temp.mon_check_1a();
