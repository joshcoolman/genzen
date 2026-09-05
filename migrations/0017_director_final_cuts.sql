create table director_final_cuts (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid not null,
  export_id uuid not null references director_exports(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'failed', 'complete', 'cancelled')),
  stage text not null default 'Queued',
  error text,
  work jsonb not null default '{}',
  output jsonb,
  lease_id uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, user_id) references director_sessions(id, user_id) on delete cascade
);
create unique index director_final_cuts_active on director_final_cuts(user_id)
  where status in ('queued', 'running');
create index director_final_cuts_export on director_final_cuts(user_id, session_id, export_id, created_at);
alter table director_media add column final_cut_id uuid references director_final_cuts(id) on delete cascade;
create index director_media_final_cut on director_media(user_id, final_cut_id);
