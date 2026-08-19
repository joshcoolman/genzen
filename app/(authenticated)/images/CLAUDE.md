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
  missing: restoring an image is a deliberate act.
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
  ordered set of zero to N **Reference images**, filled from the library and
  from nowhere else. Index 0 is the only asymmetry left: the aspect ratio is
  derived from it, and it is submitted first. **Upload happens in exactly one
  place, the toolbar's Upload icon**, and picking from the library in exactly
  one, the widget. The panel's own upload used to take a single file and
  silently make it the source, so "put these in my library" also repointed the
  generator with nothing saying so. The cost is that upload-and-immediately-use
  is two gestures now; `reveal()` widens the scope to wherever the file landed,
  so the second is a click rather than a hunt
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
  cards left one image. The push goes on the _front_ and evicts the last
  (`pushRef` in
  `src/features/ai-images/ref-images.ts`, which is unit-tested), the opposite
  end from `addRefImages`: the gesture means "use this one", so a full set has
  to make room rather than refuse. Only the eviction toasts -- gaining an image
  is its own feedback, losing one is not. At capacity 1 every click evicts,
  which is correct, and is why a single-image model hides a wrong binding here.
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
  that Explore's does not.

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
- **A paste previews, the file picker does not.** A paste is one image the user
  has in mind, so it gets a blob preview immediately; the picker takes many at
  once and previews would land in upload order, so the cards would appear to
  shuffle. Both paths are `ingest()` in `_hooks/use-uploads.ts`
- **Upload is the leftmost control, and where it puts things depends on where
  you are (#348).** At top level it is a menu: _Upload_ lands loose, _Upload to
  group_ picks a destination first, leaving you at top level with a toast
  naming the group. **Inside a group there is no menu** -- it goes straight to
  the file picker and the files land in the open group, and a paste does the
  same. That is a deliberate exception to "one way to do things": a group is a
  focus session, and asking which group you meant while standing in one is
  ceremony. The menu is also absent with no groups to pick from.
  **A destination is set at insert, not by a write afterwards (#350).**
  `createImageRecord` takes the group id and resolves it through a subquery
  that names the user, so a guessed uuid lands the upload loose rather than in
  a stranger's group. Filing the batch after the fact -- one
  `addImagesToGroup` for the lot, which was the right instinct about round
  trips -- meant every thumbnail appeared at top level and was pulled out
  again a moment later. A row born in the group is never loose, so there is
  nothing to render and nothing to retract, and the optimistic card carries
  the same `group_id` from its first frame
- **The gallery has no origin filter, and no find (#348).** Pills scoped it by
  `origin` until working with them on All made the point: a group is a scope you
  made on purpose, and it is the only one worth having. `reveal()` went with
  them -- it existed only so a card you just made was not filtered out of the
  view you made it in. The `origin` column stays; Activity reads it. Cmd-F find
  went in the same pass and is parked in #347
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
- **`on_canvas` is still derived, and no longer shown.** It comes per read from
  an `exists` over `canvas_images`, never stored -- the boolean column of that
  name drifted from the membership rows that are the truth and went in #205.
  The card carried an "On canvas" marker for it (#216, so trashing an arranged
  image was not a surprise); the marker went, on the grounds that the card is
  crowded and the warning was not paying for its space. The read is left in
  place because it is a cheap subquery and the fact is still true -- the seam
  to show it again, here or in Trash's link badge, is `SavedAiImage.on_canvas`
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
  nest. `_actions/groups.action.ts` owns the writes, and **every one of them
  returns what it changed** (#331): the affected group summaries, the images
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
  only moment the strip has something new to show. Uploads are counted from
  their destination rather than from the rows: a file on its way up has no
  `group_id` until its row exists, so the destination is what is counted while
  the bytes are going up -- without it the one kind of work the card could not
  see was an upload aimed at it
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
- **Trashing clears `group_id`, on all three soft-delete paths.** Restore has
  one destination, always. Restoring into a remembered group sounds tidier and
  fails worse -- the image is not where you look for it and nothing on screen
  says why, so it reads as a failed restore. Consequence: a trashed image is
  already not a member, so no group read filters `deleted_at`. The group card's
  own delete icon asks first and then trashes the members, which is safe to
  offer only because Trash is the way back; `Ungroup` is the twin that keeps
  every picture -- named that rather than "Dissolve", which sounds like the
  images go with it
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
