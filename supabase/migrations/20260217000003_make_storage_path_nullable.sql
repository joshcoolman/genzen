-- Make storage_path nullable to support pending AI generations
-- Pending images don't have a storage_path until generation completes

ALTER TABLE public.user_images
ALTER COLUMN storage_path DROP NOT NULL;

COMMENT ON COLUMN public.user_images.storage_path IS
  'Storage path in Supabase Storage. NULL for pending AI generations.';
