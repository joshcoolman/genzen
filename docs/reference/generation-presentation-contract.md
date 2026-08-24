# Generation Presentation Contract

How a generation is presented in each state, in every view. When you build or
change a view that shows generations, conform to this rather than re-deciding it
per surface.

> Why this exists: divergences like "Nano Banana just says _Generating_ but FAL
> shows the model name" and "Canvas shows a gray square with no model" are not UX
> taste — they are what happens when each render site improvises from
> provider-shaped data. One normalized shape, one set of rules, one reference
> implementation.

## Two layers

Keeping these apart is what lets views differ where they must without diverging
where they should not.

- **The contract** (this doc): what each state must show. Substrate-independent.
- **The primitive**: `src/components/thumbnail/thumbnail.tsx`, the reference
  implementation for card/grid contexts. When your substrate is not a card
  (Canvas, Activity rows) you still owe the required elements — you just render
  them yourself.

## The view-model

`normalizeGeneration` in `src/features/ai-images/normalize-generation.ts` is the
one shape every view derives and renders from. Read it there; it is 56 lines and
this doc will not restate it.

Two things about it that the code cannot say for itself:

- **The status vocabulary is `pending | completed | failed`, and those three are
  also the check constraint in `migrations/0001_init.sql`.** Don't invent
  synonyms — no "generating", no "in flight", no "queued". An unrecognised status
  coerces to `pending` rather than throwing, because a row is more useful on
  screen than absent.
- **`modelName` is always `getModelName(metadata.model)`** — never a raw endpoint
  id, never omitted. That function is the shared glossary and it resolves aliases,
  so it keeps naming a model correctly after the model leaves the lineup.

## State → UI

| State         | Required                                                     | Optional                          | Actions                                                     |
| ------------- | ------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------- |
| **pending**   | spinner **+ model name**                                     | grayscale source backdrop; prompt | delete/cancel, if offered                                   |
| **completed** | the image **+ model name**                                   | prompt                            | delete; view; view-specific actions                         |
| **failed**    | "Failed" **+ model name + reason** (inline or "See Details") | grayscale source backdrop; prompt | **Retry** when `isRetryable`; dismiss; click → error detail |

The invariants, which are the part worth arguing about:

1. **Every pending state shows the model name.** No bare "Generating", no
   anonymous gray square. This is the original bug, generalized.
2. **A failure never silently vanishes.** It persists showing model and reason,
   with dismiss always available and Retry when `classifyError` says the category
   is retryable.
3. **The UI never branches on provider.** FAL is the only image provider today,
   so there is nothing to branch on — but the normalizer, not the view, is where
   that stays true if a second one ever arrives.

## Adding a view

Derive `GenerationView`, meet every required element, and use `Thumbnail` if your
substrate is a card — copying its behaviour into bespoke markup is how divergence
starts. If you find yourself asking what pending should look like here, the answer
is in the table.
