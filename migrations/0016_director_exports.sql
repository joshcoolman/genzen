create table director_exports (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid not null,
  name text not null check (length(name) between 1 and 120),
  media_id uuid not null unique references director_media(id),
  thumbnail_id uuid not null unique references director_media(id),
  end_frame_id uuid not null unique references director_media(id),
  duration double precision not null check (duration > 0),
  source jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references director_sessions(id, user_id) on delete cascade
);
create index director_exports_session on director_exports(user_id, session_id, created_at desc);
