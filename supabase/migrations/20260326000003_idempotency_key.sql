-- Add idempotency_key to user_images to prevent double-charging on retries.
-- Unique constraint is partial (only applies to non-null values) to avoid
-- conflicting with the many existing rows that have no key.
ALTER TABLE user_images ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS user_images_idempotency_key_idx
  ON user_images (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
