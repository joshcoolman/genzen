-- Make file-related fields nullable to support pending AI generations
-- These fields are populated when generation completes

ALTER TABLE public.user_images
ALTER COLUMN file_name DROP NOT NULL,
ALTER COLUMN file_size DROP NOT NULL,
ALTER COLUMN mime_type DROP NOT NULL,
ALTER COLUMN file_hash DROP NOT NULL;

-- Update file_size constraint to allow NULL
ALTER TABLE public.user_images
DROP CONSTRAINT IF EXISTS user_images_file_size_check;

ALTER TABLE public.user_images
ADD CONSTRAINT user_images_file_size_check
CHECK (file_size IS NULL OR file_size > 0);

-- Update mime_type constraint to allow NULL
ALTER TABLE public.user_images
DROP CONSTRAINT IF EXISTS user_images_mime_type_check;

ALTER TABLE public.user_images
ADD CONSTRAINT user_images_mime_type_check
CHECK (mime_type IS NULL OR mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'image/gif'::text]));

COMMENT ON COLUMN public.user_images.file_name IS
  'File name in storage. NULL for pending AI generations.';

COMMENT ON COLUMN public.user_images.file_size IS
  'File size in bytes. NULL for pending AI generations.';

COMMENT ON COLUMN public.user_images.mime_type IS
  'MIME type of the image. NULL for pending AI generations.';

COMMENT ON COLUMN public.user_images.file_hash IS
  'SHA-256 hash of the file. NULL for pending AI generations.';
