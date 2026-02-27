-- Drop legacy boilerplate tables and storage buckets that are never used by the application.
-- counts: initial Supabase template boilerplate
-- todos: initial Supabase template boilerplate
-- images: old gallery table, superseded by user_images

-- Drop tables (CASCADE removes associated constraints, indexes, triggers, and RLS policies)
DROP TABLE IF EXISTS "public"."counts" CASCADE;
DROP TABLE IF EXISTS "public"."todos" CASCADE;
DROP TABLE IF EXISTS "public"."images" CASCADE;

-- NOTE: Legacy storage buckets (gallery-images, image-tool) must be deleted via the Supabase
-- Storage API or dashboard — direct SQL writes to storage.objects are not permitted.
