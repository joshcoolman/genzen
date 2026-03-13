-- Style Collections: curated image collections for reference-based generation

-- Style collections table
create table style_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  thumbnail_path text,
  image_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Style images table
create table style_images (
  id uuid primary key default gen_random_uuid(),
  style_id uuid references style_collections on delete cascade not null,
  storage_path text not null,
  width int,
  height int,
  sort_order int default 0,
  source text not null, -- 'library' | 'upload' | 'url'
  created_at timestamptz default now()
);

-- RLS for style_collections
alter table style_collections enable row level security;

create policy "Users can view own style collections"
  on style_collections for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own style collections"
  on style_collections for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own style collections"
  on style_collections for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own style collections"
  on style_collections for delete
  using ((select auth.uid()) = user_id);

-- RLS for style_images (user access via join to style_collections)
alter table style_images enable row level security;

create policy "Users can view own style images"
  on style_images for select
  using (exists (
    select 1 from style_collections
    where style_collections.id = style_images.style_id
    and style_collections.user_id = (select auth.uid())
  ));

create policy "Users can insert own style images"
  on style_images for insert
  with check (exists (
    select 1 from style_collections
    where style_collections.id = style_images.style_id
    and style_collections.user_id = (select auth.uid())
  ));

create policy "Users can delete own style images"
  on style_images for delete
  using (exists (
    select 1 from style_collections
    where style_collections.id = style_images.style_id
    and style_collections.user_id = (select auth.uid())
  ));

-- Storage bucket for style images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'styles',
  'styles',
  false,
  52428800, -- 50MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- Storage policies for styles bucket
create policy "Users can upload style images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'styles'
    and (storage.foldername(name))[1] = ((select auth.uid())::text)
  );

create policy "Users can view own style images storage"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'styles'
    and (storage.foldername(name))[1] = ((select auth.uid())::text)
  );

create policy "Users can delete own style images storage"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'styles'
    and (storage.foldername(name))[1] = ((select auth.uid())::text)
  );

-- Index for fast lookups
create index idx_style_collections_user_id on style_collections(user_id);
create index idx_style_images_style_id on style_images(style_id);
