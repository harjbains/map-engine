-- Map-Engine V3 Uber foundation.
--
-- This migration intentionally contains data ownership, integrity and mutation
-- rules only. It does not create application/UI code, legacy bridge support,
-- daily-target storage, weekly-total storage, or a missed-shift ledger.

create type public.uber_day_status as enum (
  'working',
  'completed',
  'missed'
);

-- Every table is scoped to the Supabase Auth user that owns the data.  The
-- application never supplies owner_id; controlled functions derive it from
-- auth.uid().  week_start is a natural key because there is exactly one plan
-- for an owner in each Monday-Sunday week.
create table public.uber_week_plans (
  owner_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  weekly_target numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (owner_id, week_start),

  constraint uber_week_plans_week_start_is_monday
    check (extract(isodow from week_start) = 1),

  constraint uber_week_plans_weekly_target_is_non_negative
    check (weekly_target >= 0)
);

-- A plan always has seven Monday-Sunday rows.  The creation RPC creates all
-- seven atomically; direct client insert/delete permission is deliberately not
-- granted.  A zero-working-day plan remains valid even when the target is
-- positive: daily targets are then unavailable, rather than being stored or
-- divided by zero.
create table public.uber_week_plan_days (
  owner_id uuid not null,
  week_start date not null,
  date date not null,
  is_working boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (owner_id, week_start, date),

  constraint uber_week_plan_days_plan_fkey
    foreign key (owner_id, week_start)
    references public.uber_week_plans(owner_id, week_start)
    on delete cascade,

  constraint uber_week_plan_days_date_is_in_parent_week
    check (date >= week_start and date <= week_start + 6)
);

-- This is the only V3 financial actuals store.  It is intentionally not tied
-- to a plan row: actual work outside the plan is valid and remains included in
-- weekly totals.  One row is the aggregate actual for one owner/calendar date.
create table public.uber_day_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  gross_earnings numeric(12, 2) not null default 0,
  business_miles numeric(10, 1) not null default 0,
  trips integer not null default 0,
  status public.uber_day_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (owner_id, date),

  constraint uber_day_records_gross_earnings_is_non_negative
    check (gross_earnings >= 0),

  constraint uber_day_records_business_miles_is_non_negative
    check (business_miles >= 0),

  constraint uber_day_records_trips_is_non_negative
    check (trips >= 0),

  constraint uber_day_records_missed_has_zero_actuals
    check (
      status <> 'missed'
      or (gross_earnings = 0 and business_miles = 0 and trips = 0)
    )
);

-- The composite primary keys cover the V3 read paths: one plan/week, its seven
-- plan rows, one actual day, and actuals in a Monday-Sunday date range.  No
-- additional baseline indexes are needed.

create function public.set_uber_v3_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger uber_week_plans_set_updated_at
before update on public.uber_week_plans
for each row execute function public.set_uber_v3_updated_at();

create trigger uber_week_plan_days_set_updated_at
before update on public.uber_week_plan_days
for each row execute function public.set_uber_v3_updated_at();

create trigger uber_day_records_set_updated_at
before update on public.uber_day_records
for each row execute function public.set_uber_v3_updated_at();

alter table public.uber_week_plans enable row level security;
alter table public.uber_week_plan_days enable row level security;
alter table public.uber_day_records enable row level security;

-- Clients can read only their own rows.  All writes use the controlled RPCs
-- below, which derive ownership from auth.uid() and validate their inputs.
create policy uber_week_plans_select_own
on public.uber_week_plans
for select to authenticated
using ((select auth.uid()) = owner_id);

create policy uber_week_plan_days_select_own
on public.uber_week_plan_days
for select to authenticated
using ((select auth.uid()) = owner_id);

create policy uber_day_records_select_own
on public.uber_day_records
for select to authenticated
using ((select auth.uid()) = owner_id);

revoke insert, update, delete on public.uber_week_plans from anon, authenticated;
revoke insert, update, delete on public.uber_week_plan_days from anon, authenticated;
revoke insert, update, delete on public.uber_day_records from anon, authenticated;

grant select on public.uber_week_plans to authenticated;
grant select on public.uber_week_plan_days to authenticated;
grant select on public.uber_day_records to authenticated;

-- Creates a plan and all seven calendar-day rows atomically.  The boolean
-- array is Monday through Sunday.  owner_id is never an argument.
create function public.create_uber_week_plan(
  p_week_start date,
  p_weekly_target numeric,
  p_working_days boolean[]
)
returns public.uber_week_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_plan public.uber_week_plans;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required to create a week plan';
  end if;

  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday';
  end if;

  if p_weekly_target is null
     or p_weekly_target < 0
     or p_weekly_target <> round(p_weekly_target, 2) then
    raise exception 'weekly_target must be a non-negative GBP value with at most two decimal places';
  end if;

  if coalesce(array_ndims(p_working_days), 0) <> 1
     or coalesce(array_length(p_working_days, 1), 0) <> 7 then
    raise exception 'working_days must contain exactly seven Monday-Sunday values';
  end if;

  insert into public.uber_week_plans (owner_id, week_start, weekly_target)
  values (v_owner_id, p_week_start, p_weekly_target)
  returning * into v_plan;

  insert into public.uber_week_plan_days (owner_id, week_start, date, is_working)
  select
    v_owner_id,
    p_week_start,
    p_week_start + day_offset,
    p_working_days[day_offset + 1]
  from generate_series(0, 6) as day_offset;

  return v_plan;
