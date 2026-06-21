# Generation Presentation Contract

The single source of truth for **how a generation/asset is presented in each
state, in every view**. When you build or change a view that shows generations
(AI Images, Canvas, Activity, or a future one), conform to this — don't
re-decide it per surface.

These rules are **extracted from AI Images**, the most mature view. It already
routes every state through one primitive; this doc names that primitive, the
shared data shape, and the per-state rules so the next view inherits them
instead of reinventing them.

> Why this exists: divergences like "Nano Banana just says _Generating_ but FAL
> shows the model name" and "Canvas shows a gray square with no model" are not
> UX taste — they're the result of each render site improvising from
> provider-shaped data. This contract removes the ambiguity: one normalized
> shape, one set of per-state rules, one reference implementation.

---

## Two layers: the contract vs the primitive

Keep these separate — it's the key to letting views differ where they _must_
without diverging where they _shouldn't_.

- **The contract** (this doc): _what each state must show._ Substrate-independent.
  Every view obeys it.
- **The primitive**: `src/components/Thumbnail.tsx` — the reference
  _implementation_ of the contract for **card/grid** contexts. Reuse it when your
  substrate is a card. When it isn't (see Canvas), you still owe the contract's
  required elements — you just render them on your own substrate.

---

## The normalized view-model (normalize provider quirks here, below the UI)

Every view should derive this one shape and render from it. Provider and
lifecycle quirks (Google starts at `queued`, FAL at `pending`; resolved edit
endpoints vs base ids) get erased here — the UI must never branch on provider.

```ts
interface GenerationView {
  status: 'queued' | 'pending' | 'processing' | 'completed' | 'failed'
  modelName: string // ALWAYS via getModelName(metadata.model) — never a raw id
  prompt?: string
  imageUrl?: string // completed only
  sourceImageUrl?: string // optional grayscale backdrop while pending/failed
  errorMessage?: string // failed only (raw provider error is fine; detail view shows it)
  isRetryable?: boolean // failed only — gates the Retry affordance
}
```

- `modelName` is **always** `getModelName(generation_metadata.model)`
  (`@/features/ai-images/models`). This is the shared glossary; it resolves edit
  endpoints and aliases (e.g. `fal-ai/flux-pro/kontext` → "FLUX Kontext Pro").
- `isRetryable` comes from `classifyError(generation_error)` for FAL records.
  Google records are not retryable today (see saga in ARCHITECTURE.md).

---

## State → UI contract

`queued`, `pending`, and `processing` are all "in progress" and **render
identically** in tile contexts (a spinner + the model). They differ only as
_words_ where a status label is shown (e.g. Activity rows).

| State                                             | Required elements                                            | Optional                          | Actions                                                                |
| ------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------- |
| **in progress** (`queued`/`pending`/`processing`) | spinner **+ model name**                                     | grayscale source backdrop; prompt | delete/cancel (if offered)                                             |
| **completed**                                     | the image **+ model name** (label/badge)                     | prompt                            | delete; view; view-specific actions                                    |
| **failed**                                        | "Failed" **+ model name + reason** (inline or "See Details") | grayscale source backdrop; prompt | **Retry** (if `isRetryable`); **dismiss/delete**; click → error detail |

**The non-negotiables (invariants):**

1. **Every in-progress state shows the model name.** No bare "Generating", no
   anonymous gray square. (This is the AI-Images-vs-Canvas / Nano-Banana-vs-FAL
   bug, generalized.)
2. **Model name is always `getModelName(...)`** — never a raw endpoint id, never
   omitted.
3. **A failure never silently vanishes.** It persists as a failed state showing
   model + reason, with dismiss always available and Retry when retryable.
4. **The UI never branches on provider.** Normalize FAL/Google/etc. into
   `GenerationView` first.
5. **One status vocabulary** everywhere: `queued | pending | processing |
completed | failed`. Don't invent synonyms ("generating", "in flight").

---

## Reference implementation: `<Thumbnail>`

`src/components/Thumbnail.tsx` implements the contract for card/grid surfaces
via `status="pending" | "complete" | "failed"` plus `pendingLabel`,
`failedLabel`, `failedMessage`, `label`, `overlayActions`, `onDelete`,
`selected`. AI Images consumes it through:

- `PendingImageCard` → `Thumbnail status="pending" pendingLabel={model}`
- `FailedImageCard` → `Thumbnail status="failed" failedLabel={modelName}
failedMessage="See Details"` + Retry in `overlayActions` + error dialog
- `ImageCard` → `Thumbnail status="complete"` + model `label`

If you're building a grid/card view, **use `Thumbnail`** — copying its behavior
into bespoke markup is how divergence starts.

---

## Where each view stands today (honest audit)

| View          | Conforms?                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI Images** | ✅ structurally                   | Renders all states via `Thumbnail`. This is the canonical reference.                                                                                                                                                                                                                                                                                                                                                                    |
| **Activity**  | ✅ to the vocabulary              | Row presentation (`ActivityRow` `StatusIndicator`) is its own substrate (a list row, not a tile) but speaks the same status vocabulary and shows model + error.                                                                                                                                                                                                                                                                         |
| **Canvas**    | ⚠️ behaviorally, not structurally | As of the failed-tile/label work it now shows model + pending + failed + retry/dismiss — but via **bespoke markup + CSS**, a _second_ implementation of the contract, not `Thumbnail`. Reason: canvas tiles are absolutely-positioned on a scaled infinite plane with drag handlers, so the grid-card `Thumbnail` doesn't drop in cleanly. It owes the contract (and now meets it), but the implementation should converge — see below. |

---

## Convergence backlog (the work this contract names)

- **Canvas in-progress state** historically showed a gray pulse with no model.
  Now fixed to the contract, but reconcile the implementation: extract the
  state-rendering pieces (spinner+label, failed block) so Canvas and `Thumbnail`
  share them, or adapt `Thumbnail` to a substrate-agnostic core. Until then,
  Canvas is a divergence risk — the next canvas state change must be mirrored by
  hand.
- **`GenerationView` normalizer** is not yet a single shared function; each view
  reads `generation_metadata` and `status` directly. Extracting one
  `normalizeGeneration(record): GenerationView` (functional core, unit-testable)
  is the highest-leverage step — it makes invariants 1–5 enforceable in one
  place.

---

## Adding a new view (the checklist)

1. Derive `GenerationView` from the record (use/extend the shared normalizer).
2. Meet every **Required element** in the State → UI table.
3. If your substrate is a card/grid → render via `Thumbnail`. If not → render the
   required elements on your substrate (like Canvas/Activity), and reuse shared
   sub-pieces rather than re-deciding behavior.
4. Use the one status vocabulary and `getModelName` — no synonyms, no raw ids.

If you find yourself asking "what should loading look like here?" — the answer is
already in this table. That question shouldn't reach the keyboard.
