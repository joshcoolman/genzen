# Lab

Where a feature is worked on before it is part of the app (#424). Seven pages
today. Three of them — Enhance, Describe, Variations — existed in `/images` and
none could be improved there. **Frames and Sequence are the other kind: things
the app has never been able to do at all**, built here first so they can be used
for real before anyone decides where they belong (#317, #497).

## Why these three are here

Each was a button that opened a dialog that closed. A dialog holds "type, get
one result, close" and nothing more, so that is exactly as far as each got —
then it went stale, got rediscovered, felt cumbersome, and was kept anyway
because the idea was good. The idea was never the problem.

**They are not a workflow.** They look composable and are not: each answers a
different question about a different input, which is why they are three pages
and not one surface with three buttons.

| page          | input      | the question                                        |
| ------------- | ---------- | --------------------------------------------------- |
| `enhance/`    | one idea   | Does a model's own instruction beat the shared one? |
| `describe/`   | an image   | Accurate without being padded or over-specific?     |
| `variations/` | 1-4 images | Does it understand my intent? Are the prompts good? |

**Variations takes up to four images** (#436), which is not a fourth question —
it is the same one asked of a combine: "make the result match the illustration
style of the image with the clouds" is intent like any other. Two things follow,
both worth knowing before editing the page:

- **The instruction file forks on how many images are in the run**, so the page
  prints whichever fork is live rather than a fixed path. `image-variation.md`
  tells the model it may describe only what changes; that is right for one
  picture and wrong for a combine, where naming what each one contributes is the
  whole directive.
- **The numbers in a prompt are a contract with `useGenerator`, not
  decoration.** A prompt saying "image 2" only means anything because the submit
  prepends `[Image 1, Image 2, ...]` — see `src/features/ai-images/CLAUDE.md`.
  That half lives in the app, deliberately: the lab does not generate, so a
  numbering contract it kept to itself would be one Images never honours. It is
  not lab code leaking outward, and moving it under `lab/` would break the
  feature silently.

## Sequence is not one of them either

Clips made by Continue (#494) are meant to be watched as one thing and there was
no way to watch them as one thing. Its question: **does the order actually cut
together?** Nothing is generated and nothing is stored — pick clips, drag them
into order, press play.

- **Two `<video>` elements ping-ponging, not one swapping its `src`.** The
  visible one plays while the next loads hidden; at `ended` they swap which is on
  top. The join has to be free of a stutter, because the join is the thing being
  judged — one element reloading blanks for a beat at every boundary and the page
  would lie about the answer. The idle one is hidden with `opacity`, never
  `display` or `visibility`, either of which lets a browser stop decoding.
- **Its own Play/Pause, and no scrubber.** A `<video>`'s native bar knows only
  its own clip, so it would read 0:00-0:06 of whichever one is showing and reset
  at every join. A scrubber of our own is worse: one that spans clips needs a
  global timeline, and a global timeline is what turns this into an editor.
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
- **Skip lands on a clip and plays it.** Judging the third join by watching from
  the top is most of a minute spent on two joins already settled. It costs the
  gapless swap — the idle element is holding `index + 1`, so a jump anywhere else
  loads a fresh source and blanks for a beat. That is the right trade: a skip is
  a move _between_ cuts, never one of the cuts being judged.
- **The clip picker moved to `lab/_components/`** when this page wanted it whole.
  Two lab pages share it; a second copy under another page's `_components/` is
  the same dialog drifting into two.

## Frames is not one of them

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

## Outpaint is the one that spends money

Widen a picture to a shape it does not have, without typing the prompt that
asks for it (#430). Everything else here costs fractions of a cent at Claude;
one press of this against four models is real FAL spend, and the page exists to
be pressed repeatedly while the instruction is tuned. So the estimate is under
Generate as it is on Images and Video, and each result card carries what FAL
charged — the one page built for experimenting cannot be the one place you
cannot see what experimenting costs.

- **It asks plainly, composites nothing, and that turned out to be enough.**
  The picture goes to the model with `outpaint.md` and the target ratio, and
  that is all — no canvas, no empty bars drawn for the model to fill, no crop.
  That was the open question the page existed to settle, and Josh settled it by
  use on 2026-08-19: portrait sources to 5:4 and to 1:1 both came back right.
  **So the compositing alternative is not needed and should not be built
  speculatively** (#317 proved the browser could do it; nothing has asked it
  to).
  Worth knowing for whoever edits the instruction: any ratio change has two
  valid answers, pad or crop, and the `.md` commits to padding and forbids the
  other outright. It is written entirely in the language of growth, with no
  clause for a target that is smaller in some dimension — that gap was looked
  for and did not show up in results, so it stays as it is.
- **Multi-select models, because there are two questions in one press.** Is the
  instruction good, and can this model outpaint at all? A smeared result answers
  neither alone; four models answer both at once. Same reason Video's selector
  is multi (#417).
- **Rows are written with `origin: 'images'`,** which is a small lie. The column
  is constrained to `upload | images | canvas` and widening it is a migration,
  which a lab page does not get.
- **Results settle through the app's own poll.** They are `user_images` rows, so
  `useGenerationPoll` plus a re-read of the library is the whole mechanism —
  and the pictures survive in Images while the run itself does not, exactly as
  Frames' do.

Promotion, when the instruction settles, is two surfaces at different arities:
`...` on a thumbnail for one image, and a verb on the selection bar for one
generation per selected image. That bar's verbs are all free and reversible
today, so the first one that spends money carries its count and cost on the
item.

## Endpoint Explorer is the one that does not send anything anywhere

Paste a FAL model URL; it fetches that endpoint's published OpenAPI document and
says whether we could build controls for it (#523). No key, no queue, no spend --
which is the point, because the question only gets answered by pointing it at
dozens of endpoints.

Its question: **does one parser hold across real FAL schemas?** MiniMax's are
pristine and publish their own UI hints -- `x-fal-order-properties` for field
order, `_fal_ui_field` marking a media slot, both evidently what FAL's own form
is drawn from. Mirelo's publish neither and wrap every optional in
`anyOf [T, null]`. Whether that is a spectrum five control kinds cover or a long
tail with no end decides whether the real thing is worth building.

- **The report is the compatibility check.** It is not a throwaway view of one:
  whatever gets built on top, a pasted URL has to be accepted or refused, and
  this is that decision rendered as a page instead of hidden behind a green dot.
- **An unsupported field fails the endpoint even when it is optional.** Ignoring
  it and sending the default reads as generous and is how a form silently stops
  offering half of what a model does.
- **Failures are saved like successes.** The list is the record of what has been
  looked at; dropping the refusals makes the same URL worth pasting twice.
- **Three findings the first run produced, kept because they were not guessable:**
  the output media hides behind a `$ref` that is _not_ always called `File`
  (`Image` for FLUX, `Video-Output` for mirelo, and matching the name reported
  both as returning nothing displayable); `image_urls` -- an array of strings --
  is how every multi-image editor on FAL spells its reference slot, so refusing
  arrays outright failed the commonest shape there is; and FLUX's `image_size`
  is genuinely `anyOf [object, enum]`, which stays refused because a control
  that is both does not exist.
- **It parses and reports; it does not generate and does not draw the
  controls.** Those wait on what this says.

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

- **Describe's prompt list comes from `src/lib/prompts/describe/`.** Every mode
  is a `.md` in that folder plus an entry in its `index.ts`; the menu, the
  instruction-file link, the mode type and the run labels all derive from that
  array, so adding a prompt is a file drop and one entry — nothing in this page
  changes. `reconstruct` writes a prompt to regenerate the picture, `anchor`
  writes a short factual description to steer an image-to-image run; the dialog
  this page replaced hard-coded `reconstruct`, so half the feature was
  unreachable. **The picker is a menu, not `SingleSelect`** — the list is meant
  to grow and a row of segmented pills stops fitting at three or four.
- **Enhance has a target, and one of them is not an image model.** The picker
  above the idea box chooses between the image lineup -- the original page, one
  card per model -- and a multi-shot writer from `src/lib/prompts/multi-shot/`,
  which turns three words into a shot-by-shot video prompt and answers with one
  card. **Duration is read out of the request** -- "maybe 20 seconds" is part of
  what you type -- and falls back to 10s; a writer for another video model's
  dialect is a new file plus an entry in that folder's `index.ts`.
  The model selector is hidden rather than disabled for a multi-shot run: the
  instruction names the video model it writes for, so an image selection is not
  a choice taken away, it is not part of the question.
- **Variations does not generate. It hands the run over** (#433). The dialog it
  replaced fired the prompts immediately; here the prompts are the output and
  nothing is spent. "Load in Images" fills the generator panel — the whole set
  of prompts, plus the images they were written against, in order — and stops. You navigate to
  Images and press Generate yourself. **No load-and-run**: following the results
  would mean the lab holding cross-route state, which is not what it is for.
  The confirmation is a local flag on the button, not a fact anyone stores; if
  the panel changes underneath it, the button is stale and that is fine.
- **The handoff lives in `src/lib/panel-handoff.ts`, not in this folder.** It is
  the door between a page that composes a request and the page that runs it, and
  it has to be somewhere both may import — a module under `lab/` that Images
  read would be the app reaching into the lab, which is the one direction that
  is barred. One record, overwritten by each write, read once and cleared on
  arrival: the panel is a single working surface, so a second handoff replacing
  the first is the honest behaviour, and a reload of Images must not refill a
  panel that has since been edited. Enhance and any later page wanting the same
  door use this one.
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

  **`fal_endpoints` (#523) is the second exception, and it passes the same test
  for a different reason.** Endpoint Explorer keeps the FAL endpoints you have
  pasted in; re-pasting a URL you already checked is what makes a validator
  useless on its second day, so collecting them is the feature rather than one
  page's scratch state. It is also the table the real Endpoint Explorer needs
  whatever surface ends up owning it — this page is merely first to want it.
  `generation_metadata` was not an option: an endpoint is not an image and has
  no row to hang off.

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

Two things follow, both learned by getting them wrong on Outpaint (#441):

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

A feature comes back into the app when it works the way it is supposed to —
Josh's bar: _"yes, this works 100% the way I would expect it."_ Worth writing
down per feature before the work, or it is a judgement relitigated each time. A
lab you only ever add to is the same staleness with a different address.
