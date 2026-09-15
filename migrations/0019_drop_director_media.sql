-- Director keeps its sessions and loses everything else (#662).
--
-- A session is now a name and an ordered list of `user_images` ids, so the
-- private media path, the export machinery and the final-cut runner have no
-- rows left to hold. `scripts/purge-director.mjs` deletes the bucket objects
-- and the session rows first; this drops the tables behind them.
--
-- `director_sessions` stays: `(id, user_id, name, revision, cut, ...)` is
-- exactly what a named, versioned, ordered thing needs. `draft` goes with the
-- script-writing surface that was the only thing writing it.
--
-- `user_images.origin` keeps accepting 'director'. It costs nothing, and a clip
-- made inside a session can carry it.
-- One statement, because the five reference each other in a cycle: media
-- points at a final cut, a final cut at an export, an export back at media.
-- Dropped separately, any order leaves a dependency standing.
drop table if exists
  director_export_videos,
  director_final_cuts,
  director_exports,
  director_requests,
  director_media;

alter table director_sessions drop column if exists draft;
