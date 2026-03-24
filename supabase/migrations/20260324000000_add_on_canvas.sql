-- Track whether an image is currently placed on the canvas.
-- Used by trash to prevent permanent deletion of images still visible on canvas.
ALTER TABLE user_images ADD COLUMN on_canvas boolean NOT NULL DEFAULT false;

CREATE INDEX idx_user_images_on_canvas ON user_images (user_id)
  WHERE on_canvas = true;
