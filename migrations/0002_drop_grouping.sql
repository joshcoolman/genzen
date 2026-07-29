-- #204: grouping and image genealogy are gone.
--
-- Two things stored the relationships the app no longer has:
--
--   generation_metadata.parent_id  the mutable grouping parent
--   hidden                         a row kept alive, out of the gallery, purely
--                                  so its variations could render it as their
--                                  origin thumbnail
--
-- `source_image_id` and `root_image_id` stay. They are a record of how a row was
-- made, like `seed` -- nothing derives a relationship from them any more.

-- A hidden row is one the user deleted while something still pointed at it. The
-- pointing is gone, so honour the delete rather than resurfacing the image in
-- the gallery: it lands in Trash, where a delete belongs.
update user_images
set deleted_at = now(), on_canvas = false
where hidden = true and deleted_at is null;

drop index if exists user_images_hidden_idx;
alter table user_images drop column hidden;

update user_images
set generation_metadata = generation_metadata - 'parent_id'
where generation_metadata ? 'parent_id';
