-- Allow video/mp4 in user_images table and storage bucket
-- The original schema restricted mime_type to image/* only.
-- Video generation requires storing mp4 files in the same bucket/table.

-- 1. Drop the image-only check constraint
ALTER TABLE "public"."user_images"
  DROP CONSTRAINT IF EXISTS "user_images_mime_type_check";

-- 2. Add a new constraint that also allows video/mp4
ALTER TABLE "public"."user_images"
  ADD CONSTRAINT "user_images_mime_type_check"
  CHECK (
    mime_type = ANY (ARRAY[
      'image/jpeg'::text,
      'image/png'::text,
      'image/webp'::text,
      'image/gif'::text,
      'video/mp4'::text
    ])
  );

-- 3. Update the storage bucket to allow video/mp4 uploads
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4'
]
WHERE id = 'user-images';
