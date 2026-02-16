-- Add async generation fields to user_images table
-- Supports async AI image generation with FAL queue + webhooks

-- Request ID from FAL queue
ALTER TABLE public.user_images
ADD COLUMN request_id text DEFAULT NULL;

-- Generation status: pending, processing, completed, failed
ALTER TABLE public.user_images
ADD COLUMN status text NOT NULL DEFAULT 'completed'
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Error message for failed generations
ALTER TABLE public.user_images
ADD COLUMN generation_error text DEFAULT NULL;

-- Index for efficiently querying user's images by status
CREATE INDEX idx_user_images_user_status_created
ON public.user_images (user_id, status, created_at DESC);

-- Index for webhook lookups by request_id
CREATE INDEX idx_user_images_request_id
ON public.user_images (request_id)
WHERE request_id IS NOT NULL;

COMMENT ON COLUMN public.user_images.request_id IS
  'FAL queue request ID for async generation tracking. NULL for completed/uploaded images.';

COMMENT ON COLUMN public.user_images.status IS
  'Generation status: pending (queued), processing (in progress), completed (done), failed (error)';

COMMENT ON COLUMN public.user_images.generation_error IS
  'Error message if generation failed. NULL for successful generations.';

-- Enable Realtime for user_images table
ALTER PUBLICATION supabase_realtime ADD TABLE user_images;
