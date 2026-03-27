-- User prompts: personal prompt library with seeded defaults
create table public.user_prompts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  title text not null,
  content text not null,
  is_default boolean default false not null,
  default_key text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS: users manage own prompts
alter table public.user_prompts enable row level security;

create policy "Users can view own prompts"
  on public.user_prompts for select
  using (auth.uid() = user_id);

create policy "Users can insert own prompts"
  on public.user_prompts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own prompts"
  on public.user_prompts for update
  using (auth.uid() = user_id);

create policy "Users can delete own prompts"
  on public.user_prompts for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.update_user_prompt_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_prompts_updated_at
  before update on public.user_prompts
  for each row
  execute function public.update_user_prompt_updated_at();
