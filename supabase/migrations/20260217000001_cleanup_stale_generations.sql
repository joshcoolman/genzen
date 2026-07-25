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
--
-- The pg_extension guard was added after the fact (see #167). Editing an
-- already-applied migration is normally forbidden; it is safe here because
-- Supabase tracks migrations by version and will not re-run this against a
-- database that has it recorded. The guard only affects a *fresh* local
-- `supabase db reset`, where pg_cron is absent and the bare call aborted the
-- whole reset. This is not a mistake -- leave it in place.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-stale-generations',  -- job name
      '*/5 * * * *',                 -- every 5 minutes
      $$SELECT cleanup_stale_generations();$$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed -- skipping cleanup-stale-generations schedule';
  END IF;
END
$do$;
