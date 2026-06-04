-- Fix ambiguous column reference in dispatch_google_queue.
-- RETURNS TABLE puts output column names in scope as PL/pgSQL variables,
-- so 'generation_metadata' in the COUNT query was ambiguous. All references
-- are now fully qualified with table aliases.

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
  FROM user_images ui_active
  WHERE ui_active.status = 'processing'
    AND ui_active.generation_metadata->>'provider' = 'google';

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
