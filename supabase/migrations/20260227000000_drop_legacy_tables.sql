-- Drop legacy boilerplate tables and storage buckets that are never used by the application.
-- counts: initial Supabase template boilerplate
-- todos: initial Supabase template boilerplate
-- images: old gallery table, superseded by user_images

-- Drop tables (CASCADE removes associated constraints, indexes, triggers, and RLS policies)
DROP TABLE IF EXISTS "public"."counts" CASCADE;
DROP TABLE IF EXISTS "public"."todos" CASCADE;
DROP TABLE IF EXISTS "public"."images" CASCADE;

-- Remove legacy storage buckets (gallery-images and image-tool are unused; user-images is the active bucket)
DELETE FROM storage.objects WHERE bucket_id IN ('gallery-images', 'image-tool');
DELETE FROM storage.buckets WHERE id IN ('gallery-images', 'image-tool');
