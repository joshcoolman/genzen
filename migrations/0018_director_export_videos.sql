alter table user_images drop constraint user_images_origin_check;
alter table user_images add constraint user_images_origin_check
  check (origin in ('upload', 'images', 'canvas', 'director'));

-- Publication survives deletion of the Video row: opening Video again must
-- never resurrect an intentionally trashed or permanently deleted export.
create table director_export_videos (
  export_id uuid primary key references director_exports(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  video_id uuid not null unique,
  created_at timestamptz not null default now()
);
create index director_export_videos_owner on director_export_videos(user_id);
