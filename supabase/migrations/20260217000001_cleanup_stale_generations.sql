-- Cleanup function for stale AI image generations
-- Marks pending/processing generations as failed after 10 minutes

CREATE OR REPLACE FUNCTION cleanup_stale_generations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_images
  SET
    status = 'failed',
    generation_error = 'Generation timed out after 10 minutes'
  WHERE status IN ('pending', 'processing')
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$;

COMMENT ON FUNCTION cleanup_stale_generations IS
  'Marks stale AI generations (pending/processing >10min) as failed. Run via cron every 5 minutes.';

-- Schedule cleanup job to run every 5 minutes
-- Note: pg_cron must be enabled in Supabase dashboard (Database > Extensions)
SELECT cron.schedule(
  'cleanup-stale-generations',  -- job name
  '*/5 * * * *',                 -- every 5 minutes
  $$SELECT cleanup_stale_generations();$$
);
