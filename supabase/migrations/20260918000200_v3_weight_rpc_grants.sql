-- Supabase's default function privileges include an explicit anon grant;
-- revoking PUBLIC alone does not remove it. Restrict only the new V3 RPCs.
revoke all on function public.set_uber_week_plan_day_weight(date, date, boolean, public.uber_plan_day_weight)
  from public, anon, service_role;
revoke all on function public.set_uber_week_plan_weights(date, public.uber_plan_day_weight[])
  from public, anon, service_role;

grant execute on function public.set_uber_week_plan_day_weight(date, date, boolean, public.uber_plan_day_weight)
  to authenticated;
grant execute on function public.set_uber_week_plan_weights(date, public.uber_plan_day_weight[])
  to authenticated;
