# Images

Multi-model image generation, edit and variation workflows via FAL. **Headless —
no `.tsx` here.** The generation UI Images and Canvas share lives in
`app/(authenticated)/_components/` (`generator-panel/` and what it composes);
anything one route renders lives with that route.

## Rules

- **`models.ts` is the lineup.** `IMAGE_MODELS` is one entry per model and the
  only place to add or remove one; everything else in the file derives from it. A
  model is one name over up to two FAL endpoints — `textToImage` (no references)
  and `withImages` (references attached) — picked by `endpointFor(id, hasRefs)`,
  with `maxRefs` capping how many are sent. `getModelName()` resolves either,
  because `images.model` stores the resolved one. The legacy
  `ALL_IMAGE_MODELS` / `IMAGE_INPUT_MODELS` / `EDIT_MODELS` shape is gone (#190);
  `models.test.ts` keeps their numbers as fixtures so a lineup edit cannot
  quietly change a cap or a name that used to be pinned.
- **`fal-params.server.ts` is the one param resolver.** `buildFalInput()` resolves
  size, safety and image params per model schema for every path — generate,
  variations, retry. Some models take resolution enum strings and others
  width/height objects; that difference lives here and nowhere else.
- **`useGenerator` takes a required `origin`** (`images | canvas`), written to
  every row it creates, so a new host cannot be an unmarked generation source
  (#207).
- **The hooks here are the ones both routes use.** Everything else this feature
  held moved to `app/(authenticated)/images/_hooks/` in #189 — Images was the
  only consumer, and `features/` is earned by two.
- **System instructions are read from storage at submit, never passed in**
  (#272). `system-instructions.ts` is one global value under one key, prepended
  by `useGenerator` ahead of the host's own `promptPrefix` — so Images and
  Canvas both get it with no wiring and the composition order lives in one
  place. `use-system-instructions.ts` is for the UI that edits it and is not on
  the submit path.
- **One set, not a source plus references (#297).** `useGenerator` holds an
  ordered `refImages` of zero to `maxRefImages`, and every member is a library
  row -- there is no bytes-only member, because the only way in is the library
  picker. `maxRefImages` is `imageCapacityFor` minimised across the selection
  (`maxRefs` counts images _beyond_ a source that no longer exists, so capacity
  is `maxRefs + 1`), and a narrowing selection trims the set rather than letting
  the submit drop the overflow. Index 0 is the only asymmetry: an effect derives
  orientation and aspect ratio from whatever lands there, and the submit sends
  it as `sourceImageId` with the rest as `referenceImageIds`. **That split is
  the wire's, not the model's** -- the server concatenates them straight back
  into one ordered `image_urls`, and it survives only because
  `generation_metadata` (and so `retry-plan.ts`) is written in those terms.
- **Three ends to the set.** `addRefImages` appends and slices the tail off, for
  picking several at once; `pushRefImage` unshifts and evicts the last, for the
  one-at-a-time gesture that means "use this one" (Cmd-click a card, #284);
  `setPrimaryImage` replaces slot 0 and keeps the rest, and applying variations
  is its only caller -- the prompts are _of_ that image. `setPrimaryImage` was
  briefly the Cmd-click binding and should not be again: replacing meant
  clicking three cards left one image, and against a single-image model it is
  indistinguishable from `pushRefImage`, so the bug hides exactly where it is
  most likely to be tested. The ordering is `pushRef` in `ref-images.ts` --
  pure, so it is unit-tested, because a silent eviction at the wrong end is
  invisible.
- **Prompt origins are keyed by the enhanced string**, not by prompt index, so
  editing the text invalidates the pair instead of attributing a stale original
  (#210).

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
- **A row is titled `Generating...` while reserved**, renamed to the model on
  success and by `failureTitle` on failure. Before that, a failure kept the
  placeholder forever and Trash filled with rows that all read "Generating...".
- **There is no edit route** (#205). An edit is a generation with images
  attached, not a place you go. Since #297 the images are set from the panel's
  Reference images widget, never from the grid and never by uploading.
- Variations rewrite the prompt with Claude Sonnet against the source image
  ("creative tension") to stop quality drift.

## Gotchas

- **Nothing pushes.** The gallery's poll is its only update signal: a submit
  refreshes once via `onAfterSubmit` so pending cards appear, and each poll that
  settles a row refreshes again. FAL runs through the async queue
  (`fal.queue.submit`).
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
