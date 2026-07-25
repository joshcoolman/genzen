-- genzen on plain Postgres.
--
-- Translated from supabase/migrations/20260725100000_baseline.sql, which was
-- itself generated from the live Supabase database. Three tables, no vendor
-- surface.
--
-- What was dropped in the translation, and why none of it is a loss:
--
--   * RLS policies. `auth.uid()` appeared nowhere outside policy predicates.
--     Ownership is enforced server-side by an explicit `user_id` filter on every
--     query -- the policies were a second, weaker copy of that rule. After this
--     migration the browser cannot reach Postgres at all, so there is no
--     untrusted caller left for a policy to guard against.
--   * GRANT / ALTER DEFAULT PRIVILEGES for anon / authenticated / service_role.
--     Those roles are a Supabase construct; one application role owns everything
--     here.
--   * The `auth` schema. `user_images.user_id` referenced `auth.users(id)` and
--     `user_profiles` mirrored it via a `handle_new_user()` trigger. Both are
--     replaced by the local `users` table below, which absorbs `display_name` --
--     `user_profiles` had zero query sites in the app, so nothing reads what the
--     trigger was writing.
--   * pg_cron. See the note on cleanup_stale_generations() at the bottom.
--   * uuid-ossp. Postgres 17 has gen_random_uuid() in core.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

-- Shaped to match ~/repos/bootsy/migrations/0004_users.sql so the auth code
-- ports across unchanged: scrypt hashes stored as `salt:hash` in password_hash,
-- verified in src/features/auth/credentials.ts.
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shared trigger function
-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_images -- every generated or uploaded asset
-- ---------------------------------------------------------------------------

-- Almost every column is nullable on purpose: a row is reserved *before* any
-- fallible work, so a click always leaves a card behind. A pending generation
-- has no storage_path, size, hash or dimensions yet. The status check is the
-- contract behind that -- pending resolves to completed or failed, never
-- disappears.
create table user_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,

  title text not null,
  description text,

  storage_path text unique,
  thumbnail_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  file_hash text,
  width integer,
  height integer,

  source text not null default 'upload',
  generation_metadata jsonb,
  request_id text,
  status text not null default 'completed',
  generation_error text,
  idempotency_key text,

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

comment on column user_images.storage_path is
  'Storage path in the S3 bucket. NULL for pending AI generations.';
comment on column user_images.file_name is
  'File name in storage. NULL for pending AI generations.';
comment on column user_images.file_size is
  'File size in bytes. NULL for pending AI generations.';
comment on column user_images.mime_type is
  'MIME type of the image. NULL for pending AI generations.';
comment on column user_images.file_hash is
  'SHA-256 hash of the file. NULL for pending AI generations.';
comment on column user_images.color_palette is
  'Auto-generated color palette with vibrant/muted colors, hex/rgb values, and CSS variables.';
comment on column user_images.source is
  'Image source: upload (user-uploaded), ai_generated (AI image generation), ai_video_frame (frame from video workflow), ai_video (generated video)';
comment on column user_images.generation_metadata is
  'AI generation metadata: prompt, model, seed, timings, elapsed. NULL for uploaded images.';
comment on column user_images.request_id is
  'FAL queue request ID for async generation tracking. NULL for completed/uploaded images.';
comment on column user_images.status is
  'Generation status: pending (in the FAL queue), completed, failed';
comment on column user_images.generation_error is
  'Error message if generation failed. NULL for successful generations.';

create trigger user_images_set_updated_at
  before update on user_images
  for each row execute function set_updated_at();

create index user_images_user_id_idx on user_images (user_id);
create index user_images_user_created_idx on user_images (user_id, created_at desc);
create index user_images_user_status_created_idx on user_images (user_id, status, created_at desc);
create index user_images_source_idx on user_images (user_id, source, created_at desc);
create index user_images_user_hash_idx on user_images (user_id, file_hash);
create index user_images_sort_order_idx on user_images (user_id, sort_order desc nulls last);

-- Partial: each filtered subset is small relative to the table.
create index user_images_on_canvas_idx on user_images (user_id) where on_canvas = true;
create index user_images_hidden_idx on user_images (user_id) where hidden = true;
create index user_images_deleted_at_idx on user_images (user_id, deleted_at) where deleted_at is not null;
create index user_images_request_id_idx on user_images (request_id) where request_id is not null;
create index user_images_has_palette_idx on user_images ((color_palette is not null));

-- Trigram search over title/description, and over the generation prompt.
create index user_images_search_idx on user_images
  using gin ((title || ' ' || coalesce(description, '')) gin_trgm_ops);
create index user_images_gen_prompt_trgm_idx on user_images
  using gin ((generation_metadata ->> 'prompt') gin_trgm_ops);

-- Guards double-submits of the same generation request.
create unique index user_images_idempotency_key_idx on user_images (idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- fal_price_cache -- FAL per-endpoint pricing, refreshed from their API
-- ---------------------------------------------------------------------------

create table fal_price_cache (
  endpoint_id text primary key,
  unit_price numeric(10, 6) not null,
  unit text not null,
  currency text not null default 'USD',
  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stale generation cleanup
-- ---------------------------------------------------------------------------

-- On Supabase this ran under pg_cron every 5 minutes. pg_cron is not available
-- on plain Postgres, so the schedule moves to the application -- the function
-- stays here because the logic is a single UPDATE and belongs next to the table
-- it repairs.
--
-- Do not delete this as unused: it has no caller in application code, and it is
-- the only thing that resolves a generation FAL never answered for at all. The
-- on-demand polling path only reconciles generations that FAL has a status for.
create function cleanup_stale_generations() returns void
  language plpgsql
as $$
begin
  update user_images
  set
    status = 'failed',
    generation_error = 'Generation timed out after 10 minutes'
  where status = 'pending'
    and created_at < now() - interval '10 minutes';
end;
$$;

comment on function cleanup_stale_generations() is
  'Marks stale AI generations (pending >10min) as failed. Scheduled by the app, not by the database.';
