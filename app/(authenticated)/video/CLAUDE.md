# Video

An image you already made, plus a note, comes back moving (#305). LTX-2.5
image-to-video on FAL, with native synchronized audio.

Built to `docs/reference/route-shape.md`. `page.tsx` reads the clip list and the
source images; `use-view.ts` owns everything after the first paint.

## Quirks

- **`models.ts` is the lineup, and the form reads it.** Durations, aspect
  ratios, resolution and price all come off the record, so a second model is a
  literal in that array and nothing else. Route-owned because one route uses it;
  promote it to `src/features/` the day Canvas wants to animate a card.
- **Image-to-video, not text-to-video.** `prompt` and `image_url` are both
  required by the endpoint. The route is never a blank page, which is the point:
  genzen is already an image factory, so the first frame is something you have.
- **The clip is ingested into our bucket, never left on FAL.** FAL's URL is
  public, unauthenticated and not ours to keep alive -- and generation is
  non-deterministic, so a URL that 404s cannot be re-created by re-running the
  request. `generation_metadata.fal_video_url` survives as the degradation path
  when ingest fails, never as the source of truth.
- **`/img/[id]` answers range requests because of this route.** Without a 206 a
  `<video>` streams from byte zero and the scrub bar does nothing. `parseRange`
  in `src/lib/http-range.ts` is the parser, and it is unit-tested -- a wrong
  range stalls the player with no error, which is worse than serving the whole
  object.
- **No poster frame, deliberately.** There is no ffmpeg on the server, so
  nothing can extract one; `thumbnail_path` stays NULL and
  `<video preload="metadata">` lets the browser paint frame one.
- **Clips are `user_images` rows that the gallery does not show.** `source` is
  `ai_video`, and `listGalleryImages` filters `source in ('upload',
  'ai_generated')`. Activity and Trash pick them up for free. Putting videos in
  the library is a matter of teaching the card and the lightbox `<video>` --
  that render change is what V1 declined, not the storage.
- **No Retry.** The endpoint exposes no seed, so an identical request returns a
  *different* clip, while `retry-plan.ts` promises a faithful replay. Rather
  than give one control two meanings, generating again is the same two clicks.
- **Nothing pushes.** The 5s poll runs only while a clip is pending, and it
  calls the same `checkPendingGenerations` the gallery does -- which dispatches
  on `source` to `processVideoResult`, because FAL returns `video.url` here and
  `images[]` for a still.
