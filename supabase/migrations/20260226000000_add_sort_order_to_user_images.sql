ALTER TABLE public.user_images
  ADD COLUMN sort_order double precision DEFAULT NULL;

-- Seed existing rows: sort_order = unix epoch seconds of created_at
-- so default ordering is identical to current created_at DESC
UPDATE public.user_images
  SET sort_order = EXTRACT(EPOCH FROM created_at);

-- Index for fast ORDER BY sort_order DESC queries
CREATE INDEX idx_user_images_sort_order
  ON public.user_images (user_id, sort_order DESC NULLS LAST);
