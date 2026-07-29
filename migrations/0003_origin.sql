-- #207: origin as a first-class column.
--
-- Which surface an image was *made on*. Not provenance (what it descends from)
-- and not membership (where it sits now): a canvas generation from an uploaded
-- photo descends from an upload, is on a canvas, and its origin is `canvas`.
-- Three independent facts.
--
-- Three values by declaration, not by accident:
--
--   upload   an upload. Paste-on-canvas and paste-on-Images produce identical
--            bytes, so the surface authored nothing and there is no fourth cell.
--   images   generated from the Images route.
--   canvas   generated from the canvas, which *did* author the request --
--            the selection became source + references, the prompt was
--            auto-labelled, the model list was scoped by reference capacity.
--
-- No column default, on purpose. Origin is exactly the kind of fact that was
-- previously true by omission (`source_client`, set by one caller out of four),
-- so an insert that forgets it must fail rather than quietly mean `images`.

alter table user_images add column origin text;

-- Backfill. `source_client` is where canvas-authored generations recorded
-- themselves before this column existed; it is the only evidence available.
update user_images set origin = 'upload' where source = 'upload';

update user_images set origin = 'canvas'
where source <> 'upload'
  and generation_metadata ->> 'source_client' = 'genzen-canvas';

-- Everything left is a generation with no surface recorded. That is the #207
-- complaint itself -- absence of evidence was indistinguishable from "made on
-- Images" -- so the backfill resolves it the only way it can, and this comment
-- is the record that these rows are an inference and not a declaration.
update user_images set origin = 'images' where origin is null;

alter table user_images alter column origin set not null;

alter table user_images add constraint user_images_origin_check
  check (origin = any (array['upload', 'images', 'canvas']));

comment on column user_images.origin is
  'Surface the image was made on: upload, images, canvas. Immutable; written explicitly at insert (no default).';

create index user_images_origin_idx on user_images (user_id, origin, created_at desc);
