-- Migration: 20260923000100_v3_sessions
-- Description: Adds session tracking to Map-Engine V3.

CREATE TYPE uber_session_status AS ENUM ('active', 'paused', 'completed');

CREATE TABLE public.uber_sessions (
    owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    status uber_session_status NOT NULL DEFAULT 'active',
    last_resumed_at timestamp with time zone NOT NULL DEFAULT now(),
    active_seconds integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, date)
);

ALTER TABLE public.uber_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sessions" 
    ON public.uber_sessions FOR ALL 
    USING (auth.uid() = owner_id);

-- Trigger to update updated_at
CREATE TRIGGER update_uber_sessions_updated_at
    BEFORE UPDATE ON public.uber_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RPC: Get Session
CREATE OR REPLACE FUNCTION get_uber_session(p_date date)
RETURNS TABLE (
    owner_id uuid,
    date date,
    status uber_session_status,
    last_resumed_at timestamp with time zone,
    active_seconds integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT owner_id, date, status, last_resumed_at, active_seconds, created_at, updated_at
    FROM public.uber_sessions
    WHERE owner_id = auth.uid() AND date = p_date;
$$;

-- RPC: Start Session
CREATE OR REPLACE FUNCTION start_uber_session(p_date date)
RETURNS public.uber_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.uber_sessions;
BEGIN
    INSERT INTO public.uber_sessions (owner_id, date, status, last_resumed_at, active_seconds)
    VALUES (auth.uid(), p_date, 'active', now(), 0)
    ON CONFLICT (owner_id, date) DO UPDATE 
    SET status = 'active', 
        last_resumed_at = now(),
        updated_at = now()
    WHERE public.uber_sessions.status != 'active'
    RETURNING * INTO v_row;
    
    RETURN v_row;
END;
$$;

-- RPC: Pause Session
CREATE OR REPLACE FUNCTION pause_uber_session(p_date date)
RETURNS public.uber_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.uber_sessions;
BEGIN
    UPDATE public.uber_sessions
    SET active_seconds = active_seconds + EXTRACT(EPOCH FROM (now() - last_resumed_at))::integer,
        status = 'paused',
        updated_at = now()
    WHERE owner_id = auth.uid() AND date = p_date AND status = 'active'
    RETURNING * INTO v_row;

    -- If no row was updated (maybe it was already paused), just return it
    IF v_row IS NULL THEN
        SELECT * INTO v_row FROM public.uber_sessions WHERE owner_id = auth.uid() AND date = p_date;
    END IF;

    RETURN v_row;
END;
$$;

-- RPC: Resume Session
CREATE OR REPLACE FUNCTION resume_uber_session(p_date date)
RETURNS public.uber_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.uber_sessions;
BEGIN
    UPDATE public.uber_sessions
    SET status = 'active',
        last_resumed_at = now(),
        updated_at = now()
    WHERE owner_id = auth.uid() AND date = p_date AND status = 'paused'
    RETURNING * INTO v_row;

    IF v_row IS NULL THEN
        SELECT * INTO v_row FROM public.uber_sessions WHERE owner_id = auth.uid() AND date = p_date;
    END IF;

    RETURN v_row;
END;
$$;

-- RPC: End Session
CREATE OR REPLACE FUNCTION end_uber_session(p_date date)
RETURNS public.uber_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.uber_sessions;
BEGIN
    UPDATE public.uber_sessions
    SET active_seconds = CASE 
            WHEN status = 'active' THEN active_seconds + EXTRACT(EPOCH FROM (now() - last_resumed_at))::integer 
            ELSE active_seconds 
        END,
        status = 'completed',
        updated_at = now()
    WHERE owner_id = auth.uid() AND date = p_date AND status != 'completed'
    RETURNING * INTO v_row;

    IF v_row IS NULL THEN
        SELECT * INTO v_row FROM public.uber_sessions WHERE owner_id = auth.uid() AND date = p_date;
    END IF;

    RETURN v_row;
END;
$$;
