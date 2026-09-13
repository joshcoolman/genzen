# Video

An image you already made, plus a note, comes back moving (#305). Five FAL
models -- LTX-2.5 Fast, MiniMax H3, MiniMax H3 Max, Flux 3, Kling O3 Pro -- **one at a time**,
one clip per prompt.

Built to `docs/reference/route-shape.md`. `page.tsx` reads the clip list and the
source images; `use-view.ts` owns everything after the first paint.

## Quirks

- Saved Director rough exports appear here and in every Lab video picker (#607).
  They are ordinary completed `ai_video` rows with `origin = director`, separate
  files and stored session/export provenance. Video's deletion does not affect
  Director and Director's deletion does not affect Video. Final Cut experiments
  and working clips remain private. `listVideos` backfills missing publications;
  deleted copies never come back automatically.
- **The wall is `minmax(12rem, 1fr)`, down from 20rem** (#535). 20rem was set
  when a card was a player and a caption; a card is now a player, two end
  frames and a caption, so the same column bought a much taller card -- at a
  typical window, one clip per row filling the content column with a single
  take. 12rem is the largest minimum that still fits three across at the width
  this route renders at, which is the density that reads right. Cards still
  stretch past it on a wider screen; it is a floor, not a fixed size.

  **There is no size control, and that is Images' own lesson.** Its thumb zoom
  is a keyboard-only multiplier with nothing on screen -- #284 deleted the size
  dropdown that preceded it. If Video ever wants variable size, promote that
  mechanism (`zoom` on the grid element, three lines) rather than adding the
  control Images removed.

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
  fetch -- four entries, each field read off FAL's OpenAPI spec by hand and
  pinned in `models.test.ts`.
- **An empty `aspectRatios` means there is no control, not that no ratio
  works.** H3's image endpoint follows the frame it is given, so the form
  renders no Aspect row and the submit sends no `aspect_ratio`. A control with
  no options would say the choice exists and had been taken away.
- **Images carry roles (#516).** One thumbnail strip under the prompts, with
  First frame / Reference / Last frame on every image. The
  library picker also supports uploading. Clearing or changing roles never
  silently reassigns another image.

  **An added image defaults to Reference wherever the model takes one.** The
  first one defaulted to First frame until 2026-09-13, which is the wrong guess
  on a reference-capable model: adding a picture then meant changing its role
  before adding the next, every time. A first frame is a specific intent --
  start the clip on exactly this -- and it is one click on the chip; a
  reference is what a picture usually is. A model with no reference endpoint
  keeps the old default, because there the first image has one place to go.
  The `?image=` handoff still lands as First frame: that route is "animate this
  still", and it says so.

- **Capabilities select the model, never the input.** `imageCompatibility` in
  `src/features/video/inputs.ts` drives unavailable model explanations and the
  server validation. A compatible selection stays selected; otherwise the
  first compatible model is selected visibly. No compatible model means no
  generation and no cost estimate. All images remain editable.
- **The model picker is route-owned.** Images' shared picker can truncate to a
  single numeric capacity; Video needs role combinations, reference counts and
  reasons. `model-picker/` keeps the same single-select rows, with capabilities
  beneath each model and the per-second price alongside. Controls and estimates
  resolve synchronously for the selected endpoint. No shared intersection of
  durations, resolutions or aspect ratios.
- **Reference arrays preserve strip order, excluding frames.** H3 labels them
  `Image 1`, `Image 2`; Kling labels them `@Image1`, `@Image2`. Labels and the
  submitted order derive from the same roles. H3 takes up to nine references
  without fixed frames; Kling supports combining references and first/last
  frames. The current app cap for Kling is four references, conservatively
  below its still-only ceiling; video elements are not part of this UI.
- **H3 Max accepts first, last, or both frames.** The image endpoint sends
  `prompt_expansion_mode: balanced` and omits aspect ratio. The text-only
  restriction in the old catalog was stale. LTX and Flux keep their existing
  image endpoints; Flux has a distinct first+last endpoint.
- **Validation precedes paid work.** The action validates roles, settings and
  ownership of every completed, non-deleted still before reserving a row or
  uploading. Unknown model IDs are errors. `input_images` captures the complete
  role selection; source/end/reference fields also remain in metadata. Upload
  failure cannot degrade into text-only generation.
- **Cost depends on inputs too.** H3 references at 768P cost 6c/second plus 8c
  per reference after the first five. Kling uses audio-on pricing, 14c/second.
  The estimate, confirmation and recorded estimate use the same helper.
- **Controls stay in the familiar order:** prompts, image strip, duration and
  shape, Generate, estimate, then model list. Prompts multiply clips; confirmation
  still triggers above the price threshold rather than by image count.
- **A clip's card is `video-thumb/`.** It combines a poster button, two end
  frames, model, prompt, shape, duration, and Continue. The always-visible menu,
  Hide/Trash corner action, and selection tick operate independently of playback.
  `video-list/` supplies the grid; the route owns the playback dialog.

- **Grab frames is a contact sheet of a clip you already own** (#647). The
  card's `...` menu opens a grid of stills sampled start to finish; pick any
  number, Import to Images, done. No route, no timeline, no scrubbing -- the
  question it answers is "which of these is the shot", and `lab/frames` is
  still the tool for an exact position and the only one that takes a YouTube
  link.

  **The sheet is built once per clip, ever.** First open decodes the clip in
  one ffmpeg pass, keeps ~one tile per two seconds (clamped 12-48), stacks them
  into a single WebP in the bucket and writes the timestamps into
  `generation_metadata.frame_grid`. Every reopen is one cached request for
  `/img/[id]?v=frames` and a `background-position` per cell -- not N `<img>`
  elements, because the tiles only ever exist together. About half a second for
  a ten-second clip locally, a second for ninety.

  **The sampling is set for short form, and it shipped wrong.** At one tile per
  five seconds every clip under a minute landed on the floor of 12 and the
  scaling never fired at all -- a 60s sequence got tiles five seconds apart,
  which is a summary rather than coverage. At one per two the cap binds at 96s,
  just past the ~1.5 minutes a sequence runs to. `GRID_VERSION` is why a clip
  whose sheet already existed picks the new sampling up: a stored sheet from an
  older policy is rebuilt on next open rather than kept forever, which is the
  only way a change here reaches the clips being worked on.

  **A tall stack is narrowed to fit, not shortened.** WebP will not encode past
  16383px, and one column of 9:16 tiles at 320 wide clears that at 29 of them --
  the encode fails and the whole sheet reads as "no frames could be read out of
  that clip". So the tiles are scaled down until the stack fits: coverage is
  what the grid is for, and a softer thumbnail is the cheaper thing to spend.
  Latent until sampling went dense; portrait clips are exactly what short form
  is.

  **Sharpness is what decides whether it is worth having.** Even sampling hands
  back motion-blurred stills, and a blurred reference is not a reference, so
  three candidates are decoded per tile and the largest JPEG at fixed quality
  wins -- detail costs bytes, blur does not. Two guards on top of that, both
  found on a real clip: a challenger must beat the interval's own frame by 15%,
  and a pick may never land next to the previous tile. Without them the sheet
  returned 0.558s and 0.837s as separate tiles -- a duplicate pair, and a tile
  of coverage lost.

  **Full-resolution frames are only ever made on import.** The selected
  timestamps are re-extracted one at a time and each goes through
  `saveFileToLibrary` like any upload, stamped `kind: 'grid'`. That stamp is
  read back on open, so an already-imported tile is marked and cannot be picked
  twice. Storing every frame up front would be paying for the twenty-five
  nobody wanted.

  The decode is `src/lib/server/clip-frames.server.ts`, beside the poster's --
  `ffmpeg-static`, an npm dependency, so unlike `lab/frames` this needs no
  system binary and works on the deploy.

- **Continue carries on from a clip's last frame** (#494). One press reads the
  frame at the end of a finished clip, saves it as an ordinary upload, and sets
  it as the first frame -- replacing five manual steps that all worked
  (generate, open `lab/frames`, scrub to the end, extract, come back and pick
  it). Enough friction that a four-clip sequence did not get made.

  **It sets up the next generation and stops.** No auto-run: the point is a
  frame in the slot, not a submitted job. **It carries the clip's prompt over**,
  and used to clear it. Clearing was argued from the sentence -- the frame is
  the continuity, the words are about what happens next -- and was wrong about
  the work: continuing is usually the same shot carried on, so an empty box
  meant retyping most of a prompt to change a clause. Any end frame is still
  dropped, because unlike a prompt there is no part of it to edit. Reference
  images are preserved; an incompatible combination stays visible for repair.

- **The card is built to be scanned, because a wall of takes is near-identical
  cards** (#537). Three things do it, and all three are about the numbers being
  in one place: the prompt **reserves all three of its clamped lines** whether
  or not it needs them, the facts row is pinned to the card's **bottom edge**
  with `margin-block-start: auto` (the grid stretches cards to their row's
  height, so without it a short card left a band of empty surface under its
  numbers), and Continue is **top-aligned** rather than sitting on the prompt's
  last line, which moved whenever a sentence ran long. Cards get taller than
  their content needs; that is the trade, and it is the right one here.

  **The two always-on markers on the picture are the same 20px.** The tick sets
  it flat; the `...` gets there through `ExpandableIconButton`'s pill, which is
  its icon plus `--space-4` a side, so `.menuIcon` is `0.75rem`. They sit in
  opposite corners of one picture, and at two diameters they read as two
  systems rather than one pair.
  **Continue sits in the caption's top-right** (#534, #537), and it is still the one act on
  this card that starts new work rather than acting on this row -- which is why
  it is on the prompt's line and not in the `...` menu with Download and
  Delete. It has moved twice: a caption text link (#494), then the last frame
  itself (#534's predecessor #530), then back to the caption.

  **That last move is not drift, and the reason matters.** A picture with a
  button embedded in its right half is exactly why nothing else could go on
  that block -- so Continue is now buying the whole unit's uniformity, which
  was not on the table when #530 chose the frame. The frames are plain
  pictures; the corners are free. Below them a rule, then only the two facts a
  clip _is_ -- shape and duration. Nothing in that row is clickable any more.
  The mechanism is `src/features/video/frame-capture.ts`, shared with
  `lab/frames` -- and it lands _near_ the end of the clip rather than provably
  on the last sample, so a seam may be a frame or two loose.

- **A card says the clip's shape, then its duration, and not its cost.** Shape
  is what decides whether two clips can cut together (#512) and no surface
  showed it; cost came off because every generation is already a row in the
  Activity log, which is where a spend question gets asked, and on a card it
  was per-item noise beside a Download button. `clipFacts` and the shape
  helpers are `src/features/video/clip-facts.ts` -- they moved out of
  `lab/_components/` when this card became their second consumer.
- **Click a thumbnail to review the clip in a large dialog.** The card is a
  poster button; it never plays inline or loads video bytes. `playingId` in
  `use-view` selects the single `VideoPlayerDialog`. Playback starts on open,
  with native controls and fullscreen support. The player uses `contain` and
  viewport height limits so portrait and wide clips show their complete frame.
  Escape, Close, or backdrop dismissal unmounts the video and stops playback.
  Entering selection also clears playback. Card crops are only previews.

- **The poster and the clip's two ends are one block.** The first and last
  frames sit flush beneath the poster, half the card each. Playback lives in
  the dialog; these images remain useful for scanning the library.

  They are plain `<img>` on `thumbnail_path` and `?v=end`, deliberately not the
  lab's `ClipFrames`, which draws frame one as a `<video>` because a lab tile
  has no player above it. A grid, not flex: 50/50 has to hold exactly, and two
  flex items disagree by a pixel when their intrinsic widths differ -- the seam
  down the middle of the card is the one place that shows.

  **The strip owns the height, not the frames** — one `aspect-ratio` on the
  container, twice one frame's, with both cells at `height: 100%`. Sized
  separately the two derive a height from a fractional column width and round
  differently: the last frame rode a pixel high, and a hairline of card showed
  under the first while the clip played. One height computed once cannot
  disagree with itself, and `overflow: hidden` clips what is left of a
  fractional column.

  **The stage takes the clip's own shape, clamped to between 21:9 and 4:3.**
  Set inline from `width`/`height`, the same way the two frames are. Within the
  clamp there is nothing to letterbox and nothing to crop: the poster and the
  playing clip are the same picture in the same box, so pressing Play changes
  the controls and nothing else. Outside it — a portrait clip, an ultrawide
  one — the stage lands on the nearest bound and `object-fit: contain` centres
  the clip in it, which is the standard box a vertical clip wants anyway.

  **The shape is the one the caption names, not the exact rectangle FAL
  returned** (`namedRatio`). One 21:9 request comes back as both 1504x672
  (2.238) and 1568x672 (2.333); `sameAspect` calls them one shape, the caption
  says `21:9` on both, and a stage sized from the raw ratio then stood two such
  cards ~14px apart in height. Three parts of the app agreeing and a fourth
  disagreeing was the bug — the crop it costs is under the 5% the app already
  treats as no difference.

  **The clamp is there because `VideoList` is a grid and grid rows are as tall
  as their tallest card.** Unbounded, a portrait clip is a card three times the
  height of the 21:9 one beside it and every short card in that row sits over
  dead space. Clamped, the raggedness is the range real horizontal shapes
  occupy — 21:9 to 4:3, about 100px of stage at a 20rem column.

  **`cover`, in both states.** Snapping to the named shape means the stage can
  be up to the 5% tolerance off the picture's true rectangle, and `contain`
  draws that difference as thin edges down the sides — at rest and while
  playing alike. Filling the box absorbs it, at the cost of the same 5%
  cropped, which is what the app already treats as no difference. The two
  frames fill their halves the same way, so a card never shows an edge in any
  state.

  The exception it also swallows: a clip outside the clamp — portrait, or
  ultrawide — is now cropped to the nearest allowed box rather than centred in
  it. That is a real crop, not a 5% one, and it is the thing to revisit if
  portrait clips start mattering. There are six in the library today.

- **Several prompts, one model, one clip each.** The prompt remains required.
  Role selection routes through `endpointForImages`; the submit runs sequentially
  and refreshes once. Reference-only and end-only runs are recorded as
  `image_to_video`, not `text_to_video`.
- **Settings are the selected model's, whole.** No intersection: `use-view`
  reads `model.durations`, `aspectRatiosFor(model, ...)` and
  `resolutionsFor(model)` directly, and coerces the current value when the
  model or the mode changes, so a control never shows a selection the request
  would refuse. An **empty list means there is no control** -- for aspect
  ratios and resolutions alike -- and the submit sends nothing, or the model's
  fixed `resolution`.
- **Resolution is a control for one model only, and that is the point.**
  h3-max renders at 480P or 768P at different prices, so the tier lives on the
  record (`resolutions`) and `resolutionFor` resolves what is actually sent --
  once, because the estimate and the submit have to name the same thing. A
  price quoted at 480P against a clip rendered at 768P is the bug that shape
  prevents. The other three carry a fixed `resolution` and no list. LTX and
  Flux 3 both have higher tiers that belong here the day their per-tier prices
  are confirmed.
- **Aspect options are per endpoint, and that is not a nicety.** `auto` exists
  only where there is an image to match -- FAL's own enums differ, and the
  text-to-video endpoints reject it. With a first frame, 16:9 and 9:16 mean
  "recrop my picture", which crops and re-imagines; without one they are just
  the output shape. `use-view` coerces the value when the endpoint or the
  selection changes -- and the duration too, since switching from LTX (6-20) to
  H3 (5-15) leaves 18s selected against a model that will not take it.
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
- **A clip has a real poster frame, and the tiles do not use it yet.** Since
  #499 ingest runs ffmpeg over the bytes it just stored: frame one becomes
  `thumbnail_path` like any image thumbnail, and `width`/`height` come off that
  frame, which is the whole video rectangle. So `/img/[id]?v=thumb` serves a
  ~15KB WebP for a clip exactly as it does for a still.
  **The last frame is stored too, as `end_frame_path`** (#512), by a second
  ffmpeg pass in the same function and to the same size and quality. It is
  served by `/img/[id]?v=end`, which unlike `?v=thumb` does **not** fall back to
  the original — a caller asking for the ending would rather get a 404 than the
  mp4 or the opening frame. Allowed to fail on its own: a clip whose ending will
  not decode keeps its poster, its dimensions and everything that reads them.
  **`duration_seconds` is still what was requested, not what arrived.** Reading
  the real figure needs `ffprobe`, a second native binary for one number, and
  the requested one is what the cost estimate was priced on -- so it was not
  worth it. `models.ts` notes MiniMax billing on 1.2x the request, so the field
  and the file can disagree.
  **Every clip surface is still a `<video>`, with one deliberate exception** --
  the switchover is #500, kept separate so the poster existed before anything was
  deleted for it. The exception is the ending half of a Sequence tile (#512),
  which is an `<img>` on `?v=end` because there is no media-fragment trick that
  seeks a `<video>` to its own last frame. Its opening half is still a `<video>`
  like everything else, which is what keeps that tile working for a clip with no
  poster at all. That takes
  `firstFrameSrc` from `#/components` (`#t=0.001`, which makes the element
  seek), not `preload="metadata"` on its own, and it works only because
  `/img/[id]` answers range requests. Every clip surface goes through the same
  helper (#398), so a card, a row and a thumbnail cannot disagree about whether
  a clip has a picture.
  **Clips made before #499 have no poster** -- no backfill was run -- so
  whatever #500 builds needs the `<video>` path as a fallback, not as dead code.
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
- **Several clips at once, and four verbs: Add to group, Remove from group,
  Hide, Trash** (#517, #537). Images carries six -- a still is
  a thing you file, sheet, share and hide; a clip is a take you group, hide or
  prune. There is no
  reference sheet, because a sheet of clips is not a thing, and no zip yet.
  Focus was a fifth until #587 removed it from both routes; what is left of it
  is #590.
  They are listed once, in `_components/selection-actions/`, and rendered into
  whichever container the width chooses: the controls column takes them over on
  a wide screen (#587), and below 60rem -- where that column has stacked under
  the wall, so a takeover would put the verbs off the bottom of a long page --
  they go in the bottom drawer.
  `useSelection`, `SelectionPanel` and `SelectionDrawer` are borrowed unchanged
  -- all three exist so
  a route supplies the verbs and nothing else -- and the trash is
  `trashGalleryImages(ids)`, which dispatches on `status` and never on
  `source`, so it was already right for clips. One call for the set (#329):
  React serialises server actions, so a loop would freeze the wall for one
  round trip per clip.
- **Hide takes a clip off the wall without destroying it** (#537), and it is
  `src/features/visibility/` -- promoted out of `images/_hooks/` in the same
  change, on the two-consumer rule that moved groups here in #517. The same
  shape as grouping was: `setImagesHidden` never filtered on `source`, so the
  write was already right for a clip and only the surface was missing. It
  matters more here than on a wall of stills -- a wall of takes of one shot is
  mostly near-misses you want out of the way while you judge the two that
  worked, and a clip is expensive enough that binning one to tidy up is a real
  loss. **The corner icon hides; Cmd makes it Trash**, carried over from the
  gallery card unchanged: trashing was the path of least resistance for tidying
  a wall because it was the only one-click thing on it, so the ease points at
  the safe verb and the destructive one keeps the same spot behind a modifier.
  A second icon was the thing to avoid -- the mis-click that matters is the
  destructive one. The `...` menu keeps a plain Delete, and both are at
  `/account/shortcuts`. **`HiddenBar` sits above the wall**, app-shared since
  #537; a hidden clip is out of a group card's swatch strip too, filtered
  client-side exactly as #504 does it, and the group's `count` is left alone
  because it is a fact about the group rather than a description of the screen.
  **The bar counts what is hidden where you are standing** (#546) -- this group
  or top level -- and the group card says ", 2 hidden" beside its count, so a
  clip hidden inside a group is still visible as a fact from outside it.
- **Groups are `src/features/groups/`, and this route is why they are there.**
  They were `images/_actions/` until #517; a clip has always been a
  `user_images` row, so it already carried `group_id` and no write had ever
  filtered on `source`. `kind` (`'image'` / `'video'`) keeps the namespaces
  disjoint -- read that feature's CLAUDE.md rather than re-deriving why a
  shared pool was refused. `useGroups('video')` is the whole of this route's
  side of it.
- **A clip generated while a group is open is filed into it**, the way a
  generation is on Images. That is the half that makes a group a place to work
  rather than a folder. `generateVideo` takes a `groupId` and
  `createPendingGeneration` verifies it against both the user and the kind --
  which it derives from `source`, so this route passes no kind at all.
- **`?group=<id>`, not a route segment**, and the same `view.tsx` with one
  filter. The clips are filtered client-side off `group_id`, exactly as the
  gallery does it: the route already holds every row, so a group view is a
  filter rather than a second query. At top level a grouped clip is _absent_ --
  the group card stands in for it, which is the collapse that makes grouping
  worth having.
- **The group's name replaces the route's `PageHeader`**, rather than sitting
  under it. Two titles is two `h1`s, and the second is the answer to "where am
  I" that the first one no longer gives. Images does the same thing with its
  scope row.
- **`VideoGroupCard` is a sibling of `GroupCard`, not a generalisation** (#446's
  precedent): the dropdowns differ, and copying sixty lines is cheaper than a
  prop that turns half of one off. What matters about it:

  **It looks like a group, not like a clip.** A clip card is a player -- play
  button, native controls, two end frames flush underneath, verbs in the
  caption. This is stills, and the only thing to press is the card. That is
  what says "this is eleven things, not one".

  **And it still reads as video**: the cover is 16:9, edge to edge, cropped.
  Wider than the image group card's tile on purpose -- a square cover in this
  wall would read as an image group that had wandered onto the wrong route.
  Cropping is deliberate in both the cover and the swatches; every clip card
  beside it already states its own shape, and this card is not where that fact
  lives.

  **The swatches are square and capped, which is the one departure forced by
  this wall.** `VideoList` is `minmax(20rem, 1fr)`, so on a wide screen a card
  is 600px and five `1fr` cells become 110px boxes -- a strip outweighing the
  cover above it, reading as a second and worse grid of pictures. They stop
  growing at `--clip-swatch` and the row is left-aligned. The strip is a count
  you can see, not five pictures to study.

  **Select mode is a selection, not a switch** (#325, unchanged). Being in the
  mode is having something picked; Escape and Deselect all are the way out
  because emptying the selection is the only thing leaving could mean, and the
  tick sits on every card always so picking up again after a delete is one
  click rather than a mode to re-enter. What changes on screen is the controls
  column, which the verbs take over while the selection lasts (#587) -- a swap,
  not a second piece of state: the surface is chosen from `selectedCount > 0`
  like everything else about the mode.

  **In select mode the whole picture is the target** (#538), as a still's whole
  tile is. Only in select mode: with nothing picked, Play owns the player and
  Continue owns its corner, and a card-wide target would take both away. The
  overlay sits under the tick and the `...` (`z-index: 2` against their 3), so
  those keep their own clicks, and stops at the caption so the prompt stays
  selectable text.

  **Entering select mode stops whatever was playing**, which is what lets there
  be no exception. Picking and watching are different things to be doing, and
  the wall is one or the other: in select mode every card is a poster and a
  tick, with nothing under the picture that a click would rather have gone to.
  It briefly covered every card _except_ the playing one, whose scrubber was in
  use -- a rule that had to be stated, and that read on the wall as one tile
  behaving unlike its neighbours. The card rewinds itself on the way out, the
  same as when another card takes playback.

  **The tick is the way in** -- the card deliberately does _not_
  become one big toggle in select mode the way a still does, because a click
  anywhere on it would have to take Play away. It sits bottom-left of the unit,
  the gallery card's own corner (#534); it was top-left while the chrome was
  positioned against the player rather than against the whole block.

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

## Seedance 2.5

Seedance is a normal model choice, with the existing image-role picker and
resolution/duration controls. Use references or first/last frames, not both.
Its first-frame endpoint follows the image shape and shows no aspect-ratio
control. Continue reuses that same endpoint; reference-only input uses `@ImageN`
labels. The shared nine-image limit applies. Prices are estimates based on
FAL's published per-second approximations for token billing.

Generate audio is a shared switch shown only for audio-capable models. It
starts on and keeps the user's choice when switching models. It controls new
generation, not playback mute, and is captured with each batch. Audio-off
Kling estimates use its lower rate. Prompt guidance mentions speech only when
the chosen model and audio setting support it.
