# Editing and reference-image prompting

The craft of the *non*-text-to-image paths — edit, variation, outpaint, and
multi-reference composition. genzen ships all of these (every model with a
`withImages` endpoint, `ref-images.ts`, `maxRefs`, `outpaint.ts`, the
`image-variation*.md` prompts) but the prose that drives them is written mostly
with a blank canvas in mind. Editing is a different discipline, and the failure
modes are different. This is the reference for that discipline; the pure
text-to-image craft lives in `prompt-enhancement-strategies.md` and the per-model
`guide-*.md` files, and is not repeated here.

Sourced from Black Forest Labs' own editing guides (FLUX.2 `i2i` and
`multi-reference-editing`), generalised to the whole lineup — the mechanics of
"describe a change against an existing picture" hold across Seedream edit,
Nano Banana edit, and z-image image-to-image, not just FLUX.

## The one rule text-to-image does not teach: name what stays

A generation prompt says what the picture *is*. An edit prompt says what
*changes* — and an edit model, left to guess, will happily change things you
never mentioned. The single highest-leverage habit is to state the preservation
explicitly, in the same breath as the change:

    Bad:   Change the background to a beach at sunset
    Good:  Change the background to a beach at sunset, keeping the subject's
           pose, clothing, expression and the lighting direction exactly as they are

The "bad" version is not wrong, it is *underspecified*: it invites the model to
re-render the person too. Every edit instruction should carry both halves —
the change, and the envelope around it that must hold. This is the editing
equivalent of the no-negation rule: you are not forbidding drift, you are
positively pinning the parts that stay.

Style is the most commonly-dropped envelope. A realistic photo asked to "make
it nighttime" often comes back stylised, because "nighttime" pulled in a whole
aesthetic. Pin it: *"…while maintaining the photorealistic style and the
existing colour grading."*

## Sequential small edits beat one large edit

A prompt that asks for four unrelated changes at once ("Victorian furniture,
add a fireplace, candlelight, age the photo") gives the model four chances to
misread and no way to isolate which one failed. The same result is more
reliable as four edits, each against the previous output:

1. Change the furniture to Victorian antique pieces
2. Add a stone fireplace on the right wall
3. Shift the lighting to warm candlelight
4. Apply a vintage photographic look with sepia tones

This is worth saying because genzen's variation and edit flows make re-editing
an output cheap — the interaction cost of "edit again" is one click, so the
prompt does not need to carry the whole transformation. Prefer a chain of legible
edits over one prompt nobody can debug.

## Reference images: give each one a role

Once more than one image is in play, the model needs to know what each is *for*.
Vagueness ("the person and the background together") produces blends; explicit
roles produce composition. Two ways to make the roles legible, both fine:

- **Natural language** — *"The person from image 1, wearing the outfit from
  image 2, in the café from image 3."*
- **Explicit indexing** — number the images and refer to them by number. Use
  this when precision matters or when the same kind of thing appears in two
  references (two faces, two garments).

State the *relationship*, not just the inventory. "The person and the beach"
leaves the arrangement to chance; "the person in the foreground, the beach
visible behind them at a distance" does not.

### Role vocabulary worth standardising

When a reference set gets complex, naming each image's job removes ambiguity:

    image 1 — identity / face
    image 2 — pose / body
    image 3 — style / aesthetic
    image 4 — environment / background

### Character consistency across generations

The recurring ask — "same character, new scene" — is a reference-image job, not
a prompt job. Feed the character as a reference and describe only what is new:

    The same person from image 1, now seated at a desk in a modern office,
    same clothing and hairstyle, different environment

If identity drifts across a series, the fixes in order of effort: emphasise the
identifying features by name, add the phrase *"maintaining exact likeness,"* and
supply more than one angle of the subject as separate references. Reducing the
number of *other* references also helps — every extra reference is another pull
on the model's attention.

### Lighting is the seam that gives away a composite

When elements come from different references, mismatched light is what reads as
fake. Say the light once, for the whole frame: *"…lighting direction consistent
across all elements, main source from the upper left."*

## Outpaint framing

Outpaint is an edit whose change is *"extend the canvas"* and whose preservation
envelope is *the entire original frame*. The prompt describes what fills the new
margin, in continuity with what exists — not a fresh scene. Keep it about
continuation: the surface, the light, the horizon line carry outward; the
subject does not move. Anything that would alter the original pixels is the
wrong instruction for this path.

## Troubleshooting quick table

| Symptom | First thing to try |
| --- | --- |
| An element you didn't mention changed | Name it in the preservation envelope |
| A reference isn't transferring | Be explicit about which element from which image; reduce reference count |
| Composite looks pasted-together | Pin lighting direction across all elements |
| Identity drifts across a series | "maintaining exact likeness" + more angles of the subject |
| One big edit keeps missing | Split into sequential edits, one change each |
| Realistic photo came back stylised | Pin the style in the same prompt as the change |

## How this maps to genzen / opportunities

- **The edit prompts could carry the preservation rule.**
  [`image-variation.md`](../../src/lib/prompts/image-variation.md) and
  [`image-variation-multi.md`](../../src/lib/prompts/image-variation-multi.md)
  are the model-addressed prose for the edit path. If they don't already
  instruct the model to name what stays, that is the single most valuable line
  to add — it is the difference between "vary this" and "vary this without
  wrecking the parts I liked."
- **`enhance-prompt.md` is text-to-image only.**
  [`enhance-prompt.md`](../../src/lib/prompts/enhance-prompt.md) opens with
  "You turn a rough idea into a finished text-to-image prompt." When the user is
  editing an existing image, a different instruction applies (change + preserve,
  not subject-first composition). Worth checking whether the enhancer is even
  invoked on the edit path, and if so whether it should branch — this is exactly
  the kind of per-mode instruction the `.md`-per-instruction convention (#322)
  is built to make cheap.
- **Reference-role vocabulary belongs near `ref-images.ts` / `ref-usage.ts`.**
  [`ref-images.ts`](../../src/features/ai-images/ref-images.ts) and
  [`ref-usage.ts`](../../src/features/ai-images/ref-usage.ts) manage how many
  references a model takes (`maxRefsFor`) and how they're attached. The role
  vocabulary above is the prompt-side counterpart — if genzen ever surfaces
  per-reference labels in the UI (identity / pose / style / background), this is
  the taxonomy to use, and the prompt can then name them by role automatically.
- **Multi-reference is capped per model, and the cap is craft-relevant.**
  Character consistency wants *more* angles; genzen's `maxRefs` is the ceiling
  on that. When a model is chosen for a consistency job, the picker could hint
  that a higher-`maxRefs` model (Nano Banana, Seedream, FLUX.2 pro) will hold
  identity better than a low-cap one.
- **Outpaint has its own prompt already.**
  [`outpaint.md`](../../src/lib/prompts/outpaint.md) exists; this doc's outpaint
  section is the checklist to audit it against — continuation not reinvention,
  original frame preserved.
</content>
</invoke>
