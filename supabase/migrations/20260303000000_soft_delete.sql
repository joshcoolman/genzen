-- Add soft delete support to user_images
ALTER TABLE user_images ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Partial index for efficiently querying trashed items
CREATE INDEX idx_user_images_deleted_at ON user_images (user_id, deleted_at) WHERE deleted_at IS NOT NULL;
