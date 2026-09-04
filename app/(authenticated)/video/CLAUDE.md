# Video

An image you already made, plus a note, comes back moving (#305). Four FAL
models -- LTX-2.5 Fast, MiniMax H3, MiniMax H3 Max, Flux 3 -- **one at a time**,
one clip per prompt.

Built to `docs/reference/route-shape.md`. `page.tsx` reads the clip list and the
source images; `use-view.ts` owns everything after the first paint.

## Quirks

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
- **The picker is `ModelSelector` in `mode="single"`, the generator panel's
  own.** Its two right-hand columns are the same two numbers read differently
  -- dollars per _second_, and _frames_ rather than references -- which is all
  the component needed to be shared: two optional label props, not a fork.

  **It was multi-select between #417 and now, and going back was not a
  simplification.** Multi-select bought a cross-model comparison and paid for
  it by intersecting every control down to what all the ticked models agreed
  on. On video the models disagree about nearly everything, so the common
  denominator shrank as the lineup grew, and the differences between the models
  -- the entire reason to carry more than one -- became the one thing the form
  could not express. h3-max is where it broke: it has resolution tiers no other
  model has and takes no frame at all, and neither fact is representable in an
  intersection. Comparing serially costs a second submit. That is cheaper than
  a form that cannot reach what a model can do.

  So a control may now exist for one model and not the others, and the form is
  expected to change shape when the model changes. The frame slots vanish for a
  text-to-video-only model; a Resolution row appears for one with tiers.
  **Do not reintroduce a `shared*` intersection helper** -- the lineup's header
  comment says the same thing, because this is the rule most likely to be
  re-derived backwards.

  **Prompts are still the axis that multiplies**, which is why the confirm
  triggers on **price rather than count**, unlike `GeneratorPanel`'s
  five-images rule: two Flux 3 clips at 20s is $6.80 and eight LTX clips at 6s
  is $4.32, so a count says little about the size of the click. The estimate
  under Generate (#416) and the confirm above `CONFIRM_ABOVE_CENTS` are what
  keep a click that costs real money from being silent.

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
  _does_ borrow is the type scale -- the prompt is `--text-3xs` at 1.5 clamped
  to three lines, matching the image card exactly, and the model reads at that
  size too. Hand-written, they had drifted to `--text-sm` and no model label at
  all, so a clip and a still read as different
  kinds of record when they are the same row in the same table. **The player and
  both frames are one thumbnail, and the chrome sits on its corners** (#534) --
  `...` top-left, the corner action top-right and the select tick bottom-left,
  the gallery card's own corners. **The model is not up there** (#536): it is a
  fact in the caption, because at #535's density a label nearly half the card's
  width, over a half-width end frame, was the loudest thing on a card whose job
  is to show the clip -- which is the corner #537 then filled with Hide, making
  that a port rather than a decision. All three are 20px, which is #536's rule
  about a matched set. Every marker is **always
  on**, where a still hides its `...` until hover: a clip card is a player, a
  pair of end frames and a caption, so it already reads as an object with
  controls rather than as a bare picture -- and the menu is the only route to
  Download and Delete, so one you have to hover to discover is one nobody
  discovers.
  `video-list/` is now the grid and nothing else.

  **This replaced the no-overlay-actions rule**, which said the file verbs had
  to be text in the caption because native controls own the player's bottom
  edge. Two things retired it, both consequences of earlier changes: treating
  the block as one unit puts the player's bottom edge in the _middle_ of it, so
  the bottom corners belong to the two frames, which never have controls; and
  since #530 a card has controls only while it is playing, where before every
  card carried a scrubber permanently. It holds in the one case worth checking
  -- a pending or failed clip has no frames block, so the corners land on the
  player, but such a clip never plays. The frames exist exactly when the clip
  is playable; the controls exist only while it plays.

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
  dropped, because unlike a prompt there is no part of it to edit.

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
- **The player shows a poster and one play button until it is played.** A grid
  of cards was five sets of scrubbers, timecodes and overflow menus competing
  with five pictures, and the pictures are what the page is for. Pressing Play
  hands the card to the native controls, which then stay: sticky rather than
  on hover, because chrome that follows the pointer flickers across a grid and
  a scrubber has to stay put while it is in use.

  The real win is not visual. `poster` (the row's own `thumbnail_path`, #499)
  plus `preload="none"` means a card fetches an image it already has and no
  video at all until asked. That also retires `firstFrameSrc` on this
  surface -- the `#t=0.001` seek existed to make a `<video>` paint frame one
  when nothing else could, which is #500's job everywhere else.

  **One clip plays at a time, and `use-view` owns which** (`playingId`). A card
  cannot know another one started, so left to themselves six of them play at
  once. A card is engaged only while it holds the id; taking it away rewinds
  that card to its first frame and drops it back to a poster and a play button.
  Pausing with the native controls does _not_ release it -- only another card's
  Play does, or the controls would vanish under a pointer that was using them.

  The rewind is guarded on the card having actually played. Touching
  `currentTime` on a `preload="none"` element that never loaded asks the
  browser to fetch the clip, which is the thing the poster exists to avoid.

- **The player and the clip's two ends are one block.** Half the card each,
  flush under the player, no gap between them and none at the edges. The player
  stays -- it is most of what the card is for -- and the frames are the two it
  is worst at showing: the one it opens on, and the one the next clip has to
  start from. Any gap in there and they read as three things that happen to be
  stacked rather than one bigger thumbnail.

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

- **Last frame is optional, and its slot stays visible when empty.** With one,
  the model solves the move between two stills instead of inventing where the
  shot goes -- the same instruction a prompt spends three sentences failing to
  pin down. Hidden behind a disclosure, nothing would say the capability
  exists. One picker serves both slots; `pickerTarget` says where the pick
  lands, because a second dialog would be the same component mounted twice to
  answer the same question.
- **Several prompts, one model, one first frame, one clip each.** The submit
  loops sequentially rather than `Promise.all` -- each call reserves a row
  before it contacts FAL, and firing them together interleaves the reservations
  against a queue that answers in its own order.
- **The prompt is the only required input.** Every frame slot is optional, and
  the frames decide which endpoint runs -- `textToVideo` with none,
  `withImage` with a first, `withFirstAndLastImage` with both where the model
  has one -- all resolved by `endpointFor(model, hasFirst, hasLast)`, which
  also answers `textToVideo` for a model with no image endpoint. Different
  acts, not a switch: with a first frame you are animating something you made,
  with both the model solves the move between two stills, and with neither it
  invents the whole shot and the prompt has to carry it.
- **Settings are the selected model's, whole.** No intersection: `use-view`
  reads `model.durations`, `aspectRatiosFor(model, ...)` and
  `resolutionsFor(model)` directly, and coerces the current value when the
  model or the mode changes, so a control never shows a selection the request
  would refuse. An **empty list means there is no control** -- for aspect
  ratios and resolutions alike -- and the submit sends nothing, or the model's
  fixed `resolution`.
- **h3-max takes no frame, and a staged one is dropped rather than refused.**
  It is the only entry with no `withImage` endpoint, so `endpointFor` falls
  back to `textToVideo` and `takesFirstFrame` is false. The form hides both
  frame slots for it -- that is where the person is told -- but what is already
  staged is **kept**, not cleared, so switching back restores the pick. The
  action drops the frame before it reserves a row or uploads bytes, and records
  the clip as `text_to_video`, because a caller that does not know the lineup
  must not be able to mislabel a row.
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
