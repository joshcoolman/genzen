-- Durable script-cut execution. Media remains in user_images.
create table director_cut_jobs (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null references director_sessions(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'failed', 'blocked', 'cancelled', 'completed')),
  data jsonb not null,
  version integer not null default 0,
  error text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index director_cut_jobs_active on director_cut_jobs(updated_at)
  where status = 'active';
create index director_cut_jobs_session on director_cut_jobs(user_id, session_id);
