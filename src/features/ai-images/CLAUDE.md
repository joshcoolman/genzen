# Images

Multi-model image generation, edit and variation workflows via FAL. **Headless —
no `.tsx` here.** The generation UI Images and Canvas share lives in
`app/(authenticated)/_components/` (`generator-panel/` and what it composes);
anything one route renders lives with that route.

## Images on the way to FAL

**Every image the app sends FAL goes through `uploadBufferToFal`**, which
shrinks it first (`fal-image-prepare.server.ts`, #560) and retries a dead
connection around it (#556). The stored file is never touched -- this is a
transport concern, and the library row keeps its full-resolution original.

- **2048 long edge, JPEG at 95.** The number and the evidence are the reference
  sheet's: a model downscales a reference before it looks at anything, around a
  1024-1536 long edge, so pixels past this are the same detail squeezed harder.
- **Heavy PNGs are re-encoded even when they are already small enough to
  send.** This is the clause that does the work -- the eight 1920-2560px
  keyframes behind #556 were 12.8MB of lossless PNG, and came out 1.7MB.
  A long-edge rule alone would have changed nothing.
- **Transparency keeps its format**, because flattening alpha onto a colour is a
  change to the picture rather than a compression choice.
- **Never fatal, and never bigger.** Anything sharp cannot read (the library
  holds mp4) goes through untouched, and a re-encode that grew the file is
  discarded -- flat graphics beat JPEG outright, which is also why a fixture of
  random noise tested the safety net rather than the behaviour.

## Rules

- **`models.ts` is the lineup.** `IMAGE_MODELS` is one entry per model and the
  only place to add or remove one; everything else in the file derives from it. A
  model is one name over up to two FAL endpoints — `textToImage` (no references)
  and `withImages` (references attached) — picked by `endpointFor(id, hasRefs)`,
  with `maxRefs` describing how many it holds -- a hint the submit truncates to,
  not a gate the panel enforces (#341). `getModelName()` resolves either,
  because `images.model` stores the resolved one. The legacy
  `ALL_IMAGE_MODELS` / `IMAGE_INPUT_MODELS` / `EDIT_MODELS` shape is gone (#190);
  `models.test.ts` keeps their numbers as fixtures so a lineup edit cannot
  quietly change a cap or a name that used to be pinned. An entry may also pin
  `params`, sent to FAL on every submit to that model (#485) — for an endpoint
  whose _default_ is wrong for genzen, which so far is GPT Image 2 alone: it
  renders at `quality: 'high'` unless told otherwise, and that is a
  142-second render against 17-35 at `low`. Not a place to put tuning; a dial
  is #486.
- **`fal-params.server.ts` is the one param resolver, and the only enforcer of a
  model's image limit (#341).** `buildFalInput()` resolves size, safety and image
  params per model schema for every path — generate, variations, retry. Some
  models take resolution enum strings and others width/height objects; that
  difference lives here and nowhere else. It truncates the image list to
  `imageCapacityFor` and **returns what it sent** (`imagesRequested` /
  `imagesUsed`), which the caller writes to the row when the two disagree. For an
  endpoint no entry claims it falls back to the schema shape rather than dropping
  everything — that is what lets a model be tried with nothing verified about it.
- **`useGenerator` takes a required `origin`** (`images | canvas`), written to
  every row it creates, so a new host cannot be an unmarked generation source
  (#207).
- **`outpaint.ts` holds the one knob, the prompt assembly, and what the lab
  proved.** Outpainting is a card action on /images; the lab page that vetted it
  is gone (#528). The model is a constant rather than a control because that
  question is answered -- changing it is one line and no UI. Read the file's
  header before swapping the model or editing the prose: it records that asking
  plainly is enough (so compositing is not to be built speculatively), that the
  instruction pads and never crops, and that a denoise-from-image endpoint
  cannot do this at all. The prose is `src/lib/prompts/outpaint.md` (#322); only
  the assembly is code.
- **`shots.ts` is outpaint's trade widened** (#553): a fixed instruction plus a
  reference, no typed prompt, fired from the picture you already have. What it
  adds is a model picker, because outpaint's question was settled and this one
  is not. Z-Image Turbo is excluded for the reason `outpaint.ts` records --
  denoise-with-strength cannot take an instruction -- so offering it would spend
  money reproducing the reference. The sixteen angles and the constant block
  are `src/lib/prompts/shots/`, loaded lazily so a client reading the registry
  for its labels does not bundle the prose; only the assembly is code. The prompt itself is
  written by two vision passes in `server/write-shot-prompt.action.ts` --
  `writeShotScene` once per picture, `writeShot` once per angle, concatenated by
  the caller so the scene text cannot vary between shots. Its header records the
  two alternatives that were tried and deleted, and why a per-angle scene is the
  one thing not to reintroduce.
- **The hooks here are the ones both routes use.** Everything else this feature
  held moved to `app/(authenticated)/images/_hooks/` in #189 — Images was the
  only consumer, and `features/` is earned by two.
- **System instructions are read from storage at submit, never passed in**
  (#272). `system-instructions.ts` is one global value under one key, prepended
  by `useGenerator` ahead of the image labels — so Images and Canvas both get it
  with no wiring and the composition order lives in one place. `use-system-instructions.ts` is for the UI that edits it and is not on
  the submit path.
- **One set, not a source plus references (#297).** `useGenerator` holds an
  ordered, **unbounded** `refImages`, and every member is a library
  row -- there is no bytes-only member, because the only way in is the library
  picker. `maxRefImages` is `imageCapacityFor` minimised across the selection
  (`maxRefs` counts images _beyond_ a source that no longer exists, so capacity
  is `maxRefs + 1`) -- reported since #341, never enforced: clamping to it
  deleted staged images the moment a smaller model was ticked, and the submit
  truncates per model and says so instead. Index 0 is the only asymmetry: an effect derives
  orientation and aspect ratio from whatever lands there, and the submit sends
  it as `sourceImageId` with the rest as `referenceImageIds`. **That split is
  the wire's, not the model's** -- the server concatenates them straight back
  into one ordered `image_urls`, and it survives only because
  `generation_metadata` (and so `retry-plan.ts`) is written in those terms.
- **Three ends to the set.** `addRefImages` appends, for picking several at
  once; `pushRefImage` unshifts, for the one-at-a-time gesture that means "use
  this one" (Cmd-click a card, #284) — it evicted the last until #341, and
  nothing replaced the limit; `replaceRefImages` swaps the whole set, which is
  how a Canvas selection and a lab handoff both arrive. There was a fourth,
  `setPrimaryImage`, replacing slot 0 and keeping the rest; it went with #436,
  when Variations started handing over a whole ordered set instead of one
  source. Do not reintroduce it as a card gesture, which it briefly was:
  replacing meant clicking three cards left one image, and against a
  single-image model it is indistinguishable from `pushRefImage`, so the bug
  hides exactly where it is most likely to be tested. The ordering is `pushRef`
  in `ref-images.ts` -- pure, so it is unit-tested, because a silent eviction at
  the wrong end is invisible.
- **"What went into this generation" has one answer, `generation-inputs.ts`**
  (#380). The split above is why: index 0 goes over the wire as
  `sourceImageId` and the rest as `referenceImageIds`, so the same fact lands
  in `generation_metadata` under two keys depending on the path, and a third
  (`parent_id`) duplicates one of them. Any surface showing inputs reads
  `generationInputIds()` and resolves through
  `server/generation-inputs.server.ts` — never a single metadata field.
  **It returns the source first** (#382): the submit splits the panel's ordered
  set at index 0 and the server concatenates it back that way, so source-first
  is the order FAL actually received. It appended the source instead until a
  reader appeared that loads the set back into the panel, where index 0 is
  load-bearing rather than cosmetic.
  Activity did read one field, and so showed nothing at all on an edit through
  a model's image endpoint and one image too few everywhere else. The function
  ignores `parent_id` (filing, and mutable) and `root_image_id` (ancestry, not
  input) on purpose; both are named in its comments so the exclusions are not
  re-litigated as oversights.
- **`load-generation.action.ts` is "put that generation back in a panel", and
  it is not `planRetry`.** Both read `generation_metadata`; a retry reproduces a
  request and this fills a form, which is why it returns the _typed_ prompt
  rather than the sent one, loads what still resolves rather than refusing, and
  never touches the model. It lives here rather than under a route because
  Images' card icon (#382) and Activity's button (#458) both call it -- the
  second consumer is what earned it the move.
- **Two prompt writers, opposite operations, separate contracts.**
  `enhance-prompt.action.ts` expands text it is given; `generate-prompt.action.ts`
  invents from nothing and is capped at 20–45 words. They must not share a
  prose file: running the expander on an empty field is what produced the
  verbose output Generate exists to avoid, and enhance's own contract asks for
  30–80 words, dropping to 10–30 for a simple subject and past 80 only for a
  genuinely multi-subject scene. It used to be a ten-step pipeline; #463 cut
  that after reading it against its own output. Both read their instructions
  from `src/lib/prompts/*.md`, which a human edits. Only `generate-prompt.md`
  still carries a frontmatter block, and `stripFrontmatter` exists to remove it
  -- a leftover of the skills registry #203 deleted.

  **Enhance has no caller in the app.** It is exercised from
  `app/(authenticated)/lab/enhance` since #424 — the panel's button and the
  `prompt-origins` map that recorded its before/after both went with it. The
  action is unchanged; only the surface that calls it moved.

## Decisions worth not relitigating

- **Retry resubmits the same row** — back to `pending`, error cleared,
  `retry_count` bumped. Retry means "try that again", not "make another":
  inserting a new row left the original failure behind as a second card to clean
  up.
- **Retry replays the whole request, source and references included** (#214).
  `retry-plan.ts` reads the plan out of `generation_metadata` — pure, so it is
  unit-tested — and **refuses rather than sending a partial request**. A retry
  that quietly drops the source looks like it worked and generates something
  else, which is the failure this closed. A source that was pasted rather than
  saved has no bytes to replay and is the one honest refusal left (#224).
- **The retry endpoint is derived, never read from the row.** `fal_model_id` is
  written at reserve time as the base model and only patched to the resolved
  endpoint at submit, so a generation that failed _before_ submit kept the
  text-to-image endpoint — exactly the rows that get retried.
- **Every image the generator holds carries its library id.** An id makes a
  generation reproducible; bytes alone do not. Three call sites had the id and
  dropped it, which silently turned library picks into unreplayable pastes.
  #297 closed the class rather than the instances: the panel can no longer
  acquire bytes at all, so there is nothing left that could arrive without one.
- **Failed generations are deleted outright, not soft-deleted.** There is no image
  to restore, so Trash has nothing to offer for one — restoring it just puts an
  error card back. Everything else still soft-deletes.
- **A row is titled with its model from the moment it is reserved** (#367).
  `modelTitleFor()` is the one answer, called by the reserve, the completion and
  the optimistic card the browser draws before either has run -- three separate
  derivations meant the badge renamed itself at settle, which is a card
  admitting it had been guessing. It looks the full endpoint up _before_
  stripping `/edit`, because Seedream v4.5 registers its image endpoint with
  that suffix and stripping first badged every edit with a raw id. `PENDING_TITLE`
  and `failureTitle` survive only to repair rows written before this.
- **`generation_metadata.prompt` is what the user typed; `sent_prompt` is what
  FAL received** (#367). The two used to be one field holding the sent string,
  so a caption grew its system-instructions preamble when the optimistic card
  became real. Retry replays `sent_prompt ?? prompt` -- the fallback is what
  keeps rows written before the split replaying correctly, since back then
  `prompt` _was_ the sent string. Generating from a picture with no prompt is
  the one case where the caption legitimately arrives late: the describer's
  text is the only prompt that generation has.
- **There is no edit route** (#205). An edit is a generation with images
  attached, not a place you go. Since #297 the images are set from the panel's
  Reference images widget, never from the grid and never by uploading.
- Variations rewrite the prompt with Claude Sonnet against the source image
  ("creative tension") to stop quality drift.
- **A variation can be about up to four images** (#436, `MAX_VARIATION_IMAGES`
  in `constants.ts` -- there rather than beside the action, since a
  `'use server'` module exports only async functions). One image and several
  are different questions and take different instruction files:
  `image-variation.md` says "describe only what changes", which is wrong for a
  combine, so `image-variation-multi.md` handles those and names the pictures by
  number. Two mechanisms switch **off** for a set rather than generalising --
  root-image resolution (four pictures the user chose have no root) and the
  anti-repeat query (the schema cannot ask about past variations of a
  particular set).
- **Vision gets a downscaled copy, never the original**
  (`src/lib/server/vision-image.server.ts`). Not an optimisation: originals held
  for one image and failed outright the first time two went in one message --
  Node destroyed the HTTP/2 session mid-upload (`ERR_HTTP2_INVALID_SESSION`) and
  the AI SDK retried into `Cannot connect to API`, an error naming everything
  except the size of what was sent. Long edge 1568, which is what Claude scales
  to anyway, re-encoded to JPEG so the type is known rather than sniffed, and
  `rotate()` first because a re-encode drops the EXIF orientation that was
  keeping a portrait photo upright.
- **`imageLabelPrefix` is what makes "image 2" mean anything** (#436). A
  generation is one prompt string plus one ordered array with no per-image
  field, so the numbers are words in the prompt, prepended at submit for any set
  larger than one. Derived in `useGenerator` from its own set: Canvas used to
  build them when its dialog opened, so editing the strip afterwards left the
  prompt describing the previous selection. `RefImageStrip` numbers its tiles on
  the same condition, and `ref-images.test.ts` pins the ordering -- a prefix
  that disagrees with its set is invisible.

## Gotchas

- **Nothing pushes.** The gallery's poll is its only update signal: a submit
  refreshes once via `onAfterSubmit` so pending cards appear, and each poll that
  settles a row refreshes again. FAL runs through the async queue
  (`fal.queue.submit`).
- **`hooks/use-generation-poll.ts` is that poll, for every route that has one**
  -- Images, Video and Activity each had their own `setInterval(..., 5000)`,
  which is why the fixes below had to be made three times or not at all. It
  backs off with the age of the work, stops while the tab is hidden, and stops
  outright when the action reports nothing left in flight. **A generation also
  has a deadline** (`DEADLINE_MS` in `check-pending-generations.action.ts`, 10
  minutes for a still and 30 for a clip): past it the row becomes a failed card
  rather than a poll that never ends. One had been pending for 26 hours, checked
  every five seconds throughout (#327). The poll's backfill of error detail on
  already-failed rows is bounded to the last two minutes for the same reason --
  unbounded, it re-checked every failure you had ever had, forever.
  **A pending row with no `request_id` is the poll's other deadline** (#363).
  There is no ticket to ask FAL about, so nothing could ever settle it: the
  query used to filter those rows out entirely and they said "Generating..."
  forever. Past `SUBMIT_DEADLINE_MS` the row becomes a failed card saying
  nothing ran and nothing was charged, which is true -- the submit never
  reached FAL.
- **Every image FAL is given is uploaded as bytes**, never handed over as a URL
  for FAL to fetch. It was already the only thing that worked against
  `localhost`; since #226 it is the only thing that works at all, because our
  images have no URL a third party could fetch. The bytes come straight off the
  bucket (`storage.download()`), never over HTTP to our own app.
  `#/lib/server/fal-image-inputs.server.ts` is the one seam; generate and retry
  both go through it, and it preserves caller order because models read the
  image list positionally.
- **FAL is the only image provider, Anthropic the only other one.** Prompt work
  (enhancement, variation prompts) and vision (describe, caption)
  are all Claude; there is no second text/vision vendor (#254).
