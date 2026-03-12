-- Add characters JSONB column to storyboards
alter table public.storyboards
  add column characters jsonb not null default '[]';
