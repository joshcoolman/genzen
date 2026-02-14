-- Add source and generation_metadata columns to user_images table
-- Supports saving AI-generated images alongside user uploads

-- Source column: distinguishes uploaded vs AI-generated images
ALTER TABLE public.user_images
ADD COLUMN source text NOT NULL DEFAULT 'upload'
CONSTRAINT user_images_source_check CHECK (source IN ('upload', 'ai_generated'));

-- Generation metadata: stores prompt, model, seed, timings for AI images
ALTER TABLE public.user_images
ADD COLUMN generation_metadata jsonb DEFAULT NULL;

COMMENT ON COLUMN public.user_images.source IS
  'Image source: upload (user-uploaded) or ai_generated (created via AI image generation)';

COMMENT ON COLUMN public.user_images.generation_metadata IS
  'AI generation metadata: prompt, model, seed, timings, elapsed. NULL for uploaded images.';

-- Index to efficiently filter by source
CREATE INDEX idx_user_images_source
ON public.user_images (user_id, source, created_at DESC);
