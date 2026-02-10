-- Add color_palette column to user_images table
-- Stores auto-generated color palettes with vibrant/muted colors

ALTER TABLE public.user_images ADD COLUMN color_palette JSONB DEFAULT NULL;

COMMENT ON COLUMN public.user_images.color_palette IS
  'Auto-generated color palette with vibrant/muted colors, hex/rgb values, and CSS variables.';

-- Index to efficiently query images that have/don't have palettes
CREATE INDEX idx_user_images_has_palette
ON public.user_images ((color_palette IS NOT NULL));
