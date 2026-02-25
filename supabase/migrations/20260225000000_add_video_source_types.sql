-- Add video source types to user_images table
-- Supports storing video frames and generated videos in the video workflow

ALTER TABLE public.user_images
DROP CONSTRAINT user_images_source_check;

ALTER TABLE public.user_images
ADD CONSTRAINT user_images_source_check
CHECK (source IN ('upload', 'ai_generated', 'ai_video_frame', 'ai_video'));

COMMENT ON COLUMN public.user_images.source IS
  'Image source: upload (user-uploaded), ai_generated (AI image generation), ai_video_frame (frame from video workflow), ai_video (generated video)';
