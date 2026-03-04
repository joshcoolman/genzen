ALTER TABLE user_images ADD COLUMN hidden boolean NOT NULL DEFAULT false;
CREATE INDEX idx_user_images_hidden ON user_images (user_id) WHERE hidden = true;
