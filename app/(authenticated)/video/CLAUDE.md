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
- **The source widget and the prompt list are the generator panel's, borrowed
  whole.** `RefImageStrip` + `ExistingImagePicker` (`max={1}`, `autoConfirm`)
  for the first frame, `PromptList` for the takes -- none of them modified.
  Blocked out rather than laid out: the point was to stop hand-rolling
  equivalents, not to settle the arrangement.
- **Last frame is optional, and its slot stays visible when empty.** With one,
  the model solves the move between two stills instead of inventing where the
  shot goes -- the same instruction a prompt spends three sentences failing to
  pin down. Hidden behind a disclosure, nothing would say the capability
  exists. One picker serves both slots; `pickerTarget` says where the pick
  lands, because a second dialog would be the same component mounted twice to
  answer the same question.
- **Several prompts, one first frame, one clip each.** The submit loops
  sequentially rather than `Promise.all` -- each call reserves a row before it
  contacts FAL, and firing them together interleaves the reservations against a
  queue that answers in its own order.
- **The prompt is the only required input.** Every frame slot is optional, and
  the first frame decides which endpoint runs -- `textToVideo` when empty,
  `withImage` when set, resolved by `endpointFor`. Same shape as
  `IMAGE_MODELS`'s `textToImage` / `withImages`. Two modes because they are
  genuinely different acts: with a first frame you are animating something you
  made; without one the model invents the whole shot and the prompt has to
  carry it.
- **Aspect options are per mode, and that is not a nicety.** `auto` exists only
  where there is an image to match -- FAL's own enums differ, and the
  text-to-video endpoint rejects `auto`. With a first frame, 16:9 and 9:16 mean
  "recrop my picture", which crops and re-imagines; without one they are just
  the output shape. `use-view` coerces the value when the mode changes, so the
  pills never show a selection the request would refuse.
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
  _different_ clip, while `retry-plan.ts` promises a faithful replay. Rather
  than give one control two meanings, generating again is the same two clicks.
- **Nothing pushes.** The 5s poll runs only while a clip is pending, and it
  calls the same `checkPendingGenerations` the gallery does -- which dispatches
  on `source` to `processVideoResult`, because FAL returns `video.url` here and
  `images[]` for a still.
