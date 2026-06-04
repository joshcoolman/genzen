-- Add 'queued' status for Google generations waiting in the app queue.
-- Lifecycle: queued → processing → completed/failed
-- ('processing' already exists in constraint but was unused)

ALTER TABLE public.user_images
  DROP CONSTRAINT IF EXISTS user_images_status_check;

ALTER TABLE public.user_images
  ADD CONSTRAINT user_images_status_check
  CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed'));

COMMENT ON COLUMN public.user_images.status IS
  'Generation status: pending (in FAL queue), queued (in Google app queue), processing (Google API in-flight), completed, failed';

-- Atomically claims up to p_max_concurrent - active slots from the Google queue.
-- Uses SELECT FOR UPDATE SKIP LOCKED so concurrent Vercel invocations never
-- double-dispatch the same record.
CREATE OR REPLACE FUNCTION dispatch_google_queue(p_max_concurrent INT DEFAULT 3)
RETURNS TABLE (id UUID, user_id UUID, generation_metadata JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_count INT;
  slots INT;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM user_images
  WHERE status = 'processing'
    AND generation_metadata->>'provider' = 'google';

  slots := GREATEST(0, p_max_concurrent - active_count);
  IF slots = 0 THEN RETURN; END IF;

  RETURN QUERY
  UPDATE user_images ui
  SET status = 'processing', updated_at = NOW()
  FROM (
    SELECT ui2.id
    FROM user_images ui2
    WHERE ui2.status = 'queued'
      AND ui2.generation_metadata->>'provider' = 'google'
    ORDER BY ui2.created_at ASC
    LIMIT slots
    FOR UPDATE SKIP LOCKED
  ) claimed
  WHERE ui.id = claimed.id
  RETURNING ui.id, ui.user_id, ui.generation_metadata;
END;
$$;

-- Resets Google records stuck in 'processing' (e.g. crashed Vercel function)
-- back to 'queued' so they are retried on the next dispatch cycle.
CREATE OR REPLACE FUNCTION reset_stale_google_processing(p_timeout_minutes INT DEFAULT 2)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reset_count INT;
BEGIN
  UPDATE user_images
  SET status = 'queued', updated_at = NOW()
  WHERE status = 'processing'
    AND generation_metadata->>'provider' = 'google'
    AND updated_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;
