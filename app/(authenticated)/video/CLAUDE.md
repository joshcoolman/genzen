# Video

An image you already made, plus a note, comes back moving (#305). Three FAL
models -- LTX-2.5 Fast, MiniMax H3, Flux 3 -- and since #417 you can tick
several, for one clip each.

Built to `docs/reference/route-shape.md`. `page.tsx` reads the clip list and the
source images; `use-view.ts` owns everything after the first paint.

## Quirks

- **The lineup is `src/features/video/models.ts`, not this folder** -- promoted
  in #398, when Activity became its second consumer and needed to name and
  filter clips. Durations, aspect ratios, resolution, price and the request's
  own param names all come off those records; the form and the submit read
  them. Every decision about _this route_ is still here.
- **A mode is an endpoint, and an endpoint is a descriptor rather than an id**
  (#385). Adding the second and third models is what forced it: Flux 3 puts
  first+last frame on a _separate_ endpoint that requires both and calls the
  first one `start_image_url`; MiniMax H3's image endpoint has no
  `aspect_ratio` at all; `generate_audio` is Flux 3 and LTX only. So each
  endpoint carries `firstFrameParam`, `acceptsEndImage` and its own
  `aspectRatios`, and the submit builds its input from that rather than from a
  fixed list. Same idea as the image side's `buildFalInput`, minus the schema
  fetch -- three entries, each field read off FAL's OpenAPI spec by hand and
  pinned in `models.test.ts`.
- **An empty `aspectRatios` means there is no control, not that no ratio
  works.** H3's image endpoint follows the frame it is given, so the form
  renders no Aspect row and the submit sends no `aspect_ratio`. A control with
  no options would say the choice exists and had been taken away.
- **The picker is `ModelSelector` in `mode="multi"`, the generator panel's
  own.** Its two right-hand columns are the same two numbers read differently
  -- dollars per _second_, and _frames_ rather than references -- which is all
  the component needed to be shared: two optional label props, not a fork.

  It was single-select until #417, and that was a money decision rather than a
  simplification -- a clip is 20-100x the price of a still, so "tick four models
  and fire" was a $20 click **when nothing on screen said so**. Three things
  make the count safe to raise, and removing any one puts the objection back:
  the estimate under Generate (#416), **one clip per model** (there is no count
  stepper here and there will not be one -- the useful axis is across models,
  not four takes from one), and a confirm above `CONFIRM_ABOVE_CENTS`.

  **Prompts still multiply, and they are the axis that bites.** Two prompts and
  three models is six clips, none of them duplicates. That is why the confirm
  triggers on **price rather than count**, unlike `GeneratorPanel`'s
  five-images rule: two Flux 3 clips at 20s is $6.80 and eight LTX clips at 6s
  is $4.32, so a count says little about the size of the click.

- **The control column is ordered like `GeneratorPanel`, and that is the
  point.** Prompts, then the frame slots, then the settings, then a full-width
  Generate, then a `CostNote`, then the model picker -- the same order, inheriting the same
  `--panel-rhythm` custom property, so the two surfaces read as the same room.
  A person moves between them in one session. It is not a copy: two image
  slots instead of one (and **labelled**, which that panel's single strip is
  not -- two slots that do different things cannot both be unlabelled),
  duration where the count stepper is (and no stepper at all), and an aspect
  control that can be absent entirely. `RefImageStrip`,
  `ExistingImagePicker` (`max={1}`, `autoConfirm`) and `PromptList` are
  borrowed unmodified; the frames and the picker are passed into `VideoForm` as
  slots, because the view owns the picker dialog they open.
- **A clip's card is `video-thumb/`, not `Thumbnail`.** The difference is the
  `<video>`: a clip has a duration, native controls, and no poster frame
  anywhere in the app, so bending the primitive every still renders through
  around a media element would serve one route at everything's expense. What it
  _does_ borrow is the type scale -- the model badge is `--text-3xs` in the
  picture's corner and the prompt is `--text-3xs` at 1.5 clamped to three
  lines, both matching the image card exactly. Hand-written, they had drifted
  to `--text-sm` and no badge at all, so a clip and a still read as different
  kinds of record when they are the same row in the same table. **No overlay
  actions**: native controls already own the bottom edge, and a second set of
  buttons above them is two rows of controls arguing, so the verbs are text in
  the caption. `video-list/` is now the grid and nothing else.
- **Continue carries on from a clip's last frame** (#494). One press reads the
  frame at the end of a finished clip, saves it as an ordinary upload, and sets
  it as the first frame -- replacing five manual steps that all worked
  (generate, open `lab/frames`, scrub to the end, extract, come back and pick
  it). Enough friction that a four-clip sequence did not get made.

  **It sets up the next generation and stops.** No auto-run: the point is a
  frame in the slot, not a submitted job. The prompt is cleared rather than
  carried over, because the frame is the continuity and the words are about
  what happens next. Any end frame is dropped for the same reason -- it
  described where the _last_ clip was going.

  It sits above a rule in the caption, alone on the left, with the facts and
  the file verbs pushed right below it: Download and Delete act on the clip in
  front of you, Continue starts the next one, and a row mixing the two read as
  three file operations. The mechanism is `src/features/video/frame-capture.ts`,
  shared with `lab/frames` -- and it lands _near_ the end of the clip rather
  than provably on the last sample, so a seam may be a frame or two loose.

- **Last frame is optional, and its slot stays visible when empty.** With one,
  the model solves the move between two stills instead of inventing where the
  shot goes -- the same instruction a prompt spends three sentences failing to
  pin down. Hidden behind a disclosure, nothing would say the capability
  exists. One picker serves both slots; `pickerTarget` says where the pick
  lands, because a second dialog would be the same component mounted twice to
  answer the same question.
- **Several prompts, several models, one first frame, one clip each.** The
  submit loops sequentially rather than `Promise.all` -- each call reserves a
  row before it contacts FAL, and firing them together interleaves the
  reservations against a queue that answers in its own order. **Prompt-major**,
  so the first clip of every prompt arrives before the second of any: a submit
  abandoned half way has covered the prompts rather than one prompt thoroughly.
- **The prompt is the only required input.** Every frame slot is optional, and
  the frames decide which endpoint runs -- `textToVideo` with none,
  `withImage` with a first, `withFirstAndLastImage` with both where the model
  has one, all resolved by `endpointFor(model, hasFirst, hasLast)`. Different
  acts, not a switch: with a first frame you are animating something you made,
  with both the model solves the move between two stills, and with neither it
  invents the whole shot and the prompt has to carry it.
- **Settings are intersected across the ticked models** (#417).
  `sharedDurations` is a plain intersection -- a duration one model rejects
  fails at FAL rather than in the form -- so LTX plus H3 offers 6/8/10/12 and
  neither H3's 5 nor LTX's 20. `sharedAspectRatios` is **not** a plain
  intersection: a model exposing no `aspect_ratio` param is _excluded_ from it
  rather than emptying it, because an empty list means "there is no control"
  and intersecting it literally would strip the control from the models that do
  have one and hand FAL its default. The end-frame slot needs **every** model to
  accept one, not any: the submit refuses an end frame an endpoint does not
  declare, and a partial submit is the worst outcome -- half a comparison is not
  a comparison.
- **Aspect options are per endpoint, and that is not a nicety.** `auto` exists
  only where there is an image to match -- FAL's own enums differ, and the
  text-to-video endpoints reject it. With a first frame, 16:9 and 9:16 mean
  "recrop my picture", which crops and re-imagines; without one they are just
  the output shape. `use-view` coerces the value when the endpoint or the
  selection changes -- and the duration too, since ticking H3 (5-15) alongside
  LTX leaves 18s selected against a model that will not take it.
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
  nothing can extract one; `thumbnail_path` stays NULL and the browser paints
  frame one instead. That takes `firstFrameSrc` from `#/components` (`#t=0.001`,
  which makes the element seek), not `preload="metadata"` on its own -- and it
  works only because `/img/[id]` answers range requests. Every clip surface goes
  through the same helper (#398), so a card, a row and a thumbnail cannot
  disagree about whether a clip has a picture.
- **Delete is the gallery's, unchanged.** `deleteGalleryImage` already decides
  between the three outcomes this route wants -- a generating clip is cancelled
  at FAL first, a generating or failed row goes outright because Trash has
  nothing to offer for a clip that does not exist, and a finished one
  soft-deletes into Trash. The card is on every clip, not just finished ones:
  clearing a failure is the commonest reason to want it, and on a generating
  clip it is the only way to say stop. **Trash had to be told about `ai_video`
  for this** -- its list filtered to `upload` and `ai_generated` while its
  Empty Trash destroyed every trashed row regardless, so a binned clip was
  invisible in the one place that could restore it and swept anyway.
- **Clips are `user_images` rows that the gallery does not show.** `source` is
  `ai_video`, and `listGalleryImages` filters `source in ('upload',
'ai_generated')`. **Activity did not pick them up for free** -- this file said
  it did, and every clip was absent from the log for as long as the route has
  existed (#398). Trash was wrong in the same way until #384. Both claims were
  written from the storage model, and both were false the day they were written:
  a surface shows clips when its _query_ does, and each one is a decision. Fixed
  now for Activity and Trash. Putting videos in the library is still declined --
  it is a matter of teaching the card and the lightbox `<video>`, which is the
  render change V1 passed on, not the storage.
- **No Retry.** The endpoint exposes no seed, so an identical request returns a
  _different_ clip, while `retry-plan.ts` promises a faithful replay. Rather
  than give one control two meanings, generating again is the same two clicks.
- **Nothing pushes.** The poll runs only while a clip is pending, and it
  calls the same `checkPendingGenerations` the gallery does through the same
  `useGenerationPoll` -- so it inherits that hook's backoff (5s under a minute,
  15s under five, 30s after) and its pause while the tab is hidden -- which dispatches
  on `source` to `processVideoResult`, because FAL returns `video.url` here and
  `images[]` for a still.
