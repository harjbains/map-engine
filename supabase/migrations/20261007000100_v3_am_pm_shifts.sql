-- Migration: 20261007000100_v3_am_pm_shifts
-- Description: Adds AM/PM shift tracking to week plans and shifts

-- 1. Add AM/PM targets to week plan days
ALTER TABLE public.uber_week_plan_days
  ADD COLUMN am_target_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN pm_target_pence integer NOT NULL DEFAULT 0;

-- 2. Add shift identity to shifts table
-- Allowed values: 'am', 'pm' (NULL for historical legacy shifts)
ALTER TABLE public.uber_shifts
  ADD COLUMN shift_type text CHECK (shift_type IN ('am', 'pm'));

-- 3. Update the RPC to set AM/PM targets instead of weights
CREATE FUNCTION public.set_uber_week_plan_am_pm_targets(
  p_week_start date,
  p_am_targets integer[],
  p_pm_targets integer[]
)
RETURNS SETOF public.uber_week_plan_days
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to update a week plan';
  END IF;
  
  IF coalesce(array_ndims(p_am_targets), 0) <> 1 OR coalesce(array_length(p_am_targets, 1), 0) <> 7 THEN
    RAISE EXCEPTION 'p_am_targets must contain exactly seven Monday-Sunday values';
  END IF;
  
  IF coalesce(array_ndims(p_pm_targets), 0) <> 1 OR coalesce(array_length(p_pm_targets, 1), 0) <> 7 THEN
    RAISE EXCEPTION 'p_pm_targets must contain exactly seven Monday-Sunday values';
  END IF;

  UPDATE public.uber_week_plan_days AS day
  SET am_target_pence = p_am_targets[(day.date - p_week_start) + 1],
      pm_target_pence = p_pm_targets[(day.date - p_week_start) + 1],
      is_working = (p_am_targets[(day.date - p_week_start) + 1] > 0 OR p_pm_targets[(day.date - p_week_start) + 1] > 0)
  WHERE day.owner_id = v_owner_id AND day.week_start = p_week_start;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 7 THEN
    RAISE EXCEPTION 'Complete seven-day week plan not found';
  END IF;

  RETURN QUERY
    SELECT day.* FROM public.uber_week_plan_days AS day
    WHERE day.owner_id = v_owner_id AND day.week_start = p_week_start
    ORDER BY day.date;
END;
$$;

REVOKE ALL ON FUNCTION public.set_uber_week_plan_am_pm_targets(date, integer[], integer[]) FROM public;
GRANT EXECUTE ON FUNCTION public.set_uber_week_plan_am_pm_targets(date, integer[], integer[]) TO authenticated;
