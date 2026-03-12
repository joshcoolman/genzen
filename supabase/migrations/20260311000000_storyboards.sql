-- Storyboard table: stores story prompt + scenes as JSONB document
create table public.storyboards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  title text not null default 'Untitled',
  story_prompt text not null,
  refined_story text,
  scenes jsonb not null default '[]',
  status text not null default 'draft'
    check (status in ('draft', 'scenes_generated', 'generating_frames', 'complete')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS: users manage own storyboards
alter table public.storyboards enable row level security;

create policy "Users can view own storyboards"
  on public.storyboards for select
  using (auth.uid() = user_id);

create policy "Users can insert own storyboards"
  on public.storyboards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own storyboards"
  on public.storyboards for update
  using (auth.uid() = user_id);

create policy "Users can delete own storyboards"
  on public.storyboards for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.update_storyboard_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger storyboards_updated_at
  before update on public.storyboards
  for each row
  execute function public.update_storyboard_updated_at();
