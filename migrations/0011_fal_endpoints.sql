-- #523: FAL endpoints someone has pasted in.
--
-- Exploring FAL is easy and coming back to what you found is not -- eight
-- clicks deep there is a model that worked and no way back to it. This table is
-- the address book: an endpoint someone pasted, the schema we read off it, and
-- whether we could build controls for it.
--
-- `lab/CLAUDE.md` bars a lab page from adding a migration, because a folder
-- deletes cleanly and a migration does not. Its own carve-out is the test: who
-- writes this, and does it survive deleting `lab/`? This is the table the real
-- Endpoint Explorer needs whichever surface ends up owning it -- collecting
-- endpoints is the feature, not one page's scratch state.
--
-- `schema` is the *parsed* report, not FAL's raw OpenAPI document: the fields we
-- resolved, their kinds and ranges, the output kind, and every reason we could
-- not support one. Stored rather than re-derived so the list renders without a
-- network call per row, and so a verdict can be compared against a later one
-- when the parser improves. Re-adding an endpoint overwrites it, which is how
-- you re-check one.

create table fal_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- What FAL is called with: `minimax/hailuo-2.3/pro/image-to-video`. Note the
  -- namespace is not always `fal-ai/`.
  endpoint_id text not null,
  -- What was pasted. Kept because it is the way back to the model page, which
  -- has the prose, the examples and the pricing note that the schema does not.
  source_url text not null,
  label text not null,
  schema jsonb not null,
  -- `image | video | audio`, or null when the output is something we cannot
  -- display -- which is itself a reason the endpoint is unsupported.
  output_kind text,
  supported boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per endpoint per person. Re-pasting a URL you already added is the
  -- ordinary way to re-run the parser against it, so the add upserts on this.
  unique (user_id, endpoint_id)
);

create index fal_endpoints_user_created_idx
  on fal_endpoints (user_id, created_at desc);

create trigger fal_endpoints_set_updated_at
  before update on fal_endpoints
  for each row execute function set_updated_at();

comment on column fal_endpoints.schema is
  'The parsed report (#523): resolved fields with their kinds and ranges, the output kind, and the reasons any field or the endpoint itself is unsupported. Not FAL''s raw OpenAPI document.';
