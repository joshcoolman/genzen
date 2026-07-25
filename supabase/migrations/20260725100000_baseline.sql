-- Baseline schema.
--
-- This replaces 45 incremental migrations dating from the project's first commit.
-- A large share of them created things that later migrations dropped -- Stripe,
-- credits, a waitlist, rate limiting, a Google generation queue, notes, prompt
-- studio sets, storyboards, user prompts, user preferences, API keys, Trigger.dev
-- task ids -- so replaying that chain meant building a schema in order to tear
-- most of it back down. What survived is below, and it is small: three tables.
--
-- Generated from the live local database (pg_dump --schema-only), not by merging
-- the files by hand, so it is the schema as it actually is rather than as the
-- migrations claim.
--
-- Deliberately NOT carried over, because nothing references them: the trigger
-- functions of dropped tables (update_note_updated_at,
-- update_prompt_studio_set_updated_at, update_storyboard_updated_at,
-- update_user_prompt_updated_at, handle_user_preferences_updated_at,
-- update_updated_at_column) and get_duplicate_images(), an RPC with no caller in
-- the app.
--
-- What the dropped history said, worth keeping: user_images rows are reserved
-- before any fallible generation work, which is why almost every column is
-- nullable -- a pending row has no storage_path, size, or hash yet. The status
-- check constraint is the contract behind that (pending -> completed | failed).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- pg_trgm lives in public because the trigram GIN indexes below reference
-- public.gin_trgm_ops.
create extension if not exists pg_trgm with schema public;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.handle_updated_at() returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Mirrors a new auth.users row into user_profiles. SECURITY DEFINER because it
-- runs as the auth system, not as the signing-up user.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

-- Called by pg_cron every 5 minutes (see the bottom of this file). Not called
-- from app code -- FAL reconciliation is on-demand polling; this only catches
-- generations that were abandoned entirely.
create or replace function public.cleanup_stale_generations() returns void
  language plpgsql security definer
as $$
begin
  update public.user_images
  set
    status = 'failed',
    generation_error = 'Generation timed out after 10 minutes'
  where status in ('pending', 'processing')
    and created_at < now() - interval '10 minutes';
end;
$$;

comment on function public.cleanup_stale_generations() is
  'Marks stale AI generations (pending/processing >10min) as failed. Run via cron every 5 minutes.';

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile" on public.user_profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- user_images -- every generated or uploaded asset
-- ---------------------------------------------------------------------------

create table if not exists public.user_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null,
  description text,

  -- Storage. Null until the asset actually lands; a pending generation has a
  -- row before it has a file.
  storage_path text unique,
  thumbnail_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  file_hash text,
  width integer,
  height integer,

  -- Generation. source distinguishes an upload from model output.
  source text not null default 'upload',
  generation_metadata jsonb,
  request_id text,
  status text not null default 'completed',
  generation_error text,
  idempotency_key text,

  -- Presentation and lifecycle.
  color_palette jsonb,
  sort_order double precision,
  hidden boolean not null default false,
  on_canvas boolean not null default false,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_images_title_check
    check (char_length(title) >= 1 and char_length(title) <= 200),
  constraint user_images_description_check
    check (char_length(description) <= 1000),
  constraint user_images_file_size_check
    check (file_size is null or file_size > 0),
  constraint user_images_mime_type_check
    check (mime_type = any (array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'
    ])),
  constraint user_images_source_check
    check (source = any (array[
      'upload', 'ai_generated', 'ai_video_frame', 'ai_video'
    ])),
  constraint user_images_status_check
    check (status = any (array['pending', 'completed', 'failed']))
);

comment on column public.user_images.storage_path is
  'Storage path in the S3 bucket. NULL for pending AI generations.';
comment on column public.user_images.file_name is
  'File name in storage. NULL for pending AI generations.';
comment on column public.user_images.file_size is
  'File size in bytes. NULL for pending AI generations.';
comment on column public.user_images.mime_type is
  'MIME type of the image. NULL for pending AI generations.';
comment on column public.user_images.file_hash is
  'SHA-256 hash of the file. NULL for pending AI generations.';
comment on column public.user_images.color_palette is
  'Auto-generated color palette with vibrant/muted colors, hex/rgb values, and CSS variables.';
comment on column public.user_images.source is
  'Image source: upload (user-uploaded), ai_generated (AI image generation), ai_video_frame (frame from video workflow), ai_video (generated video)';
comment on column public.user_images.generation_metadata is
  'AI generation metadata: prompt, model, seed, timings, elapsed. NULL for uploaded images.';
