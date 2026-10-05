-- Migration: 20261005000100_v3_shifts
-- Description: Adds multiple shifts per day tracking.

CREATE TABLE public.uber_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    start_timestamp timestamp with time zone NOT NULL DEFAULT now(),
    end_timestamp timestamp with time zone,
    start_earnings_pence integer NOT NULL DEFAULT 0,
    end_earnings_pence integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.uber_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own shifts" 
    ON public.uber_shifts FOR ALL 
    USING (auth.uid() = owner_id);

CREATE TRIGGER update_uber_shifts_updated_at
    BEFORE UPDATE ON public.uber_shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
