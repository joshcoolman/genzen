-- #319: groups -- a flat way to focus on images that go together.
--
-- Not a return of #204. That was `parent_id` on user_images: a *tree*, where the
-- relationship was the edit relationship, so nesting, reparenting and
-- delete-the-subtree all followed from the shape. A group is none of those. It
-- is a set with a name, unrelated to how any member was made, and an image
-- belongs to at most one.
--
-- Exclusive membership is a column, not a join table, and that is the design
-- rather than a shortcut: the top-level grid *replaces* a group's members with
-- its card, so an image in two groups would vanish from top level twice and
-- appear in two cards. "Where is this image" would stop having an answer. The
-- cost is that a picture cannot be in both Wasteland and Character Sheets;
-- moving it between them is one update.

create table image_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,

  name text not null,

  -- The cover is *chosen*, never asked for: creation picks the newest member
  -- and freezes it, and an image's own menu can override it later. Nullable
  -- because the member it points at can be trashed, and because an empty group
  -- is a legitimate starting state -- name it first, then generate into it.
  --
  -- `on delete set null` rather than a trigger: the reader falls back to the
  -- newest remaining member, so a null cover renders correctly instead of
  -- rendering a hole.
  cover_image_id uuid references user_images (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint image_groups_name_check
    check (char_length(name) >= 1 and char_length(name) <= 200)
);

comment on table image_groups is
  'A named, flat set of library images. Membership is user_images.group_id -- exclusive, so the top-level grid can replace members with the group card.';
comment on column image_groups.cover_image_id is
  'Frozen at creation (newest member), overridable per image. Null falls back to the newest remaining member -- see listImageGroups.';

create index image_groups_user_id_idx on image_groups (user_id);

create trigger image_groups_set_updated_at
  before update on image_groups
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- membership
-- ---------------------------------------------------------------------------

-- `on delete set null`: dissolving a group returns its images to top level.
-- Nothing about a group owns an image -- the library owns everything, the same
-- rule #212 wrote for canvases.
alter table user_images
  add column group_id uuid references image_groups (id) on delete set null;

comment on column user_images.group_id is
  'The one group this image sits in, or null for top level. Cleared on trash (#319): restore has a single destination.';

-- Every group read is "the members of this group, for this user", and every
-- top-level read is "everything with no group". Both are this index.
create index user_images_group_idx on user_images (user_id, group_id);
