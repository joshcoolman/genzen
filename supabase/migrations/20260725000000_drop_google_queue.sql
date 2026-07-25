-- Drop the Google/Vertex app queue.
--
-- Nano Banana 2 was the only model that ever carried `provider: 'google'`, and
-- it now routes through FAL like everything else. That left the whole
-- Google generation path unreachable: the dispatcher, the stale-record reset,
-- and the 'queued'/'processing' statuses those two functions moved rows between.
-- FAL is the only image provider now.

DROP FUNCTION IF EXISTS dispatch_google_queue(INT);
DROP FUNCTION IF EXISTS reset_stale_google_processing(INT);

-- Any row still parked in a Google-only status can never be dispatched again.
-- Fail it explicitly rather than leaving it spinning forever.
UPDATE public.user_images
SET status = 'failed', updated_at = NOW()
WHERE status IN ('queued', 'processing');

ALTER TABLE public.user_images
  DROP CONSTRAINT IF EXISTS user_images_status_check;

ALTER TABLE public.user_images
  ADD CONSTRAINT user_images_status_check
  CHECK (status IN ('pending', 'completed', 'failed'));

COMMENT ON COLUMN public.user_images.status IS
  'Generation status: pending (in the FAL queue), completed, failed';
