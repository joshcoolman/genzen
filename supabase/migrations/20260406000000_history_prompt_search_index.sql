-- GIN trigram index on generation_metadata prompt for history search
-- pg_trgm extension already enabled (used by existing title/description index)
create index idx_user_images_gen_prompt_trgm
  on public.user_images
  using gin ((generation_metadata->>'prompt') gin_trgm_ops);
