-- Edits (#726): a named, versioned cut of library clips with in and out points.
--
-- The same columns as `director_sessions` and its own table, because the two
-- surfaces are independent: Director arranges whole clips it made itself, an
-- edit trims clips off the Video wall. `cut` is
-- `{ version: 1, clips: [{ id, in, out }] }` -- ids and seconds, nothing else.
-- Everything about a clip is read off its `user_images` row as it is now.
create table edits (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  revision integer not null default 0,
  cut jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index edits_owner_idx on edits(user_id, updated_at desc);

-- An exported edit is an ordinary video row on the Video wall, and says where
-- it came from.
alter table user_images drop constraint user_images_origin_check;
alter table user_images add constraint user_images_origin_check
  check (origin in ('upload', 'images', 'canvas', 'director', 'edit'));
