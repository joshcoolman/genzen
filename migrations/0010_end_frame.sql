-- #512: the frame a clip ends on.
--
-- `thumbnail_path` is frame one (#499), and a row of first frames is what the
-- Sequence page arranges. Deciding whether clip 2 follows clip 1 means
-- comparing clip 1's *ending* to clip 2's beginning -- and the ending was the
-- one frame never on screen. This is that frame, stored the same way and beside
-- it: a 400px WebP under `{user}/thumbs/`, served by `/img/[id]?v=end`.
--
-- Nullable, and null is a normal state, not a failure to repair. A clip whose
-- end frame could not be decoded still has a poster and still plays; the tile
-- falls back to showing its first frame alone. Clips made before this migration
-- are null until `scripts/backfill-video-end-frames.mjs` walks them, exactly as
-- #511 did for posters.
--
-- No index. Nothing queries on it -- it is read by id alongside the row it
-- belongs to, and "clips missing an end frame" is a one-off backfill scan.

alter table user_images add column end_frame_path text;

comment on column user_images.end_frame_path is
  'The last frame of a clip, stored like thumbnail_path (#512). Null for stills, for clips predating the backfill, and for clips whose final frame would not decode.';
