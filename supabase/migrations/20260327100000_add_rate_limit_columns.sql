-- Add rate limiting columns to user_profiles
-- Uses a lazy rolling window: reset count when window expires on next request

ALTER TABLE user_profiles
  ADD COLUMN rate_window_start timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN rate_window_count int NOT NULL DEFAULT 0;

-- RPC for atomic rate limit check-and-increment
-- Returns true if allowed, false if rate limited
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_max_requests int,
  p_window_seconds int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start timestamptz;
  v_count int;
BEGIN
  SELECT rate_window_start, rate_window_count
    INTO v_window_start, v_count
    FROM user_profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If window has expired, reset
  IF v_window_start + (p_window_seconds || ' seconds')::interval <= now() THEN
    UPDATE user_profiles
       SET rate_window_start = now(),
           rate_window_count = 1
     WHERE id = p_user_id;
    RETURN true;
  END IF;

  -- Window is current — check limit
  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  -- Increment
  UPDATE user_profiles
     SET rate_window_count = rate_window_count + 1
   WHERE id = p_user_id;

  RETURN true;
END;
$$;
