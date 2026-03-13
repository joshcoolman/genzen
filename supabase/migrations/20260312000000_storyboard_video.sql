-- Add video_record_id to storyboards table
ALTER TABLE storyboards ADD COLUMN video_record_id uuid REFERENCES user_images(id);
