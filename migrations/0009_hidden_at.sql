-- #504: hiding an image without deleting it.
--
-- The only way to make an image stop cluttering a group was to trash it, so
-- reducing visual noise meant destroying work. This is the non-destructive
-- half: a hidden image is still in its group, still owned, still one click
-- from coming back -- it simply does not render.
--
-- A timestamp rather than a boolean, mirroring `deleted_at` beside it. Two
-- reasons: the column reads the same way as the one it sits next to, and
-- "most recently hidden" is a question that will be asked the first time
-- somebody unhides one of forty. A boolean cannot answer it and a second
-- column to carry the time would be the timestamp with extra steps.
--
-- Deliberately independent of `deleted_at`. Trashing does not clear this and
-- hiding does not trash: a hidden image that is later trashed is in Trash, and
-- restoring it puts it back hidden, which is where it was. Collapsing the two
-- would mean a restore silently un-hiding things nobody asked about.

alter table user_images add column hidden_at timestamptz;

-- Every gallery read filters on this, and the overwhelming majority of rows
-- are not hidden. Partial, so the index holds only the few that are.
create index user_images_hidden_at_idx
  on user_images (user_id, hidden_at desc)
  where hidden_at is not null;

comment on column user_images.hidden_at is
  'Set when the user hides an image from the grid (#504). Non-destructive and independent of deleted_at: a hidden image is still in its group and still restorable in one click.';
