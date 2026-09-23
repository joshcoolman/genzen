-- News posts (#718): illustrated feed of image/video generation news.
--
-- User-scoped like everything else. `hero_image_id` references a user_images
-- row so the image is served through `/img/[id]` -- the normal path, with
-- the normal auth check. Set null on delete so losing the image does not
-- lose the post.
--
-- `run_id` groups all posts from one "Get news" press, so the feed can
-- visually separate runs or let the user undo an entire batch.
create table news_posts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references users(id) on delete cascade,
  title      text        not null,
  what_happened    text  not null,
  why_interesting  text  not null,
  the_details      text  not null,
  for_genzen       text  not null,
  hero_image_id    uuid  references user_images(id) on delete set null,
  source_links     jsonb not null default '[]'::jsonb,
  run_id     uuid        not null,
  created_at timestamptz not null default now()
);

create index news_posts_user_id_idx on news_posts (user_id);
create index news_posts_run_id_idx  on news_posts (run_id);
