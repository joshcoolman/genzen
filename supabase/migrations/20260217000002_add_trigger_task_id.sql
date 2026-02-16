-- Add task_id column for Trigger.dev task tracking
-- Non-breaking change: keeps request_id for rollback safety

ALTER TABLE public.user_images
ADD COLUMN task_id text DEFAULT NULL;

-- Index for efficient task_id lookups
CREATE INDEX idx_user_images_task_id
ON public.user_images (task_id)
WHERE task_id IS NOT NULL;

-- Document the column purpose
COMMENT ON COLUMN public.user_images.task_id IS
  'Trigger.dev task ID for async generation tracking. NULL for webhook-based generations.';
