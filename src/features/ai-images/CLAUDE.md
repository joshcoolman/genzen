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
- **Two hooks, because two routes use them.** Everything else this feature held
  moved to `app/(authenticated)/images/_hooks/` in #189 — Images was the only
  consumer, and `features/` is earned by two.
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
- **A source image carries its library id wherever one exists.** An id makes a
  generation reproducible; bytes alone do not. Three call sites had the id and
  dropped it, which silently turned library picks into unreplayable pastes.
- **Failed generations are deleted outright, not soft-deleted.** There is no image
  to restore, so Trash has nothing to offer for one — restoring it just puts an
  error card back. Everything else still soft-deletes.
- **A row is titled `Generating...` while reserved**, renamed to the model on
  success and by `failureTitle` on failure. Before that, a failure kept the
  placeholder forever and Trash filled with rows that all read "Generating...".
- **There is no edit route** (#205). A highlighted image is the next prompt's
  primary reference, so an edit is a generation with a source, not a place you go.
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
  (enhancement, variation prompts, shot lists) and vision (describe, caption)
  are all Claude; there is no second text/vision vendor (#254).