end;
$$;

create function public.set_uber_weekly_target(
  p_week_start date,
  p_weekly_target numeric
)
returns public.uber_week_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_plan public.uber_week_plans;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required to update a week plan';
  end if;

  if p_weekly_target is null
     or p_weekly_target < 0
     or p_weekly_target <> round(p_weekly_target, 2) then
    raise exception 'weekly_target must be a non-negative GBP value with at most two decimal places';
  end if;

  update public.uber_week_plans
  set weekly_target = p_weekly_target
  where owner_id = v_owner_id and week_start = p_week_start
  returning * into v_plan;

  if not found then
    raise exception 'Week plan not found';
  end if;

  return v_plan;
end;
$$;

-- This can only toggle a row generated by create_uber_week_plan; it cannot
-- remove a plan day and therefore cannot reduce a week below seven rows.
create function public.set_uber_week_plan_day(
  p_week_start date,
  p_date date,
  p_is_working boolean
)
returns public.uber_week_plan_days
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_plan_day public.uber_week_plan_days;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required to update a plan day';
  end if;

  update public.uber_week_plan_days
  set is_working = p_is_working
  where owner_id = v_owner_id
    and week_start = p_week_start
    and date = p_date
  returning * into v_plan_day;

  if not found then
    raise exception 'Plan day not found';
  end if;

  return v_plan_day;
end;
$$;

-- Upserts a daily actual.  The missed transition has its own function so it
-- cannot accidentally overwrite a non-zero actual and can verify a planned
-- working day at the time it is marked missed.
create function public.upsert_uber_day_record(
  p_date date,
  p_gross_earnings numeric,
  p_business_miles numeric,
  p_trips integer,
  p_status public.uber_day_status
)
returns public.uber_day_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_record public.uber_day_records;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required to update a day record';
  end if;

  if p_date is null then
    raise exception 'date is required';
  end if;

  if p_status is null or p_status = 'missed' then
    raise exception 'Use mark_uber_day_missed to mark a day missed';
  end if;

  if p_gross_earnings is null
     or p_gross_earnings < 0
     or p_gross_earnings <> round(p_gross_earnings, 2) then
    raise exception 'gross_earnings must be non-negative with at most two decimal places';
  end if;

  if p_business_miles is null
     or p_business_miles < 0
     or p_business_miles <> round(p_business_miles, 1) then
    raise exception 'business_miles must be non-negative with at most one decimal place';
  end if;

  if p_trips is null or p_trips < 0 then
    raise exception 'trips must be a non-negative integer';
  end if;

  insert into public.uber_day_records (
    owner_id,
    date,
    gross_earnings,
    business_miles,
    trips,
    status
  )
  values (
    v_owner_id,
    p_date,
    p_gross_earnings,
    p_business_miles,
    p_trips,
    p_status
  )
  on conflict (owner_id, date) do update
  set
    gross_earnings = excluded.gross_earnings,
    business_miles = excluded.business_miles,
    trips = excluded.trips,
    status = excluded.status
  returning * into v_record;

  return v_record;
end;
$$;

-- Marks only a planned working day as missed.  An existing working/completed
-- actual is never erased by this action; it must be deliberately edited first.
create function public.mark_uber_day_missed(
  p_date date
)
returns public.uber_day_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_week_start date;
  v_existing_status public.uber_day_status;
  v_record public.uber_day_records;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required to mark a day missed';
  end if;

  if p_date is null then
    raise exception 'date is required';
  end if;

  v_week_start := p_date - (extract(isodow from p_date)::integer - 1);

  if not exists (
    select 1
    from public.uber_week_plan_days
    where owner_id = v_owner_id
      and week_start = v_week_start
      and date = p_date
      and is_working
  ) then
    raise exception 'Only a planned working day can be marked missed';
  end if;

  select status
  into v_existing_status
  from public.uber_day_records
  where owner_id = v_owner_id and date = p_date;

  if found and v_existing_status <> 'missed' then
    raise exception 'A recorded working or completed day cannot be overwritten as missed';
  end if;

  insert into public.uber_day_records (
    owner_id,
    date,
    gross_earnings,
    business_miles,
    trips,
    status
  )
  values (v_owner_id, p_date, 0, 0, 0, 'missed')
  on conflict (owner_id, date) do update
  set
    gross_earnings = 0,
    business_miles = 0,
    trips = 0,
    status = 'missed'
  returning * into v_record;

  return v_record;
end;
$$;

revoke all on function public.create_uber_week_plan(date, numeric, boolean[]) from public;
revoke all on function public.set_uber_weekly_target(date, numeric) from public;
revoke all on function public.set_uber_week_plan_day(date, date, boolean) from public;
revoke all on function public.upsert_uber_day_record(date, numeric, numeric, integer, public.uber_day_status) from public;
revoke all on function public.mark_uber_day_missed(date) from public;

grant execute on function public.create_uber_week_plan(date, numeric, boolean[]) to authenticated;
grant execute on function public.set_uber_weekly_target(date, numeric) to authenticated;
grant execute on function public.set_uber_week_plan_day(date, date, boolean) to authenticated;
grant execute on function public.upsert_uber_day_record(date, numeric, numeric, integer, public.uber_day_status) to authenticated;
grant execute on function public.mark_uber_day_missed(date) to authenticated;
