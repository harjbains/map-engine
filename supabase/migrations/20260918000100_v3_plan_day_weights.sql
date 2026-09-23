-- V3 plan-day weighting. Existing rows retain their plan and actuals;
-- all previously working days become NORMAL, preserving the old equal split.
create type public.uber_plan_day_weight as enum ('light', 'normal', 'heavy');

alter table public.uber_week_plan_days
  add column work_weight public.uber_plan_day_weight not null default 'normal';

-- OFF is represented only by is_working=false. Keeping the last selected
-- weight on an OFF row makes toggling it back on predictable.
create function public.set_uber_week_plan_day_weight(
  p_week_start date,
  p_date date,
  p_is_working boolean,
  p_work_weight public.uber_plan_day_weight
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
  if p_is_working is null or p_work_weight is null then
    raise exception 'Working state and weight are required';
  end if;

  update public.uber_week_plan_days
  set is_working = p_is_working, work_weight = p_work_weight
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

revoke all on function public.set_uber_week_plan_day_weight(date, date, boolean, public.uber_plan_day_weight) from public;
grant execute on function public.set_uber_week_plan_day_weight(date, date, boolean, public.uber_plan_day_weight) to authenticated;

-- Save all seven day states atomically. NULL means OFF; otherwise the enum
-- value is the planned weight. Historical actuals are never touched.
create function public.set_uber_week_plan_weights(
  p_week_start date,
  p_weights public.uber_plan_day_weight[]
)
returns setof public.uber_week_plan_days
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_updated integer;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required to update a week plan';
  end if;
  if coalesce(array_ndims(p_weights), 0) <> 1
     or coalesce(array_length(p_weights, 1), 0) <> 7
     or coalesce(array_lower(p_weights, 1), 0) <> 1 then
    raise exception 'weights must contain exactly seven Monday-Sunday values';
  end if;

  update public.uber_week_plan_days as day
  set is_working = p_weights[(day.date - p_week_start) + 1] is not null,
      work_weight = coalesce(p_weights[(day.date - p_week_start) + 1], day.work_weight)
  where day.owner_id = v_owner_id and day.week_start = p_week_start;

  get diagnostics v_updated = row_count;
  if v_updated <> 7 then
    raise exception 'Complete seven-day week plan not found';
  end if;

  return query
    select day.* from public.uber_week_plan_days as day
    where day.owner_id = v_owner_id and day.week_start = p_week_start
    order by day.date;
end;
$$;

revoke all on function public.set_uber_week_plan_weights(date, public.uber_plan_day_weight[]) from public;
grant execute on function public.set_uber_week_plan_weights(date, public.uber_plan_day_weight[]) to authenticated;
