-- #505: arrange the images in a group by hand.
--
-- A group has only ever rendered in the order its members were made, which is
-- fine for a working pile and wrong for a set that is meant to be read in a
-- sequence -- a run of establishing shots, two related takes side by side.
--
-- **Not `sort_order`.** That column already exists on user_images and looks
-- like the obvious home for this, but it is the *library's* order, and a group
-- card sorts among the top-level thumbnails on its newest member's
-- `sort_order` (#324). Writing an arrangement into it would silently move the
-- group card around the top-level grid every time you rearranged the inside of
-- the group. Two orderings, two columns.
--
-- Nullable, and nulls sort last. That is the whole of "a new image is appended
-- to the end": nothing has to be written on any of the three paths that put a
-- row into a group -- the generate path, the upload path, and
-- `addImagesToGroup` -- and a group that has never been arranged has every
-- position null, which is the chronological order it already had. The next
-- drag gives everything a position, new arrivals included.
alter table user_images
  add column group_position integer;

comment on column user_images.group_position is
  'Hand-set position within group_id, ascending, nulls last (#505). Independent of sort_order, which is the library''s order and drives where the group card sits at top level.';

-- The read is "this group's members in their arranged order", which the
-- existing (user_id, group_id) index answers for the filter; this carries the
-- sort as well.
create index user_images_group_position_idx
  on user_images (user_id, group_id, group_position);

-- ---------------------------------------------------------------------------
-- which order is in effect
-- ---------------------------------------------------------------------------

-- Two facts, not one, and they are deliberately kept apart:
--
--   * whether an arrangement *exists* -- any member with a non-null
--     `group_position`, derived, never stored
--   * whether it is *in effect* -- this column
--
-- Collapsing them into one flag makes the way back destructive: switching a
-- group to Newest first would have to clear the positions, so the arrangement
-- you spent time on is gone the first time you glance at it chronologically.
-- Kept apart, the toggle is free in both directions and the arrangement
-- survives being looked away from.
--
-- Set implicitly by the first drag rather than by a mode you turn on first.
-- Dragging a card *is* the statement -- the same reasoning #284 used to refuse
-- a select-mode toggle: asking for an intention to be declared before you can
-- touch the picture you are looking at is the friction.
alter table image_groups
  add column manual_order boolean not null default false;

comment on column image_groups.manual_order is
  'Whether this group renders in its hand-set order (#505). Set by the first drag. Turning it off keeps every group_position, so the arrangement comes back.';
