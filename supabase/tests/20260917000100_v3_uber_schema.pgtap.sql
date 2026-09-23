begin;

-- Supabase installs pgTAP in the `extensions` schema.  Keep test lookup
-- explicit so this suite runs consistently in the project SQL editor and CI.
set local search_path = extensions, public, auth;

select plan(24);

select has_table('public', 'uber_week_plans', 'week plans table exists');
select has_table('public', 'uber_week_plan_days', 'week plan days table exists');
select has_table('public', 'uber_day_records', 'daily actuals table exists');
select has_type('public', 'uber_day_status', 'day status enum exists');

select is(
  (select relrowsecurity::text from pg_class where oid = 'public.uber_week_plans'::regclass),
  'true',
  'week plans enforce RLS'
);

select is(
  (select relrowsecurity::text from pg_class where oid = 'public.uber_week_plan_days'::regclass),
  'true',
  'week plan days enforce RLS'
);

select is(
  (select relrowsecurity::text from pg_class where oid = 'public.uber_day_records'::regclass),
  'true',
  'day records enforce RLS'
);

select is(
  has_table_privilege('authenticated', 'public.uber_day_records', 'INSERT')::text,
  'false',
  'authenticated clients cannot write day records directly'
);

-- The tables reference auth.users, so create an isolated Auth fixture that is
-- rolled back with the test transaction.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'v3-schema-test@example.invalid',
  'not-used-by-database-tests',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select lives_ok(
  $$ select public.create_uber_week_plan('2026-09-14', 750.00, array[true, true, true, true, true, false, false]); $$,
  'authenticated owner can create a Monday-starting plan'
);

select results_eq(
  $$
    select count(*)::integer
    from public.uber_week_plan_days
    where owner_id = '11111111-1111-1111-1111-111111111111'
      and week_start = '2026-09-14'
  $$,
  array[7],
  'plan creation generates exactly seven day rows'
);

select results_eq(
  $$
    select count(*)::integer
    from public.uber_week_plan_days
    where owner_id = '11111111-1111-1111-1111-111111111111'
      and week_start = '2026-09-14'
      and is_working
  $$,
  array[5],
  'creation preserves Monday-Sunday working-day input'
);

select throws_ok(
  $$ select public.create_uber_week_plan('2026-09-15', 750.00, array[true, true, true, true, true, false, false]); $$,
  'week_start must be a Monday',
  'a non-Monday week plan is rejected'
);

select throws_ok(
  $$ select public.create_uber_week_plan('2026-09-21', 750.00, array[true, false]); $$,
  'working_days must contain exactly seven Monday-Sunday values',
  'an incomplete plan is rejected'
);

select lives_ok(
  $$ select public.create_uber_week_plan('2026-09-21', 750.00, array[false, false, false, false, false, false, false]); $$,
  'a positive target with zero planned work days remains valid'
);

select lives_ok(
  $$ select public.upsert_uber_day_record('2026-09-14', 85.00, 21.5, 6, 'completed'); $$,
  'a completed actual can be saved'
);

select lives_ok(
  $$ select public.upsert_uber_day_record('2026-09-20', 85.00, 21.5, 6, 'completed'); $$,
  'an actual outside the plan can be saved'
);

select results_eq(
  $$
    select gross_earnings
    from public.uber_day_records
    where owner_id = '11111111-1111-1111-1111-111111111111'
      and date = '2026-09-20'
  $$,
  array[85.00::numeric],
  'outside-plan earnings remain an actual'
);

select lives_ok(
  $$ select public.mark_uber_day_missed('2026-09-15'); $$,
  'a planned working day can be explicitly marked missed'
);

select results_eq(
  $$
    select count(*)::integer
    from public.uber_day_records
    where owner_id = '11111111-1111-1111-1111-111111111111'
      and date = '2026-09-15'
      and gross_earnings = 0
      and business_miles = 0
      and trips = 0
  $$,
  array[1],
  'missed days persist zero actuals'
);

select throws_ok(
  $$ select public.mark_uber_day_missed('2026-09-20'); $$,
  'Only a planned working day can be marked missed',
  'an unplanned day cannot be marked missed'
);

select throws_ok(
  $$ select public.mark_uber_day_missed('2026-09-14'); $$,
  'A recorded working or completed day cannot be overwritten as missed',
  'marking missed never erases an actual'
);

select lives_ok(
  $$ select public.upsert_uber_day_record('2026-09-15', 47.25, 13.2, 4, 'completed'); $$,
  'a missed day can be deliberately corrected'
);

select throws_ok(
  $$ select public.upsert_uber_day_record('2026-09-16', 1.001, 1.0, 1, 'working'); $$,
  'gross_earnings must be non-negative with at most two decimal places',
  'earnings precision is enforced'
);

select throws_ok(
  $$ select public.upsert_uber_day_record('2026-09-16', 1.00, 1.25, 1, 'working'); $$,
  'business_miles must be non-negative with at most one decimal place',
  'mileage precision is enforced'
);

select * from finish();

rollback;
