# Images

The gallery and the generator: everything you have made or uploaded, and the
panel you make the next one from.

Built to `docs/reference/route-shape.md` (#189). `page.tsx` is a server
component that runs `listGalleryImages()` and hands the rows to `view.tsx` as
`initial`; `use-view.ts` seeds from that and owns every read after it.

**That seed is bounded** to `GALLERY_SEED_LIMIT` (#328). Not for the first
paint's sake -- a server action re-renders the route it was called from, so
every delete, group write and poll tick re-runs this read. Bounding it is what
stops a mutation from costing a full library scan. `use-gallery` completes the
list once when the seed comes back full, so the grid is never short.

## Quirks

- **Load fills the panel with a past generation** (#382) — a small icon in the
  caption, across from `Details`: prompt, reference images, aspect ratio, and
  **not the model**. The selection is the working context you are already in,
  not part of the thing being loaded, so clobbering it would throw away the
  deliberate half of the setup to restore the half you are about to change.
  Leaving it alone is also what composes: load one generation, tick three
  models, generate nine. It is not Retry (which resubmits that row) and not
  a variation (which rewrites the prompt) — it creates nothing and touches no
  row. It loads what it can and says what it could not, because a panel is a
  starting point rather than a submission; `planRetry` refuses in the same
  situation and is right to, for the opposite reason. A trashed input counts as
  missing: restoring an image is a deliberate act. **It replaces the whole prompt
  list, not row 0** (#458): it was `setPrompt` until the panel routinely held
  several, and after a Variations run loads four (#436) a Load left you with
  five prompts and Generate ran all of them. **Activity carries the same verb as
  a button** (#458), reaching the panel through the handoff rather than directly;
  the two behave identically on purpose, since two things called Load that
  differ is worse than either one alone.
- **The corner icon hides; Cmd makes it Trash** (#504). Trashing was the path
  of least resistance for tidying a group because it was the only one-click
  thing there, so the ease moved to the safe verb and the destructive one kept
  the same spot behind a modifier. A second icon was the thing to avoid -- a
  row of them in a card corner is more to mis-click, and the mis-click that
  matters is the destructive one. The drawer's plain Trash stays the fallback
  and the deliberate bulk case; both are at `/account/shortcuts`.
  **Hide and focus are one predicate** (`isVisible` in
  `src/features/visibility/`, promoted out of `_hooks/` in #537 when Video
  became the second consumer -- `HiddenBar` went to
  `app/(authenticated)/_components/` in the same change),
  because "hide these eight" and "show only these two" are the same filtered
  view from opposite ends. Only hiding persists: `hidden_at` is a column,
  independent of `deleted_at` -- trashing does not clear it, so a restore puts
  a hidden image back hidden. Focus dies with the page, and **wins over hidden
  rather than intersecting with it**, or a focus would silently drop images you
  had just selected. Applied once above the scope filter, so a group, top level
  and every scope inherit it. **Group swatches and the expanded member strip
  are filtered client-side**, not in the reads that build them -- the client
  holds every row, so the filter costs no round trip; a group's `count` is
  left alone, being a fact about the group rather than a description of the
  screen. **The bar above the grid is the feature, not the hiding**: hidden
  state you cannot see is a slower kind of lost. It was a quiet rule _under_
  the grid for one build, which is the one place it cannot work -- you reach
  it after running out of pictures, which is when you have stopped looking.
  Toned, at the top, and absent entirely when there is nothing to say.
  **It reports what is hidden where you are standing** (#546) -- the open
  group, or top level, under the origin scope you are in -- because `Show`
  sits under that sentence and has to act on the things it counted. Unscoped
  it said "4 hidden" over a wall missing nothing, and Show from inside a group
  unhid the whole library. The group card carries the other half: it says
  ", 3 hidden" beside its count, so a picture hidden in a group is not
  invisible from out here.
  **Clicking it opens a tray of the hidden pictures**; a thumbnail there is
  one click from coming back, and `Show` on the bar brings all of them.
  **Hidden rows are never drawn in the grid** -- the first shape toggled them
  back in among the visible ones while still calling them hidden, which read
  as broken: "4 hidden" over four visible pictures. The tray is a holding
  area, plainly somewhere else, so the wall stays true
- **Outpaint is a card action, and the model is not a choice** (#430). The
  `...` menu opens a dialog of every aspect ratio; tick as many as you need and
  Generate submits one edit per shape against Grok Imagine 2.0. The lab page
  that answered "which model can outpaint" is deleted (#528) -- a settled
  question a picker would ask again before every press -- so the model is
  `OUTPAINT_MODEL_SLUG` in `src/features/ai-images/outpaint.ts`, one line to
  change and no UI. What that page established is written up there. **The shape the picture already is stays in the grid,
  greyed and labelled `Current`**: absent, it reads as an option the app does
  not support. It is measured from the thumbnail (`matchRatio`), not read from
  `generation_metadata.aspect_ratio`, because an upload has none and a
  generation's records what was asked for rather than what came back.
  **Nothing is loaded into the panel** -- the results land in the grid as
  ordinary pending cards, filed into the open group like any other generation.
  `Animate` was removed from the same menu; `/video` still accepts `?image=<id>`
  but nothing links to it
- **Shots is the panel's action, not a card's** (#553). The staged reference
  set is already the answer to "which pictures", so the way in is a `Shots`
  button in the Ref images header -- absent until something is staged. The
  dialog crosses the pictures you tick with the angles you tick: two and two is
  four generations, **each carrying exactly one reference**
  (`sourceImageId`, never `referenceImageIds`). That is the opposite errand
  from the panel's own multi-image path, which sends the set together and asks
  for one picture back. Unlike Outpaint the model _is_ a choice, because that
  question is open -- which model keeps a subject itself while the camera moves
  -- and it is one model at a time, defaulting to Nano Banana 2. Results land
  in the grid as ordinary pending cards, filed into the open group; nothing is
  loaded into the panel. The angles are `src/lib/prompts/shots/`.
  **Instructions are typed in the dialog, never inherited from the panel** --
  the panel's prompt is whatever was last generated with, and folding it in
  silently would make "sixteen angles of this picture" also a restyle. A typed
  instruction outranks the constant block's freeze, which is the only reason it
  does anything (the block locks the environment, so an appended nudge would
  otherwise be two contradictory orders); the camera position outranks the
  instruction

- **The card has two icons, and a click opens the viewer.** `...` and
  Delete on the image, the model in its bottom-right corner; the whole prompt
  under it, being its own copy button. The model sat at the top of the caption
  until it read as a title for the prompt -- it names what made the picture, so
  it lives on the picture. The expand icon went (the click
  does that), the
  select circle went (select mode does), and the source highlight went -- the
  grid used to point the generator at an image on click, which is a hidden
  piece of state for the most obvious gesture on the page. **The prompt clamps
  to three lines and does not expand**: three is enough to recognise a prompt,
  the click copies all of it regardless, and Activity shows it entire.
  Unclamped (#284) a long prompt gave its card twice the height of its
  neighbours for text nobody read past line three. Hiding the caption entirely
  is still the info toggle's job
- **There is no source image; there is one set (#297).** The panel holds an
  ordered set of zero to N **Reference images**. Index 0 is the only asymmetry
  left: the aspect ratio is derived from it, and it is submitted first. **Two
  ways in, both inside the panel or under your fingers**: the library picker
  (which uploads from disk since #489) and a paste on this route, which uploads
  the image and pushes it onto the front of the set in one gesture (#491). The
  toolbar's Upload button and its "Upload to group" flow are gone -- they were a
  second route to the same act, further from where the image gets used, and
  upload-and-immediately-use cost two gestures because of it
- **Nothing caps the set (#341).** Stage as many images as you like against any
  selection; each model takes what its endpoint holds, `buildFalInput` drops the
  rest, and `images_used`/`images_requested` on the row make the card say "1 of
  5 images". The picker's `Refs` column is the capacity, and a row that cannot
  hold the current set is dimmed -- still selectable. **The header's tick
  selects or clears every model** (#358), tri-state so it reports the selection
  as well as changing it. It ignores the min-1 rule a row-click keeps: that
  rule stops a click on the last selected row from quietly leaving you unable
  to generate, while a control labelled "deselect all" says so out loud and is
  one click to undo. Zero is already handled -- `canGenerate` requires a model,
  so Generate goes dead, and the button's own "Generate 30 images" is what says
  how big an all-selected click has become. **Cmd/Ctrl-click a row solos it** --
  that model, everything else off. Same modifier as the grid's power moves and
  the same reasoning: a plain click toggles one row, which is the common case,
  and "just this one" was otherwise nine clicks off. Listed at `/account/shortcuts`
  alongside the grid's, which is where #289 put them. The panel used to clamp to
  the minimum across the selection, which **deleted staged images** when you
  ticked a smaller model
- **The grid never marks the set, and reaches it only through modifiers (#284).**
  Not buttons, deliberately: **Cmd-click a card adds that image to the set,
  Cmd-click its prompt loads that text** -- and nothing else in the panel
  moves. One image modifier, not two: Cmd-click used to replace slot 0 and
  Cmd-Shift-click push onto the rest, which distinguished nothing once the
  source slot was gone and made the wrong one the default -- clicking three
  cards left one image. The push goes on the _front_ (`pushRef` in
  `src/features/ai-images/ref-images.ts`, which is unit-tested), the opposite
  end from `addRefImages`: the gesture means "use this one", so the newest is
  the one a smaller model keeps. **Nothing is evicted and nothing toasts** --
  see the cap bullet above; gaining an image is its own feedback. The toast
  that reported an eviction outlived the eviction by five months and was
  removed in #473.
  **Neither shortcut names itself any more, and the card says nothing on
  hover.** They used to: "Add" over the image while Cmd was held, "Load Prompt"
  in place of the prompt's "Copy". Both went -- a two-word hover is the wrong
  surface for teaching a gesture, and it charged every ordinary hover for a
  feature most of them will not use. The gestures still work; explaining them
  is `/account/shortcuts`' job, a surface that can carry the explanation (#289). So
  "undiscoverable by design" means "not taught by the card", not "not taught
  anywhere" -- the card stays quiet and the page does the explaining. `CopyText`'s `silent` prop is what turns the hint off; the
  "Copied" tick survives it, because it reports rather than instructs. Both
  open the panel, because a power move whose
  whole effect is inside a closed panel has no feedback -- which was #284's
  reason for refusing a card button in the first place. There is no edit
  mode and no edit route -- the generator resolves the model's image-input
  endpoint from whether the set is empty, so "edit" is a detail of building the
  request. Explore's overlay used to offer a source pencil too; #271 removed it
  rather than have two answers to "how do I put an image in"
- **Selection is a mode, and the mode is the selection (#284, #325).**
  `selectMode` is not state -- it is `selection.count > 0`. **The tick in each
  card's bottom-left is on every card always, and clicking one is the way in**;
  Deselect all and Escape are the way out, because emptying the selection is
  the only thing leaving could mean. There is no toolbar toggle: it asked you
  to declare an intention before you could touch the picture you were looking
  at, and it was also the only thing saying selection existed. Once anything is
  picked the rest dim and the whole card is one target -- target size is why
  this is a mode at all, since the use that justifies selection is bulk and
  per-card circles make clearing twelve of sixteen twelve precise clicks on a
  small corner. **A batch action now leaves the mode**, reversing #284's rule
  that it must not: that rule protected a modal entry point, where after an
  auto-exit the affordance was gone and a click meant something different with
  nothing on screen saying so. The tick never goes away now -- select is the
  corner, open is the image -- so picking up again after a delete is the one
  click it always was. Selecting attaches nothing to the next generation; it
  used to feed `setAutoRefImageIds`, so looking through images changed what the
  next prompt was built from with nothing in the panel saying so. **Group,
  pending and failed cards are not selectable** -- only `ImageCard` takes the
  selection props, and a group's verbs are its own. **A group card is dimmed
  and inert while a selection is up**: it cannot join one, and `openGroup`
  drops the selection on the way in, so a stray click threw away the picking
  that was in progress. **The generator dock steps back the same way** (#326):
  faded, and its body `inert` rather than merely dimmed, since a panel that
  looks off but still takes clicks and Tab stops is a lie. Its header stays
  live so the gear is still reachable
- **Create reference sheet is a selection verb, not a group feature (#476).**
  It composites the picked images onto one black sheet and downloads it --
  nothing is stored, and there is no sheet object, no mode and no dialog. It
  lives in the drawer because groups are only one place a selection happens.
  The layout is `src/lib/justified-rows.ts` (pure, tested) and the compositing is
  `src/lib/server/reference-sheet.server.ts`, reached through
  `POST /api/reference-sheet`, which answers with the PNG itself. **Justified rows, not native
  sizes**: every row is exactly the sheet's width and every image in a row the
  same height, so two pictures of the same shape come out the same size and the
  sheet has no black in it. Placing at source resolution instead made cell area
  a function of which model made the picture. **Cell count is the budget, not
  pixels**: a model downscales a reference before it looks at it, so the sheet
  is built at a 2048 long edge, a cell lands at about `2048 / sqrt(sum of
aspect ratios)`, and a bigger sheet would only squeeze the same detail
  harder. **Uncapped on purpose** -- V1 exists to find
  where a stitched sheet stops holding identity, and a guessed cap would make
  the guess untestable. **JPEG at quality 95, not PNG** (#482): the
  sheet is a photographic composite on opaque black, which PNG stored at ~9MB
  for twelve cells against ~1.1MB for JPEG -- and the app's own upload path
  could not take the 9MB one back, which is the download -> re-upload -> prompt
  loop the feature exists for. The cells composited in stay lossless; only the
  encode on the way out is lossy. **The file is named after the group** --
  `select-one-11imgs.jpg`, `reference-sheet-11imgs.jpg` outside one -- so two
  runs are compared by reading two filenames. The rule is
  `src/lib/download-name.ts`, shared with the selection zip; the group comes
  from the rows, not from the client, and a selection spanning groups has no
  single name. Cell
  size rides in the toast instead: it is read once on the way out, not
  something to sort a folder by. **An unreadable row is skipped, not fatal** --
  the library holds video, and a clip in the selection used to fail the whole
  sheet. Whether a sheet ever becomes a
  stored class is the interesting design and is deliberately deferred until
  this has been used.
- **Download zip is the second selection verb (#480).** It opens the same
  `ZipDownloadDialog` the group page uses, handed exactly what is picked, so
  six of an eleven-image group no longer means making a group of those six
  first. The group page keeps its own Download: wanting the whole group without
  picking through it is the common case. Its default name follows the reference
  sheet's rule -- `select-one-6imgs.zip`, `selection-6imgs.zip` outside a group
  -- but derives it in the browser from `activeGroup`, because the zip is built
  client-side from images already on screen and never touches a route. So a
  select-everything download and the group page's own download of the same
  images produce different names; the count is the part that says which.
- **Shift-drag sweeps a region into the selection (#440).** Only once select
  mode is on, which is what keeps a stray shift-drag from doing anything while
  you are just looking. Deliberately loose rather than a graphics-program
  marquee: the drag can **start on top of a card**, hitting is **intersection**
  (clipping a corner is enough), and it **only ever adds** -- precision is the
  thing the gesture exists to avoid, so `addMany` and not `toggle`. Shift-click
  still extends a range from the last card toggled; the two agree rather than
  collide, since both mean "add several" and one is a click. The hit targets
  are each card's `selectOverlay`, which is exactly the card's rectangle and
  exists only in select mode -- so group, pending and failed cards are never
  found and need no special case. `_hooks/use-sweep-select.ts` owns it, and two
  things there are decisions rather than details. **The rectangles are measured
  once, at drag start**, in page coordinates: the grid does not reflow during a
  drag, so re-measuring per pointer move would buy nothing and cost a layout
  pass a frame at a hundred cards. **Auto-scroll at the viewport edge is not
  implemented** -- a sweep covers one screenful, which is most sweeps, and it is
  the one thing that would invalidate that measurement. The marquee is drawn
  `position: fixed` outside the grid, because the grid carries `zoom` (#403) and
  a rectangle inside it would be scaled with the cards. The drag never calls
  `preventDefault` on the pointerdown -- that suppresses the browser's text
  selection and native image drag in one line, but it also risks the click, and
  a shift-press that never crosses the threshold has to reach the card as an
  ordinary shift-click; `selectstart` and `dragstart` are cancelled instead. The
  click that follows a committed sweep **is** swallowed, and the flag that does
  it is cleared by the next press as well as by the click it waits for: a sweep
  that ends where no click follows otherwise leaves it armed to eat an
  unrelated click later
- **Drag a thumbnail onto a group card to file it there (#438).** The picker
  dialog stays -- it is how you reach a group scrolled out of view and how you
  create one on the way -- so this is the shortcut for the case where the
  destination is already on screen. Drag one card and it moves alone; drag a
  card that is **part of the selection** and the whole selection comes with it;
  drag an **unselected** card while a selection is up and it still moves alone,
  because dragging a thing you are pointing at should move that thing rather
  than depend on state you are not looking at. `_hooks/use-drag-to-group.ts`,
  pointer events rather than HTML5 DnD -- native DnD's drag image is one
  element, which is wrong for "five pictures are coming with this", and the
  canvas already works in pointer events. Four things there are decisions.
  **A group card is inert to clicks during a selection and live to drops at the
  same time** (#325 dimmed it so a stray click could not throw away the picking
  in progress); the dimming lifts for the length of a drag, so what is
  droppable is visible exactly while there is something to drop. **A group card
  is never draggable** -- groups do not nest, so it is a destination only.
  **A press on a control does nothing**: `...`, the corner icon, the caption's
  copy button and the select tick are all excluded, and a press that never
  crosses five pixels reaches the card as an ordinary click. **Shift is what
  tells this apart from the sweep** -- one press, two gestures, decided by the
  modifier rather than by what it lands on. Scope falls out for free: inside a
  group the grid holds no group cards, so the gesture is top level only with no
  special case. The write is `addToGroup`, the same one the dialog calls -- there
  is no server work in this at all. `reorderImages`/`updateImageOrder` went with
  it: dead since drag-to-reorder was unwired, and leaving a corpse beside a live
  drag gesture is two answers to what a plain drag means. Manual ordering (#505)
  is a group-scoped resequence and will build what it needs
- **Inside a group, the same drag rearranges (#505).** The two gestures never
  run at once and do not need to be told apart: `use-drag-to-group` is armed
  only at top level, where there are group cards to drop onto, and
  `_hooks/use-drag-reorder.ts` only inside a group, where there is an order to
  make. Same five-pixel threshold, same excluded controls, same Escape, same
  swallowed click. **The insertion point is a gap, not a card** -- hit-testing
  which card you are over and swapping makes a long move a run of swaps; the
  gap is picked by which half of a card the pointer is in, and drawn as a rule
  down that card's leading edge (inside the tile, because `Thumbnail` is
  `overflow: hidden` and a line in the gutter is clipped away). **One card at a
  time**, even with a selection up: moving several into one place raises
  questions -- contiguous or not, in what order, what happens to the gap they
  leave -- that the asked-for gesture does not need answered. The index
  arithmetic is `moveTo` in `src/lib/reorder.ts`, extracted and tested because
  it is wrong in exactly one direction when it is wrong: a gap past the card's
  own place shifts by one when the card is removed, and every leftward drag
  works either way.

  **Two facts, kept apart** -- whether an arrangement _exists_ (any member with
  a `group_position`, derived, never stored) and whether it is _in effect_
  (`image_groups.manual_order`). Collapsing them would make the way back
  destructive. So `OrderRow` -- `By date | Manual`, in `ScopeRow`'s slot and
  `ScopeRow`'s register, since inside a group there is no origin scope --
  appears only once an arrangement exists, and switching to By date keeps every
  position. **The first drag is what turns it on**; there is no mode to declare
  first, which is #284's rule about touching the picture you are looking at.
  While Manual is in effect the toolbar's newest/oldest control is not drawn,
  because a direction has nothing to order.

  **`group_position`, not `sort_order`.** That column is the _library's_ order,
  and a group card sorts among the top-level thumbnails on its newest member's
  `sort_order` (#324) -- writing an arrangement into it would move the group
  card around the top-level grid every time you rearranged the inside of the
  group. **Nulls sort last, and that is the whole of "a new image goes to the
  end"**: none of the three paths that put a row into a group writes a position,
  a never-arranged group is all nulls and therefore chronological as before, and
  the next drag numbers everything including the new arrivals

- **A click opens the viewer, and #308's in-place preview is gone.** For three
  days the click turned the grid area, and only the grid area, into one large
  image -- toolbar still there, no scrim, hidden click zones in the outer
  quarters to page. The theory was that an overlay covering everything costs
  nothing while _browsing_ and buries your work while _working_, so a working
  surface should preview in place. Using it produced the opposite result: the
  UI left visible cannot act on the image you are looking at, so it offers
  actions unrelated to what is on screen and you lose the picture's full
  attention as well. The scrim is not decoration -- it is the sentence "you are
  looking now, not working," and leaving it out was the mistake rather than a
  detail to tune. The hidden zones failed the same way: a target that reveals
  its chevron only once you are inside it confirms rather than affords.
  `_components/experiment/` is deleted; do not rebuild it without a new reason
- **The viewer is `_components/image-viewer/`, and it is nothing to do with
  Explore's overlay.** A plain lightbox: scrim over the app, the picture
  centred, chevrons either side, an X, a counter, click outside the image to
  dismiss, arrows and Escape. **No prompt, no filmstrip, no metadata** -- "show
  me this bigger and let me move through the set" is the whole job, and
  anything proposed for it should have to answer why it is not a card action or
  a route. Delete and Backspace send to Trash, which is the one thing this has
  that Explore's does not. **`H` hides and moves on** (#545) -- the card's own
  pairing (#504) reaching the surface where the judging actually happens, since
  until then the only verb in here was the destructive one. Both are also
  buttons on the picture's lower-left: key-only would have left the destructive
  verb as the only _visible_ one, which is the inversion #504 removed from the
  card. `actAndAdvance` in `use-image-viewer.ts` serves both -- the cursor moves
  _before_ the act, because either one shrinks the list under it. A bare letter
  is safe because the viewer holds no text field. Listed at
  `/account/shortcuts`, in the same commit as the binding.

  Explore's `image-detail/` is the three-column one (image, prompt, filmstrip)
  and is **not shared, not imported, and not to be renamed toward "lightbox"**.
  The single name cost two rounds of the same mistake: it lived here as
  `_components/lightbox/`, so a request for a plain viewer on /images found one
  already in the tree and got a prompt column and a filmstrip with it. Two
  components, two routes, no dependency in either direction. `#/components` is
  the wrong destination for both -- they only look like one thing.

  Same for the cursor. `_hooks/use-image-viewer.ts` is a near-copy of Explore's
  `use-image-detail.ts`, on purpose: ~40 similar lines is cheaper than a shared
  hook that decides for both surfaces, which is exactly how the layout got
  imposed the first time.

  **It cycles what the grid is showing** -- filtered, sorted, and scoped to the
  open group if there is one (#270). "Next" has to mean the next picture on
  screen; a viewer over a different list sends you somewhere you were not
  looking. Group cards are not stops in the sequence, only images.

  **Traversing into groups from top level is a stated non-goal.** At top level
  a group is one card, so the viewer skips its members entirely -- that is
  correct, not a gap. Making the sequence descend into groups would mean the
  overlay browses a list the grid is not showing, which is the one rule above,
  and it turns "click a thumbnail, see it bigger" into a way of digging through
  the whole library. That is a different feature and it belongs to Explore.
  Leave this alone until the friction is real

  Gutters are one custom property, `--viewer-gutter`, equal on all four sides.
  Tune that rather than a single edge -- the first pass had a thin top and
  bottom against wide sides, which pinned tall images to the chrome. Paired
  with `min-height: 0` on the stage, which is what makes "the image always fits
  the viewport" true rather than nearly true

- **`initial` is a seed, not the source of truth.** `use-gallery.ts` owns the
  list after the first paint, and the FAL poll is the only signal that anything
  changed -- nothing pushes (#174). The poll is
  `features/ai-images/hooks/use-generation-poll.ts`, shared with Video and
  Activity, and it backs off, sleeps with the tab and gives up on work FAL never
  answers for (#327)
- **A pending card is the card it will become, minus the picture (#367).** The
  badge is the model from the first frame, the caption is what was typed, and
  the only thing that changes at settle is the image region. All three used to
  move: the badge renamed itself from "Generating...", and the caption grew the
  system-instructions preamble the row had stored as its prompt. Tile geometry
  was never the problem -- `aspect-ratio: 1 / 1` and a three-line clamp mean the
  card is the same size throughout -- which is exactly why the rest of the churn
  read as gratuitous rather than as loading. **Neither the badge nor the caption
  belongs to a card any more.** The prompt block is `_components/card-caption/`,
  rendered by the pending and the finished card alike -- written twice, it had
  drifted to a dimmer colour and a different size on the pending side, so the
  text you read while waiting changed when the picture landed.
  `PendingImageCard` has no stylesheet left. **The model badge is `Thumbnail`'s,
  one definition for all three states** -- a pending card put it in the caption
  and a failed one centred it under "Failed", so the one label you track across
  a generation moved on the way to both of its endings. The `...` menu needs no
  such gate: `ImageCard` renders only for `completed` rows (pending and failed
  have their own components, and `status` is constrained to those three), so
  gating Download on it would be dead code.
- **Trash on a generating card cancels it** (#369). It used to soft-delete the
  row and leave FAL running, which finished the picture, billed for it, and
  filed it in Trash -- from the one click that plainly means "I do not want
  this". The cancel is best effort and never fatal; the row goes either way,
  and it goes _outright_, on the same grounds as a failed one: there is no
  picture, so Trash has nothing to offer. A poll landing after the row is gone
  discards its result rather than orphaning the object.
- **A card's React key is not its id (#353).** A generation's card is born with
  an optimistic id and swaps it for its record id the moment the submit answers
  (#313). The id was the key, so React saw one card removed and a different one
  added, and destroyed a mounted tile to build an identical one -- measured at
  four remounts in a three-image burst, at the busiest moment in the app.
  `keyFor` in `use-gallery` remembers what each row's card was born as, so the
  id can change underneath it. The one remount left in that burst is
  `PendingImageCard` giving way to `ImageCard`, which is a real change of
  component and not a key problem
- **Paste is the only way a file enters this route, and it does both halves**
  (#491). `_hooks/use-uploads.ts` uploads the image into the library -- into the
  open group, if you are standing in one -- and then hands it to `pushReference`
  in `use-view.ts`, the same function Cmd-click on a card uses, so it lands at
  the front of the reference set with the panel open. A screenshot pasted here
  is almost always about to be generated from; making that two gestures was the
  friction. It gets a blob preview immediately, being one image the user is
  holding in mind. Choosing a file from disk belongs to the library picker
  inside the panel (#489)
- **Where an upload lands depends on where you are (#348, #350).** At top level
  a pasted image lands loose; inside a group it lands in the open group, with no
  dialog -- a group is a focus session, and asking which group you meant while
  standing in one is ceremony. **A destination is set at insert, not by a write
  afterwards.** `createImageRecord` takes the group id and resolves it through a
  subquery that names the user, so a guessed uuid lands the upload loose rather
  than in a stranger's group. Filing the batch after the fact -- one
  `addImagesToGroup` for the lot, which was the right instinct about round trips
  -- meant every thumbnail appeared at top level and was pulled out again a
  moment later. A row born in the group is never loose, so there is nothing to
  render and nothing to retract, and the optimistic card carries the same
  `group_id` from its first frame
- **The origin scope is back, on a row of its own (#444).** #348 removed the
  pills on the grounds that a group is the only scope worth having, and that
  held for everything except one question a group cannot answer: **"show me my
  uploads"**, wherever they sit. The workaround was a hand-made group called
  Uploads, which decays the moment you upload again, because new uploads land
  loose. So: `All | Generations | Uploads`, top level only, **under the toolbar
  rather than in it** -- a scope is a statement about what you are looking at,
  not an action, and sitting among the buttons is part of why the old pills read
  as one more control. **It is a caption, not a control**: a hairline across the
  width, the three words at the right end at the chip type size, and the current
  one simply lit. Not `SingleSelect` -- its segmented pills carry the weight of
  something you press, and three filled chips above the wall compete with the
  pictures, which is the one thing a gallery's chrome must not do. Ink is the
  whole selected state, and nothing bolds: a weight change would shift the other
  two along the row each time the scope changed.
  **Uploads ignores grouping entirely** -- every upload, grouped or not, and no
  group cards, because there is nothing left for them to stand in for. The other
  scopes filter what is loose, since the group-card collapse is the payoff at
  top level. Inside a group there is no scope control at all: the group is
  already the scope, and two stacked scoping controls only ask which one wins.
  Filtering is client-side -- the gallery holds every row and `origin` is
  immutable. The row reads `Generations | All | Uploads`: the work first,
  everything second, the material you went and got last. **All is the safety
  net rather than the head of the row** -- it is the only scope where a _loose_
  upload is visible in the working view, so it stays even though it and
  Generations look alike whenever almost everything is grouped. The stored
  choice survives a refresh, so the default is only ever seen on a fresh
  profile; it matches the first pill so the two agree. `revealAll()` replaces the old `reveal()`: making something is an
  implicit request to see it, so an upload or a submit widens the scope to
  `all` rather than switching to the matching one -- widening never takes away
  what you were looking at. A stored scope is validated against
  `ORIGIN_FILTERS` on read, keeping #348's real lesson: a scope the control
  cannot show would apply with nothing on screen to undo it. Cmd-F find went in
  #348's pass and is still parked in #347
- **Thumbnail zoom is `zoom` on the grid, and the stops are measured, not
  chosen (#403).** ⌘⌃+/- walks a fixed list — 50, 60, 75, 100 — because the
  grid is `auto-fill` over a 200px minimum, so a step only reads as a change
  when it crosses a column-count threshold, and those are not evenly spaced. An
  even 10% left three consecutive stops on four columns, two of which did
  nothing. The stops were found by walking the range with a temporary readout;
  they suit a real window width, and a wildly different one would want
  different numbers. `zoom` rather than `transform: scale()` (which does not
  affect layout, so no extra card ever fits) and rather than a variable column
  width (which leaves the caption at its old size, so the text re-wraps and the
  card stops being the same card). Not `thumbSize` returning: that was three
  named sizes with three card treatments behind a dropdown (#284)
- **Two localStorage namespaces.** `genzen:ai-images-prefs` holds sort and info
  as one object -- `read()` picks fields out rather than spreading, and
  `usePrefs` rewrites the key on mount, so `thumbSize` (dropped in #284) and
  `originFilter` (dropped in #348) do not live on as settings that appear to
  exist. A stored scope nothing renders would be worse than dead weight: it
  would apply with no control on screen to undo it; the generator's
  open flag is an older single-value key, and its `pinned` twin is now dead
  storage that nothing reads. Every write-through waits on `usePersistedState`'s
  `hydrated` flag, or the fallback lands on top of the stored value on mount
- **`on_canvas` is no longer derived, and no longer shown.** It used to come
  per read from an `exists` over `canvas_images`, never stored -- the boolean
  column of that name drifted from the membership rows that are the truth and
  went in #205. The card carried an "On canvas" marker for it (#216, so
  trashing an arranged image was not a surprise); the marker went in #314, on
  the grounds that the card is crowded and the warning was not paying for its
  space. #330 then took the subquery out too: every read of the library was
  paying an index probe per row for a value nothing read. `SavedAiImage.on_canvas`
  stays on the type as the seam -- the surface that wants it again reads it for
  the rows it renders, rather than the whole library paying in advance
- **A group is this view with a filter, and that is the whole constraint
  (#319).** `?group=<id>` -- same `view.tsx`, same toolbar, same cards. Not a
  route segment and not a component of its own, because #204's grouping died
  from exactly one small permission: that the group view could look different.
  A second panel followed, then a second selection state, then two sidebars.
  The test for anything proposed here: **does it only make sense inside a
  group?** Then it is the same mistake -- editing, comparing and promoting a
  hero image belong to images, not to groups. Two mechanisms only: membership
  (`user_images.group_id`, exclusive) and an active scope (the filter, plus
  `groupId` on every generation submitted while one is open). Top level shows
  **group cards in place of their members** -- if members also appeared loose
  the wall would be as tall as before, which is the entire payoff. **A group
  card sorts among the thumbnails on its newest member's `sort_order`** (#324),
  so an active group sits with today's pictures and a finished one sinks past
  them. `listImageGroups` computes that key in the same units an image uses;
  `use-view` merges both into one `GalleryCell[]` before the ascending toggle,
  because two lists reversed separately stop interleaving. Group cards used to
  render as their own block ahead of every image, which pinned a group finished
  months ago above everything made since. Exclusive
  membership is a column rather than a join table for that reason: two groups
  would make an image vanish from top level twice. **There is no origin
  filtering inside a group** -- the group is already the scope. Groups do not
  nest. **The writes live in `src/features/groups/`, not here** -- they were
  this route's `_actions/` until Video became a second consumer (#517), and
  `kind` now keeps the two namespaces disjoint, so nothing on this route can
  see or join a group of clips. `GroupHeading` and `GroupPickerDialog` moved to
  `app/(authenticated)/_components/` in the same change; `GroupCard` did not,
  because Video draws its own. Every write **returns what it changed** (#331): the affected group summaries, the images
  whose `group_id` moved, and the ids a group trash soft-deleted. That is still
  server truth rather than client arithmetic -- a write moves a cover, a count,
  a preview strip and a grid position at once -- but it costs one round trip
  instead of three serialised ones, so the group card and the grid move in the
  same tick. `use-groups.ts` patches its list from the response and hands it to
  `use-view`, which patches the gallery's half; membership is a column on the
  image row, so there is nothing to re-read. **Only the cheap half is
  optimistic**: filing pictures moves them out of top level on the click, and
  the new cover and count arrive with the response. A failed write toasts and
  re-reads both lists rather than unwinding a patch
- **The group card never asks for a cover, and Add to group is never a
  submenu.** Both are the same lesson: the previous grouping was abandoned
  because creating one was a chore. Creation asks for a name and nothing else;
  the cover is the newest member, frozen, overridable from an image's own `...`
  and falling back to the newest remaining member when it is trashed. `Add to
group` opens a dialog because a flyout of names commits you to picking one at
  the moment you are most likely to notice the group you wanted does not exist
  -- the dialog has a Cancel and offers `New group...` in the same list, and
  skips straight to naming when there are no groups yet. The card carries no
  "Group" label: the swatch strip reads as texture at a glance, a label is text
  to parse
- **The swatch strip is feedback, not portraiture -- but never a loading state
  (#350).** Nobody picks those five: they are "what is happening in here
  lately", ordered newest-first. The cover is the curated one, which is why it
  freezes and the strip does not. Two consequences. The strip shows pictures
  only -- a row with no `storage_path` used to take the newest slot and render
  as a filled swatch of nothing. And **work in flight is not in the strip at
  all**: a pending slot re-composed all five cells twice per image, in the
  middle of a grid that is already swapping optimistic cards for real ones. The
  card says ", 3 working" in its caption instead, where saying it moves nothing,
  and the pictures change once, after the work is done
- **A group's work-in-flight is counted on the client, never read from the
  server.** `use-view` already holds every row, so it is arithmetic on state in
  hand. A `pending_count` on the summary looked cheaper and was not: it made
  every settle a reason to re-read the groups, and each of those is a server
  action that re-renders the whole route. The summaries are re-read **once per
  burst** -- when a group's in-flight count reaches zero -- because that is the
  only moment the strip has something new to show. It counts pending rows and
  nothing else. A parallel count of uploads-in-flight, keyed by destination, went
  with the toolbar's Upload (#491): a paste only ever targets the group you are
  already looking at, where the card itself is on screen
- **Clicking the swatch strip grows it through the whole group (#352).** The
  strip keeps its five columns and its first row; the card just gets taller,
  five across, for as many rows as the group needs, at one even gap in both
  directions so it reads as a single grid. Strictly additive -- the
  five you were looking at do not move, more appear beneath them -- which is
  why the cover stays excluded in both states. The strip is the toggle rather
  than the card, because looking at what is inside and going inside are
  different intentions. **Offered only when something is hidden**: a group of
  five or fewer is already entirely visible, so its row stays a plain div and
  the click still opens the group instead of being a dead control. Any number
  of groups can be open at once -- an expanded strip changes nothing else's
  width, so it costs the others only the distance they move down. `.grid` is
  `align-items: start` for the same reason: stretching gave three ordinary
  cards a tall grey foot to match one expanded neighbour. **The ids are fetched
  on open** -- `preview_image_ids` stays capped at six because it rides on every
  group write (#331), so a fifty-member group would put fifty uuids in the
  payload of every rename and every refresh to serve a strip that is usually
  collapsed. Cached per group, dropped by any write touching it, and the slots
  are held at `count` while the read is in flight so the card reaches its final
  height once
- **Move to group empties a group into another and drops it.** Membership is an
  exclusive column, so it is one update and a delete -- no new write plumbing,
  and `GroupWrite.gone` already carried the vanished group. Named for the images
  rather than "Merge", because that is what moves. The destination picker
  excludes the source and offers no `New group...`: moving a group's contents
  somewhere that does not exist yet is a rename. The source's frozen cover is
  discarded and the target keeps its own -- re-covering the destination would
  silently undo a choice someone made
- **You can only trash a group from inside it** (#431). The card used to carry
  a trash icon in the same corner an image card carries one, in a grid that
  mixes the two -- so the click that bins a whole group was available from the
  one view showing least about what is in it. It is a labelled control in the
  toolbar now, alongside the way out, where you are looking at the contents
  when you press it. The card's `...` keeps Rename, Move and Ungroup, none of
  which destroy anything, which also leaves the two kinds of card legible at a
  glance: one overlay icon on a group, two on an image.
- **Entering a group changes the shape of the page** (#432). The name is an
  `<h1>` above the thumbnails -- a blog post's title over its own post -- with
  a round back button beside it, and the whole heading is the target: an
  icon-only control is small for the commonest gesture in a group, and the name
  is what you are leaving. One toolbar control used to be both the title and
  the navigation, and a thing that is mostly telling you where you are does not
  read as a button: the name sat at the size of the pills beside it, so opening
  a group looked identical to the top level. **The toolbar has no crumb at
  all** -- one there pushed Upload right on the way in. Nothing moves and
  nothing hides; a heading arrives where there was none.
- **Trashing clears `group_id`, on all three soft-delete paths.** Restore has
  one destination, always. Restoring into a remembered group sounds tidier and
  fails worse -- the image is not where you look for it and nothing on screen
  says why, so it reads as a failed restore. Consequence: a trashed image is
  already not a member, so no group read filters `deleted_at`. Trashing a group asks first
  and then trashes the members, which is safe to offer only because Trash is
  the way back; `Ungroup` is the twin that keeps
  every picture -- named that rather than "Dissolve", which sounds like the
  images go with it. The trash itself is the toolbar's since #431
- Failed generations delete outright rather than soft-delete, so they never
  reach Trash -- see `src/features/ai-images/CLAUDE.md`

**The generator does not float.** It is open, pushing the gallery over, or it
is closed. Unpinning bought the gallery back 20rem while covering the right-hand
column of thumbnails with the panel, so the images it revealed were the ones it
hid -- and it cost a dismiss layer plus `.inset` padding on the toolbar, which
existed only so the tools were not underneath it (#207).

**The toolbar toggle is the only way in and out** (#345). The panel's own X went
with it: an X on something the sidebar toggles reads as "discard this" rather
than "collapse this", and there is nothing to discard, since the prompt and the
staged set survive either way. One switch going both directions. The mobile
full-screen variant keeps its X, because it covers the toolbar that would
otherwise close it.

The panel's header carries the title and the system-instructions gear. **Every
surface that renders `GeneratorPanel` must render that gear** -- the Images dock,
its mobile variant, and the Canvas dialog. It used to live inside the panel so
that was structural; it is now a rule, and the failure it guards against is
silent: a prompt prefix applying to generations with nothing on screen saying so.

Vertical spacing in the panel is one knob, `--panel-rhythm` on
`generator-panel.module.css`'s root, inherited by `PromptList` and
`ModelSelector`. Change that rather than spot-fixing a gap -- three components
each picking their own is how it drifted to 12/8/4.

## Not here

**Enhance, Describe and Variations are in the lab** (`app/(authenticated)/lab/`,
#424). They were dialogs on this route and could not be improved there — a
dialog holds "type, get one result, close" and nothing more. They come back when
they work the way they are supposed to, and until then this route behaves as
though they never existed.
