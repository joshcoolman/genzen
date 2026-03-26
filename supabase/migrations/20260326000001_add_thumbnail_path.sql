-- Add thumbnail_path column to store pre-generated 400px WebP thumbnails.
-- Eliminates on-the-fly Supabase Storage Image Transformations entirely.
ALTER TABLE user_images ADD COLUMN IF NOT EXISTS thumbnail_path text;
