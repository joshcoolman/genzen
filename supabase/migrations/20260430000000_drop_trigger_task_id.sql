-- Drop orphaned task_id column added during a failed Trigger.dev integration.
-- Trigger.dev was removed from the project; this column is unused.

DROP INDEX IF EXISTS idx_user_images_task_id;
ALTER TABLE public.user_images DROP COLUMN IF EXISTS task_id;
