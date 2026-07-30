-- #212, subtractive half: `user_images.on_canvas` is gone.
--
-- Its own migration, deliberately last. Everything before this was additive and
-- reversible; this is the point of no return, so it lands only once membership
-- rows are what the app reads and `canvas-membership.server.test.ts` has proved
-- the two agreed.
--
-- What the column could not express, and why a row can:
--
--   * Ownership. A boolean says "on a canvas", never *which*. `/canvas/:id` and
--     "which canvas is this image on" were unaskable.
--   * Position. Arrangement lived in one browser's IndexedDB, so it did not
--     survive a different browser or a different machine.
--   * Integrity. A flag has no foreign key, which is why membership had to be
--     reconciled at every mount -- reclaim, prune, dedupe. All three are now
--     impossible rather than handled.
--
-- The write that motivated the epic goes with it: `set deleted_at = now(),
-- on_canvas = false` was a library operation editing a canvas, and it destroyed
-- the one fact that cannot be re-derived. Trash cannot express that any more.

drop index user_images_on_canvas_idx;

alter table user_images drop column on_canvas;
