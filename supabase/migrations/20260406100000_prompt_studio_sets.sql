-- Prompt Studio sets: saved prompt configurations for A/B testing
create table public.prompt_studio_sets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  name text not null,
  prompt text not null default '',
  system_prompt text not null default '',
  negative_prompt text not null default '',
  selected_model_ids text[] default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS: users manage own sets
alter table public.prompt_studio_sets enable row level security;

create policy "Users can view own sets"
  on public.prompt_studio_sets for select
  using (auth.uid() = user_id);

create policy "Users can insert own sets"
  on public.prompt_studio_sets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sets"
  on public.prompt_studio_sets for update
  using (auth.uid() = user_id);

create policy "Users can delete own sets"
  on public.prompt_studio_sets for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.update_prompt_studio_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger prompt_studio_sets_updated_at
  before update on public.prompt_studio_sets
  for each row
  execute function public.update_prompt_studio_set_updated_at();
