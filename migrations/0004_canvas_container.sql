-- #212: a canvas is a container, not a view.
--
-- Membership was a mutable boolean on user_images (`on_canvas`) and position
-- lived in IndexedDB. Two consequences, both structural rather than incidental:
--
--   * A canvas could not *own* anything, so there was nothing to scope by and
--     nothing to address. `/canvas/:id` was unexpressible.
--   * Membership had no foreign key, so dead members had to be hunted at mount
--     (`listDeadRecordIds`) instead of being impossible. `on delete cascade`
--     makes that whole reconcile branch unreachable rather than merely handled.
--
-- The library still owns everything. `canvas_images` is membership in an
-- *arrangement* over library images, never exile: nothing exists only inside a
-- canvas, so the exhaustive "everything I have" record stays satisfiable and
-- there is exactly one place an image lives and one place it dies.
--
-- Additive only. `on_canvas` is still written and still read after this
-- migration; it is dropped in its own later migration once reads have moved.

-- ---------------------------------------------------------------------------
-- canvases
-- ---------------------------------------------------------------------------

-- One row per canvas. There is only one per user today and multiple canvases
-- are not being built yet, but `id` is the seam that makes them a feature
-- rather than a migration -- which is the entire reason this table exists
-- instead of the position columns hanging off user_images.
--
-- `transform` and `groups` are the viewport and the spatial groupings: pure
-- arrangement, read and written whole by one client, never queried into. They
-- are jsonb because a table would buy joins nobody performs. `groups` entries
-- reference image ids, and a group naming an image no longer on the canvas is
-- harmless -- the client filters on load -- which is why the absent foreign key
-- here is not the mistake `on_canvas` was.
create table canvases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,

  name text not null default 'Canvas',
  transform jsonb,
  groups jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint canvases_name_check
    check (char_length(name) >= 1 and char_length(name) <= 200)
);

comment on table canvases is
  'A spatial arrangement over library images. Owns membership rows, not images.';
comment on column canvases.transform is
  'Saved viewport {x, y, scale}. The default seed for arriving with no target; a deep link supplies its own.';
comment on column canvases.groups is
  'Spatial groupings: [{ id, imageIds, columns, padding }]. imageIds are canvas_images.image_id values; stale entries are filtered client-side.';

create index canvases_user_id_idx on canvases (user_id);

create trigger canvases_set_updated_at
  before update on canvases
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- canvas_images -- membership, with position
-- ---------------------------------------------------------------------------

-- `user_id` is denormalised from both parents on purpose. There is no RLS: every
-- query in the app carries an explicit `user_id` filter taken from
-- resolveAuth(), and that rule is worth more than the redundancy it costs --
-- without it, scoping a membership read would mean joining to `canvases` just to
-- prove ownership.
--
-- Position is nullable, and the check makes it all-or-nothing: a row is either
-- placed or unplaced, never half. Unplaced is a real and expected state -- a
-- generation's membership row is inserted server-side the moment the row is
-- reserved, before any client has decided where the card goes, which is what
-- makes a canvas generation reclaimable after navigating away. That leaves the
-- client one reconcile rule, *place what is unplaced*, in place of today's
-- reclaim / prune / dedupe.
create table canvas_images (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references canvases (id) on delete cascade,
  image_id uuid not null references user_images (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,

  x double precision,
  y double precision,
  width double precision,
  height double precision,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One card per image per canvas. Makes the mount-time dedupe undefinable
  -- rather than fixed, and makes image_id a stable canvas-local identity.
  constraint canvas_images_canvas_image_key unique (canvas_id, image_id),

  constraint canvas_images_position_check check (
    (x is null and y is null and width is null and height is null)
    or (x is not null and y is not null and width is not null and height is not null)
  ),
  constraint canvas_images_size_check check (
    (width is null and height is null) or (width > 0 and height > 0)
  )
);

comment on table canvas_images is
  'Membership of a library image in a canvas, plus where it sits. Deleting the row removes the card; the image is untouched in the library.';
comment on column canvas_images.x is
  'Canvas-space position. NULL together with y/width/height means unplaced -- the client lays it out on load.';
comment on column canvas_images.user_id is
  'Denormalised from both parents so every query can carry an explicit user_id filter (there is no RLS).';

create index canvas_images_canvas_idx on canvas_images (canvas_id);

-- "Which canvas is this image on" -- one indexed lookup, which is what makes a
-- per-card membership marker and "take me there" cheap.
create index canvas_images_user_image_idx on canvas_images (user_id, image_id);

create trigger canvas_images_set_updated_at
  before update on canvas_images
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- backfill
-- ---------------------------------------------------------------------------

-- A canvas for every user who has one image on a canvas. Users with none get
-- theirs created on demand; there is no point in a row for a canvas nobody has
-- opened.
insert into canvases (user_id, name)
select distinct user_id, 'Canvas'
from user_images
where on_canvas = true and deleted_at is null;

-- Membership rows, unplaced. Position is deliberately *not* backfilled and
-- cannot be: it only ever existed in one browser's IndexedDB, which the database
-- has never seen and no migration can reach. Every existing arrangement is
-- therefore laid out fresh on the next load -- a one-time cost, paid once, in
-- exchange for arrangement that survives a different browser and a different
-- machine from here on.
insert into canvas_images (canvas_id, image_id, user_id)
select c.id, ui.id, ui.user_id
from user_images ui
join canvases c on c.user_id = ui.user_id
where ui.on_canvas = true and ui.deleted_at is null;
