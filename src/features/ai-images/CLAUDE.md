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
  because `images.model` stores the resolved one. `ALL_IMAGE_MODELS`,
  `IMAGE_INPUT_MODELS` and `EDIT_MODELS` are the legacy shape, still consumed,
  being retired by #190.
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
- **Library sources are fetched server-side to base64**, never handed to FAL as a
  URL — a URL cannot work against `localhost`, and it sidesteps bucket CORS.
- **FAL is the only image provider.** Anthropic is prompt work (enhancement,
  variation prompts), Gemini is vision only (describe, caption, shot lists).
