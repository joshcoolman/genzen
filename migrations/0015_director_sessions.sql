-- Director owns its sessions and media; shared library queries cannot pick
-- them up merely because another generation or export was saved.
create table director_sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  revision integer not null default 0,
  cut jsonb not null,
  draft text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index director_sessions_owner_idx on director_sessions(user_id, updated_at desc);

create table director_media (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid not null,
  storage_path text not null unique,
  mime_type text not null,
  size integer not null check (size > 0),
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references director_sessions(id, user_id) on delete cascade
);
create index director_media_session_idx on director_media(user_id, session_id);

-- Keep submission identities even after Redo replaces a clip or a request is
-- dismissed. Replaying an old action must not incur another provider charge.
create table director_requests (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid not null,
  token text,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references director_sessions(id, user_id) on delete cascade
);
create index director_requests_session_idx on director_requests(user_id, session_id);