comment on column public.user_images.request_id is
  'FAL queue request ID for async generation tracking. NULL for completed/uploaded images.';
comment on column public.user_images.status is
  'Generation status: pending (in the FAL queue), completed, failed';
comment on column public.user_images.generation_error is
  'Error message if generation failed. NULL for successful generations.';

create trigger set_updated_at
  before update on public.user_images
  for each row execute function public.handle_updated_at();

alter table public.user_images enable row level security;

create policy "Users can view own images" on public.user_images
  for select using ((select auth.uid()) = user_id);

create policy "Users can insert own images" on public.user_images
  for insert with check ((select auth.uid()) = user_id);

create policy "Users can update own images" on public.user_images
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own images" on public.user_images
  for delete using ((select auth.uid()) = user_id);

-- Indexes. The partial ones exist because the filtered subsets are small
-- relative to the table (canvas placements, hidden, trashed, in-flight).
create index idx_user_images_user_id on public.user_images using btree (user_id);
create index idx_user_images_user_created on public.user_images using btree (user_id, created_at desc);
create index idx_user_images_user_status_created on public.user_images using btree (user_id, status, created_at desc);
create index idx_user_images_source on public.user_images using btree (user_id, source, created_at desc);
create index idx_user_images_user_hash on public.user_images using btree (user_id, file_hash);
create index idx_user_images_sort_order on public.user_images using btree (user_id, sort_order desc nulls last);
create index idx_user_images_on_canvas on public.user_images using btree (user_id) where (on_canvas = true);
create index idx_user_images_hidden on public.user_images using btree (user_id) where (hidden = true);
create index idx_user_images_deleted_at on public.user_images using btree (user_id, deleted_at) where (deleted_at is not null);
create index idx_user_images_request_id on public.user_images using btree (request_id) where (request_id is not null);
create index idx_user_images_has_palette on public.user_images using btree ((color_palette is not null));

-- Trigram search over title/description and over the generation prompt.
create index idx_user_images_search on public.user_images
  using gin (((title || ' ' || coalesce(description, ''))) public.gin_trgm_ops);
create index idx_user_images_gen_prompt_trgm on public.user_images
  using gin (((generation_metadata ->> 'prompt')) public.gin_trgm_ops);

-- Guards double-submits of the same generation request.
create unique index user_images_idempotency_key_idx on public.user_images
  using btree (idempotency_key) where (idempotency_key is not null);

-- ---------------------------------------------------------------------------
-- fal_price_cache -- FAL per-endpoint pricing, refreshed from their API
-- ---------------------------------------------------------------------------

create table if not exists public.fal_price_cache (
  endpoint_id text primary key,
  unit_price numeric(10, 6) not null,
  unit text not null,
  currency text not null default 'USD',
  fetched_at timestamptz not null default now()
);

alter table public.fal_price_cache enable row level security;

-- Pricing is not user data; every signed-in user reads the same rows. Writes are
-- server-side only, via the service role, which bypasses RLS.
create policy fal_price_cache_select on public.fal_price_cache
  for select using (true);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Load-bearing, and easy to lose: this baseline was generated with
-- `pg_dump --no-privileges`, which strips every GRANT. Without these, PostgREST
-- connects as `authenticator`, switches to `anon`/`authenticated`, and every
-- query fails with `permission denied for table user_images` -- RLS policies do
-- not grant access, they only narrow access already granted.
--
-- The old migration chain spent ~500 lines on this, most of it granting pg_trgm
-- operator functions to four roles. Only the tables actually need it.

grant usage on schema public to anon, authenticated, service_role;

-- Explicit, because ALTER DEFAULT PRIVILEGES below only applies to tables
-- created *after* it runs -- the three above already exist by this point.
grant all on table public.user_images to anon, authenticated, service_role;
grant all on table public.user_profiles to anon, authenticated, service_role;
grant all on table public.fal_price_cache to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth trigger
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Scheduled jobs
-- ---------------------------------------------------------------------------

-- pg_cron is a Supabase-provided extension. #168 moves this app to plain
-- Postgres, where it will not be available -- this job needs to become an
-- application-level interval or be dropped in favour of on-demand reconciliation.
create extension if not exists pg_cron;

select cron.unschedule('cleanup-stale-generations')
where exists (select 1 from cron.job where jobname = 'cleanup-stale-generations');

select cron.schedule(
  'cleanup-stale-generations',
  '*/5 * * * *',
  $$select public.cleanup_stale_generations();$$
);
