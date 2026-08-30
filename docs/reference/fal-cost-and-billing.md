# FAL cost and billing

How FAL charges, why a single cost number per model is structurally wrong, and
how to estimate a generation before it runs. genzen surfaces cost in two places
that both depend on getting this right: the pre-submit estimate and the Activity
log's actual-cost record. The lineup's own code already carries the scars of
this — the comments in `image-models` and
[`video/models.ts`](../../src/features/video/models.ts) are a running
commentary on billing that would not agree with itself. This doc collects the
model so the next person doesn't re-derive it from an invoice.

## Three billing shapes, and they don't reconcile

FAL endpoints bill in one of three fundamentally different ways. A cost field
that assumes one shape is wrong for the models on the other two.

### 1. Per image (flat)

A fixed price per output image, regardless of size. Nano Banana and Seedream
bill this way. This is the easy case: one number is the truth, and it doesn't
move with resolution.

### 2. Per megapixel

The price scales with the pixels produced — and, for an edit, with the pixels
consumed. This is FLUX.2's model, and it is why "one cost per model" breaks: the
same model costs different amounts at different output sizes, and an
image-to-image run costs *more* than a text-to-image run of the same output
size because the input image's megapixels are billed too.

The FLUX.2 formula, in cents:

    (firstMP + (outputMP - 1) * mpPrice) + (inputMP * mpPrice)

The first megapixel is priced higher than each additional one, and the input
term is zero for a plain generate and non-zero for every edit. Concretely, at
1 MP: FLUX.2 pro is ~$0.03 text-to-image and ~$0.045 image-to-image — a 1.5x
jump for the *same* model and output size, purely from the input image. A cost
estimate that ignores the input term under-quotes every edit.

### 3. Per compute-second

You pay for how long the GPU ran, which is not knowable before the run and not
identical between two runs of the same prompt. These models "cannot agree by
construction" — any pre-submit number is a bracket, not a price. Grok's image
endpoint is the lineup's example. The honest UI for these is a range or a
"~" prefix, never a firm figure.

## The rate card is not the invoice

The most expensive lesson in the codebase, learned twice on the MiniMax H3
family: **FAL's published per-unit rate is not what the invoice charges.**

- H3's rate card says $0.05/second. The actual invoice bills **1.2x the
  requested duration** — an 8-second clip was charged for 9.6 seconds ($0.48).
  genzen encodes the *effective* 6c/second-of-requested-clip, not the 5c rate,
  because the duration control is what the user is actually choosing. Trusting
  the rate card ran the estimate a third low.
- Flux 3 bills 2x duration; LTX bills its stated units. Those happened to match
  their rate cards, so they weren't bitten — but the only way that was *known*
  was the first invoice.

The rule: **an estimate from a rate card is provisional until the first real
invoice confirms it.** Where a model's true billing multiplier is unconfirmed
(H3 Max today, billed on rate-card assumptions), the estimate may read low and
should be treated as a floor. Say so in a comment at the number, as
`video/models.ts` does.

Related trap: **promotional pricing expires.** FAL ran a 50%-off promo on H3 Max
that ended 2026-09-01; encoding the promo price would have been wrong within a
week. Encode the regular rate; a promo is a temporary discount on a real number,
not the real number.

## Estimate and submit must use the same inputs

A price quoted at one resolution against a clip rendered at another is a silent
overcharge-or-undercharge bug. genzen's video side already guards this:
`resolutionFor` is the single place that decides which resolution is actually
sent, and both `estimateCostCents` and the submit read it, so they cannot
diverge. Any per-megapixel image estimate needs the same discipline — the MP
count the estimate uses must be the MP count the submit requests, including the
input image on an edit.

## Where the authoritative numbers live

Don't hand-transcribe prices from a marketing page. FAL exposes them:

- `GET https://api.fal.ai/v1/models/pricing?endpoint_id=<id>` — the per-endpoint
  price and billing unit.
- `GET https://api.fal.ai/v1/models/usage` — actual usage, for reconciling an
  estimate against what was really charged when a figure looks wrong.

The endpoint ids to query are the ones in `IMAGE_MODELS` /
[`VIDEO_MODELS`](../../src/features/video/models.ts) — and note the namespaces:
video ids are `lightricks/`, `blackforestlabs/`, `minimax/`, *not* `fal-ai/`.

## How this maps to genzen / opportunities

- **The image lineup's cost field fights its own billing model.** The comments
  in `IMAGE_MODELS` already say it: "several models bill per megapixel," a
  per-megapixel model's number "differs for every megapixel-billed model, by
  roughly 2x" between generate and edit, and "one number per model cannot be
  both." A single `costCents` literal cannot represent a per-MP model honestly.
  The video side solved the analogous problem with `pricePerSecondFor` +
  `estimateCostCents` computing from resolution and duration — the image side
  could compute from output MP and (on an edit) input MP the same way, instead
  of storing one representative figure.
- **Edits are under-quoted wherever the input MP is dropped.** Any image cost
  estimate that uses only output size under-quotes every image-to-image run on a
  per-MP model — the input image is billed too. This is worth auditing in the
  image estimate path the way `video/models.ts` audits duration multipliers.
- **The Activity log is the reconciliation surface.** Activity records the real
  cost of every generation. That makes it the natural place to catch a
  rate-card-vs-invoice gap: an estimate that consistently reads low against
  logged actuals is the signal that a model bills on a multiplier the estimate
  doesn't know about — exactly how the H3 1.2x was found.
- **Compute-second models should not show a firm number.** If Grok-style
  compute-billed endpoints are in the image lineup, their pre-submit "cost" is a
  bracket. A firm figure there is a promise genzen can't keep; a range or `~`
  prefix is the honest UI.
- **Prices drift; the fetch endpoints exist.** A periodic reconcile against
  `/v1/models/pricing` would catch a silently-changed rate before an invoice
  does. Worth considering as a script (`pnpm`-runnable) rather than trusting
  hand-entered literals to stay current — promos end, rates move.
</content>
