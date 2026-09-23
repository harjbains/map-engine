begin;
set local search_path = extensions, public, auth;
select plan(13);

select has_type('public', 'uber_plan_day_weight', 'weight enum exists');
select has_column('public', 'uber_week_plan_days', 'work_weight', 'plan day stores its weight');
select is((select relrowsecurity::text from pg_class where oid = 'public.uber_week_plan_days'::regclass), 'true', 'plan day RLS remains enabled');
select is(has_function_privilege('anon', 'public.set_uber_week_plan_weights(date, public.uber_plan_day_weight[])', 'EXECUTE')::text, 'false', 'anonymous users cannot call bulk plan RPC');
select is(has_function_privilege('authenticated', 'public.set_uber_week_plan_weights(date, public.uber_plan_day_weight[])', 'EXECUTE')::text, 'true', 'authenticated users can call bulk plan RPC');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v3-weights-test@example.invalid', 'not-used', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select lives_ok($$ select public.create_uber_week_plan('2026-09-14', 750.00, array[true,true,true,true,true,false,false]); $$, 'existing creation RPC still makes seven plan days');
select is((select count(*)::integer from public.uber_week_plan_days where owner_id = auth.uid() and week_start = '2026-09-14' and work_weight = 'normal'), 7, 'preexisting-style days default safely to NORMAL');
select lives_ok($$ select public.upsert_uber_day_record('2026-09-15', 45.00, 12.4, 3, 'completed'); $$, 'actual can be recorded before plan edit');
select lives_ok($$ select public.set_uber_week_plan_weights('2026-09-14', array['normal','light',null,'heavy','heavy',null,'light']::public.uber_plan_day_weight[]); $$, 'bulk weights save transactionally');
select is((select count(*)::integer from public.uber_week_plan_days where owner_id = auth.uid() and week_start = '2026-09-14' and is_working), 5, 'NULL weights become OFF');
select is((select work_weight::text from public.uber_week_plan_days where owner_id = auth.uid() and date = '2026-09-17'), 'heavy', 'HEAVY weight persists');
select is((select gross_earnings::text from public.uber_day_records where owner_id = auth.uid() and date = '2026-09-15'), '45.00', 'plan edits do not rewrite actual earnings');
select throws_ok($$ select public.set_uber_week_plan_weights('2026-09-14', array['light']::public.uber_plan_day_weight[]); $$, 'weights must contain exactly seven Monday-Sunday values', 'incomplete arrays are rejected');

select * from finish();
rollback;
