# Lab

Where a feature is worked on before it is part of the app (#424). Enhance
compares prompt rewrites; Frames, Sequence and Lighting test mechanisms before
they earn a place in the main workflow.

## Sequence

Clips made by Continue (#494) are meant to be watched as one thing and there was
no way to watch them as one thing. Its question: **does the order actually cut
together?** Nothing is generated and nothing is stored — pick clips, drag them
into order, click one to watch from there.

- **Two `<video>` elements ping-ponging, not one swapping its `src`.** The
  visible one plays while the next loads hidden; at `ended` they swap which is on
  top. The join has to be free of a stutter, because the join is the thing being
  judged — one element reloading blanks for a beat at every boundary and the page
  would lie about the answer. The idle one is hidden with `opacity`, never
  `display` or `visibility`, either of which lets a browser stop decoding.
- **The row is the transport, and there is no bar under the player** (#655).
  Clicking a thumbnail plays the run from that clip's first frame — absolute
  where Previous/Next were relative, and aimed at the tile you are already
  looking at. The stage toggles play/pause; the run loops, so Start over is a
  click on tile 1; adding the first clip starts the run. Only Mute is left,
  because it is the one control no thumbnail click can reach. Click and drag
  need no disambiguating — a browser fires no `click` after a completed drag.
- **The run survives navigation; nothing else about the page does** (#659).
  Its clip ids live in `sequence/last-run.ts`, and everything about a clip is
  read off the library row as it is now -- so a clip renamed elsewhere shows
  its new name, and one trashed from Video drops out of the run rather than
  sitting in it pointing at nothing. Clear is a real button for this reason: it
  was a text link when a run was gone by the next visit anyway, and it is now
  the only way to empty one that will still be here tomorrow.
  A restored run tries to autoplay and a browser may refuse -- nobody clicked
  and the sound is on -- so `NotAllowedError` leaves the stage stopped instead
  of showing Pause over a still picture.
- **A pencil on a tile names the clip** (#657), and the name is the clip's own
  `title` -- so a run arranged here shows up on the Video wall as "intro",
  "scene two". The run itself is still not stored; a name is a fact about a
  clip, not about the arrangement, which is what keeps this inside the
  no-lab-state rule. It writes through `updateImageMeta`, optimistically, and
  the run keeps playing behind the dialog.
- **No scrubber, still.** A `<video>`'s native bar knows only its own clip, so
  it would read 0:00-0:06 of whichever one is showing and reset at every join. A
  scrubber of our own is worse: one that spans clips needs a global timeline,
  and a global timeline is what turns this into an editor.
- **It looks like a timeline and is not one.** Equal-width tiles whatever the
  clip's length; no ruler, no playhead, no trims. The question is arrangement,
  not pacing. Proportional widths are one multiplication away —
  `duration_seconds` is already on the row — and deliberately not taken.
- **A correct order is visible before you press play.** In a Continue chain each
  clip opens on the frame the one before it ended on, so the tiles rhyme; a tile
  that does not resemble its left neighbour's ending is misplaced.
- **Each tile is two frames: what the clip opens on and what it ends on**
  (#512). One frame per clip asked you to hold the previous ending in your head,
  which is the one picture that was never on screen. With both, clip N's ending
  sits directly beside clip N+1's beginning and the cut is a thing you look at
  rather than remember. The gap between tiles is wider than the seam inside one
  on purpose — one is a cut, the other is a clip's own middle skipped, and a row
  where those read the same is a strip of frames with no joins in it.
- **The picker narrows to the run's shape, and only Sequence asks it to.** Clips
  of different aspect ratios cannot cut together at all, so the first clip picked
  sets the shape and the dialog then offers what matches — with the count it hid
  and the way back on screen, because a run whose shape you are still choosing is
  a real state. `matchRatio` is a prop the caller passes; Frames picks one clip
  out of the library and has no run to match.
- **A jump lands on a clip and plays it.** Judging the third join by watching
  from the top is most of a minute spent on two joins already settled. It costs
  the gapless swap — the idle element is holding the clip that follows, so a jump
  anywhere else loads a fresh source and blanks for a beat. That is the right
  trade: a jump is a move _between_ cuts, never one of the cuts being judged. On
  the last clip the idle element holds clip 0, so the loop point — the join you
  see most while arranging — is gapless like the rest.
- **`lab/_components/` is what a second page wanted whole.** The clip picker
  went there when Sequence wanted the dialog Frames had; `clip-frames/` — a
  clip's first and last frame side by side — went there when the picker wanted
  what the run drew. The bar is two pages, and a copy under one page's
  `_components/` is the same thing drifting into two.

## Frames

It answers a question about a mechanism rather than about prose, which is why it
is one of the two pages with no instruction file to name (Sequence is the other) — `LabPage`'s `instructionFile`
is optional for it, and printing an empty one would say there is a file to go
and edit.

Its question: **does seeking land on the frame you stopped on?** A `<video>` may
seek to the nearest keyframe, and whether that is good enough decides whether
anything more precise is worth building. Deliberately unanswered up front — it is
the kind of question the lab exists to settle by use rather than by argument.
**Since #499 there is something more precise to build**: ffmpeg is in the app and
can be asked for an exact frame. That does not answer the question, it just means
a "no" now has somewhere to go.

- **The capture happens in the browser, on a canvas, and the mechanism is no
  longer this page's** (#494). `captureFrame` and the stamp action moved to
  `src/features/video/` when Video's Continue wanted the same thing — this page
  imports them like any other app module, which is the allowed direction. The
  frame wanted is the one on screen — wherever the player was scrubbed to — so
  it has to happen where that frame already is. `toBlob` is only allowed because clips come
  from `/img/[id]`, our own origin, so the canvas is not tainted — a clip served
  from FAL's URL would throw. `videoWidth`/`videoHeight` _is_ the clip's aspect,
  so nothing computes one.
- **A pasted YouTube link is the second source, and the browser owns the time
  while the server owns the pixels** (#613). A YouTube embed is a cross-origin
  iframe: it gives up `getCurrentTime()` and never a pixel, so the canvas
  capture above is impossible against it. It does not need to be possible — the
  player reports where it stopped, `yt-dlp -g` resolves the same video to a
  stream URL, and ffmpeg seeks it with `-ss` **before** `-i`, which
  range-requests only the bytes around that timestamp instead of decoding from
  the start. Everything after the pixels — the library row, the stamp, the grid,
  the trash — is the same code both sources run.
  - **Development-only, and it throws rather than hiding.** `yt-dlp` is a system
    binary the deploy does not have and would have to keep updated against
    YouTube's changes. The button is there in production and says
    `only works under \`pnpm dev\`` — Lighting's Save is the precedent, and a
    capability that silently does not exist is worse to meet than an error that
    names the reason.
  - **Nothing about the video is kept.** No clip row, no bucket object, no entry
    on the Video wall. That makes `frame_source` the only record a YouTube frame
    has of where it came from, so the stamp carries `youtube_id` where a clip's
    carries `clip_id`.
  - **Only the eleven-character id crosses to the server**, re-checked there.
    It is the one caller-supplied value reaching a subprocess argument list.
  - **The source strip is never behind the empty state.** A YouTube video needs
    no clips of your own, so gating the page on owning one would hide the only
    source that does not require one from exactly the account most likely to
    want it.
  - **Both ways in stay on the strip, labelled.** A YouTube video used to take
    the clip tile's place, leaving no route back to your own clips once a link
    was pasted -- the row read as if YouTube were the only source the page had.
- **A frame is saved as an upload**, which is the honest classification: it was
  not generated by a model, it was cut out of something that was. It appears in
  Images for free, and being usable as a reference image immediately is half the
  point of pulling one.
- **Both deletes trash rather than destroy**, through `deleteGalleryImage`. A
  wrong click on Clear is recoverable and nothing here reaches outside the page
  irreversibly.
- **The clip picker is the app's image picker's shape, rebuilt here.** Same
  dialog, same tiles, same footer counter, same plus button on a strip — because
  picking a clip should feel like picking a reference image. It is not
  `ExistingImagePicker` with a flag: that renders `Thumbnail`, which is an
  `<img>`, and an mp4 in an `<img>` is the broken-file icon. Teaching it video
  means a media element inside the primitive every still renders through, which
  is what `MediaBox` exists to avoid (#398), landing across Images, Canvas and
  Video to serve one lab page. Its source filters mean nothing for clips either.
  `max` defaults to 1 and nothing assumes it — several clips at once is a
  number, not a rewrite. **The tile swaps the clip rather than removing it**,
  and the choice is remembered across visits: removing was the only way back to
  the picker for a while, so changing clips meant watching the page collapse to
  a plus button and grow a player back. Tiles are `contain`, not `cover` — a
  square crop of a 720x1280 clip is the middle band of it, so a portrait clip
  and a landscape one from the same prompt became two tiles of the same
  background and one read as missing from the dialog. If this proves out, the real generalisation gets
  designed against two consumers instead of a guess.
- **The grid is this session's extractions, not a query.** Persisting it would
  need a way to ask for "frames", which needs a marker the library query knows
  about, which is the schema this folder may not grow. The frames themselves
  survive in Images; only the run is lost, same as every other page here.

## Lighting is where an effect is written, not where one is applied

Applying is shipped: the Lighting dialog crosses staged pictures with named
effects (#563). Writing one was hand work with no surface at all. This page is
the conversion (#562) -- a reference photograph in, a lighting setup out, tested
before it is trusted.

Its question: **does this reference survive being turned into words?** A
picture is an inseparable bundle -- hue, direction, hardness, falloff and
background welded together, with no clause that peels one out -- and a word is
too coarse, because "gel lighting" names a family and a model hands back the
family's average. Prose that is neither is the only reusable form, and the only
way to know a piece of it is any good is to render it.

- **`derive.md` forbids naming a technique, and that is the mechanism rather
  than a style rule.** "Split gel" is a pointer; a model handed a pointer
  returns the average of everything the pointer covers. Forbidding it forces a
  sentence about where a light stood, which is the only thing another model can
  render. The same file forbids naming anything in the picture, for the reason
  `src/lib/prompts/lighting/index.ts` paid for: an effect that mentions a cheek
  is dead on a truck.
- **Two test subjects, a face and an object, and the second one is the
  point.** The issue asked for one canonical portrait. A portrait-only grid
  cannot show the failure this page exists to catch -- #566's split field passed
  on faces and returned flat colour rectangles on a truck, because the prose
  described a photograph instead of a lighting setup. A test whose inputs cannot
  show the failure reports success, which is worse than no test.
- **Four candidates, two per subject, and each one re-runs alone.** Four is what
  tells the failures apart: all four wrong is the prose, one or two right is the
  model being noisy, one column landing while the other does not is prose that
  described a picture. One candidate answers none of that, and re-deriving to
  get another draw would change the thing being tested.
- **It generates, and it stores nothing** -- the only page here that spends
  money. Every other generation in the app reserves a row, queues and is
  reconciled by polling; a candidate is a synchronous FAL call whose URL lives
  as long as the tab. A judging grid is thrown away by design, and four
  throwaway cards per attempt on the Images wall is a cleanup job. The cost of
  that is real and named rather than hidden: **these runs do not appear in
  Activity**, so the page prints the estimate before the press.
- **Save writes the repo, and only under `pnpm dev`.** Three files: the `.md`,
  its `LIGHTING_EFFECTS` entry, and the candidate you picked at
  `public/lighting/<id>.webp`, which is the picture the Lighting dialog puts on
  the tile. It started as a copy-the-text step and that was the wrong shape --
  the page had derived, tested and named an effect and then offered a clipboard,
  so the one moment it could have finished the job was the moment it stopped.
  **The result is a diff, not a deployment**, which is what makes writing files
  acceptable here: `git status` is the review and a bad effect is a
  `git checkout`. The deployed filesystem is read-only and ephemeral, so Save
  refuses there rather than half-working; authoring is the same local activity
  as editing one of these `.md` files by hand. The copy blocks stay behind a
  disclosure for exactly that case. A table is still not on the table -- that is
  the issue's second tier, and it waits for the day effects are user content
  rather than something we ship.
- **An id already in the registry is refused rather than overwritten**, and the
  fix is a different name, one field away. Overwriting would silently replace an
  effect other work may already be judging.
- **The test subjects are pinned in `localStorage`, not checked into
  `public/`.** Checked-in subjects are right for something that ships and wrong
  for a page whose first job is finding out which two pictures are good tests.
  Freezing the pair into the repo is the graduation step, once it has stopped
  changing.

## Quirks

- **Every page names the file that steers it.** `LabPage` takes an
  `instructionFile` and prints it, because the point of the lab is changing an
  instruction and seeing what happens. All of them are `.md` since #322 — a lab
  for tuning instructions is worthless if changing one means editing code.
  **Enhance names one file per card instead**, because it is steered by a set:
  a model with a `promptGuide` is enhanced by that file and a model without one
  by the shared `enhance-prompt.md`, so a single line at the top would be wrong
  for most of the grid under it (#465). `LabPage` still takes the prop; Enhance
  is the one page that passes nothing to it.
- **Runs accumulate; the input is shown beside the output.** Every question here
  is comparative — too verbose _than what_ — and the dialogs these replaced
  showed only the result, which is most of why they could not be tuned.
  `RunCard` also prints a character count, since "too verbose" is the commonest
  judgement and counting by eye is what nobody does.
  **Enhance compares across rather than down**: one press writes one card per
  selected model, all from the same words, so the comparison is the grid and a
  second press replaces it. `RunCard` grew a `note` for the file behind each
  card and a `placeholder` for one still out or failed — a card holds its place
  from the first frame, because results dropped in as they landed would reorder
  the comparison under the eye reading it.
- **Results are lost on navigation, deliberately.** (Frames included — its
  images persist in the library, its grid does not.) Storage is a decision worth
  making later; something half-persisted is worse than something honestly
  temporary.
  **Enhance is the exception, and it is a narrow one** (#465): its last run
  survives, in `enhance/last-run.ts`. One record, overwritten by the next press
  and emptied only by Clear — the shape `panel-handoff` already is, and not a
  history. That is what keeps the rule intact rather than bent: the objection is
  to something half-persisted, and one record is either entirely there or
  entirely gone. It earns it by being the page you leave to go and edit a `.md`
  and come back to, which is the whole loop.

  It is under `enhance/` rather than in `src/lib/` because one page writes it
  and the same page reads it. `panel-handoff` sits in `src/lib/` for the
  opposite reason — two routes hold opposite ends of it.

- **Enhance has a target, and one of them is not an image model.** The picker
  above the idea box chooses between the image lineup -- the original page, one
  card per model -- and a multi-shot writer from `src/lib/prompts/multi-shot/`,
  which turns three words into a shot-by-shot video prompt and answers with one
  card. **Duration and aspect ratio are controls** (#522), shown only for a
  multi-shot target, and their options come off the video model the writer
  names (`videoModelSlug` in that folder's `index.ts`) -- so the length offered
  is always one the clip can actually be generated at. They were read out of
  the prose until then, which looked cheaper and was not: the clip is submitted
  with a duration and a ratio as _parameters_ whatever the text said, so the
  script could be timed to 20s and generated at 6. The two values ride in the
  user turn as data; the prose about what to do with them is in the writer's
  `.md`, where a stated duration beats one mentioned in the idea text. A writer
  for another video model's dialect is still a new file plus an entry.
  The model selector is hidden rather than disabled for a multi-shot run: the
  instruction names the video model it writes for, so an image selection is not
  a choice taken away, it is not part of the question.
- **The lab may import from the app. The app may never import from the lab.**
  Reuse `RefImageStrip`, `ExistingImagePicker`, `useUserImages` freely — an
  experiment that hand-rolls its own is not testing its own idea. But the moment
  `images/` reaches back in here, deletion stops being deletion and becomes a
  refactor. Worth an ESLint rule the way `server-suffix.js` guards the
  `.server.ts` boundary; not written yet.
- **A lab page adds no migrations.** A folder deletes cleanly, a migration does
  not. Reuse `user_images` and stash anything needed in `generation_metadata`,
  which is jsonb and already an open namespace. Deliberately more awkward than a
  real schema: outgrowing it is what earns promotion out, and the migration is
  the ceremony of graduating.

  **`end_frame_path` (#512) is not an exception to that, and it is worth saying
  why, because it looks like one.** The column was wanted by Sequence and added
  anyway — but nothing lab-shaped is in it. It holds a fact about a clip, written
  at ingest by `fal-completion.server.ts` beside the poster and served by
  `/img/[id]?v=end`; delete this whole folder and the column, the extraction and
  the route all still make sense. The rule is about a lab page storing its own
  state, not about a lab page being the first thing to want something the app
  can give every clip. If the answer to "who writes this, and does it survive
  deleting `lab/`?" is the app and yes, it is not a lab migration.

- **The rail collapses, and `layout.tsx` is a shell around a client
  component.** The collapsed state lives above both columns — the aside narrows
  and the main widens together — so `LabShell` owns it and the layout renders
  only that. It is still a layout, which is the property worth keeping: the nav
  is not remounted on navigation and the active item does not flicker.
  Collapsed persists, because a rail you re-collapse every visit is one you stop
  collapsing. Collapsed shows each page's initial rather than an icon —
  experiments with no visual identity would each need an invented glyph that has
  to be learned, and an initial is already the name.
  `lab-shell.module.css` is a copy of `account/`'s, not a shared module. Same
  shape — a nav column beside the content, one entry in the app's rail, every
  path under it lighting that one item. A stylesheet two sections import is a
  thread to unpick when this folder is deleted.
- **`LabPage` caps at a reading width, and Enhance opts out with `wide`.** One
  stacked column of prose is the default shape here and a full-width line of it
  is a line you lose your place in. The cap is wrong the moment a page lays out
  its own columns: it then applies to the column _and_ its rail together, so the
  rail eats the reading width instead of sitting beside it — and collapsing the
  nav to gain space gains none. That was live for one build (#465).
- **Enhance puts its inputs in a right-hand rail**, the shape Images has and for
  the same reason: composing and reading are different jobs, and stacked they
  mean every run pushes the controls off the top. On the right, because the
  lab's own nav is already a left rail and two down one edge read as one
  confused one. 20rem matches the Images dock deliberately — the same job on two
  routes should not be two widths. The DOM keeps inputs first so a phone and a
  screen reader get them first; explicit grid cells put results first for the
  eye.
- **`/lab` redirects to `/lab/enhance`.** The rail entry has to point somewhere,
  and an index listing the same links the nav beside it already shows would be a
  page whose only content is a duplicate of its own navigation.

## Who tests what

**A lab page is verified in a session only to the point of "it is not broken"**
-- it renders, the controls are wired, a submit reaches the provider, nothing
throws. **Whether the output is any good is Josh's call.** That is the whole
reason these pages exist: the judgement is the work, and it needs the eye of the
person who knows what they were after.

Two things follow, both learned by getting them wrong on Outpaint (#441) --
a page that has since shipped into the app and been deleted (#528), which does
not date the lessons:

- **Do not spend real money proving a page works.** A render and a wired control
  cost nothing to check. If a live generation is genuinely needed, it is one
  image through one cheap model -- sixteen generations to confirm a button is
  not a test, it is a bill.
- **A test whose inputs cannot show the failure is worse than none**, because it
  reports success. Outpainting 16:9 frames to 16:9 asks the model for the
  picture it was already handed: every result comes back correct and the page is
  unproven. The sources have to differ from the target in the way the feature is
  about.

## Promotion

Director has been promoted to `/director` (#594). Its former Lab URL redirects;
the standalone route owns sessions, exports and the preserved Lab import.

A feature comes back into the app when it works the way it is supposed to —
Josh's bar: _"yes, this works 100% the way I would expect it."_ Worth writing
down per feature before the work, or it is a judgement relitigated each time. A
lab you only ever add to is the same staleness with a different address.
