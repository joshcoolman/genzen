# Canvas — idea capture

Exploratory ideas for the Canvas feature, captured during poke-around sessions.

Status: `open` (undecided) · `decided` (agreed, not built) · `done` (shipped).
On "let's execute": promote `decided` items into an implementation plan, confirm, build on-spec, then mark `done`.

**Execution plan:** [canvas-plan.md](./canvas-plan.md) — sequenced phases for the `decided` items below.

**Status (2026-06-19):** All items below `done` — shipped on branch `feature/canvas-generate-overhaul` (local commits, not pushed). Tracking: [genzen#156](https://github.com/joshcoolman/genzen/issues/156).

---

## Delete behavior — `decided` (2026-06-19)

**Question:** When you delete an image from the canvas, should it go to Trash (and thus leave AI Images too)?

**Decision:** Delete on canvas = **Remove from canvas** (non-destructive), not Move to Trash.

- Delete removes the placement instantly (`on_canvas = false`), no modal. The image stays in AI Images / library.
- Toast on remove: **"Removed from canvas · Undo · Move to Trash"** — gives both the reversal and an escalation path without a dialog in the hot path.
- Explicit **"Move to Trash"** lives in the context menu for when the user truly wants it gone from AI Images. Trash is a soft delete (recoverable), not destruction.

**Rationale:** Canvas is a spatial view _over_ the library, not a container that owns images. Board-delete = remove placement is the moodboard convention (Figma, Milanote, Pinterest). Modal-on-every-delete would cause fatigue in a high-frequency rearranging activity.

**Implementation note:** Trash's linked-image protection blocks trashing any row with `on_canvas = true`. A "Move to Trash" from canvas must `setOnCanvas(false)` _then_ set `deleted_at`.

---

## Surface Generate on selection — `decided` (2026-06-19)

**Idea:** Generate from an image is too hidden. Selecting an image should expose a Generate button that opens the Generate dialog.

**Decision:** Make Generate a per-image affordance tied to selection.

- Select a single image → a Generate button appears on/near that image. Deselect → it goes away.
- Clicking it opens the existing Generate dialog (`CanvasGenerateDialog`).
- Exact placement (overlay on the image vs. floating near it) is **not decided** — pick during build, low stakes.

**Current state (this is a discoverability fix, not net-new):** Generate already has two entry points — the right-click context menu (`InfiniteCanvas.tsx` ~line 1404) and a Generate button in the bottom `SelectionActions` toolbar that shows on single-select (`SelectionActions.tsx:79`). Both are under-discovered — the bottom one was missed because it's **icon-only** (no label).

**Build steps:**

1. Quick win: change the bottom-toolbar Generate button from icon-only to show the text **"Generate"** (`SelectionActions.tsx:79`).
2. Then the main change: add the per-image, selection-bound Generate affordance above.

**On the table:** whether to keep the Generate button in the bottom menu at all once the per-image affordance exists. User dislikes two ways to do the same thing — likely drop the bottom-toolbar one. Decide once the on-image version is in.

---

## Curate the canvas model list — `decided` (2026-06-19)

**Problem:** The canvas model dropdown exposes _all_ models. Many are poor, and — worse — several silently ignore the selected input image and generate something unrelated from the prompt only. Confusing and "super lame."

**Decision:** Canvas gets a curated, **code-based** model allowlist (not user-editable), built in two layers:

1. **Hard filter (objective, free today):** canvas only ever shows models with `supportsImageInput: true`. Canvas is image-in → image-out; a model that can't take the image has no business here. This alone removes the "ignored my image" failure mode.
2. **Quality curation (subjective):** a curated allowlist of model IDs in a canvas config, gated by the hard filter as a safety net (a text-only model added to the list can still never surface).

**First-pass curation (from `models.ts`, no testing needed for layer 1):**

- _Image-input capable → eligible:_ FLUX, FLUX 2 Pro, Seedream v4, Seedream v4.5, GPT Image 1.5, GPT Image 2, Nano Banana 2, FLUX Pro Kontext.
- _No image input → exclude from canvas:_ Kling v3, Kling o3, Recraft v3, Grok Imagine.

**User-trusted (from real use):** Nano Banana, GPT Image, FLUX Pro. (Mentioned **Kling V3** too — but registry Kling entries are text-to-image only, no `supportsImageInput`. `open`: confirm whether a Kling image-input/edit variant exists to add, or drop it.)

**Notes / consistency:**

- The Combine path already hardcodes a curated pair (FLUX 2 Pro + Nano Banana 2 per canvas CLAUDE.md). The new canvas Generate list should share the same curated source so the two paths stay consistent.
- Don't hardcode FAL IDs — reference `src/features/ai-images/models.ts` (per project convention).

**Open:** exact storage shape of the allowlist (array of IDs in a `canvas-models.ts` vs. JSON) — low stakes, decide at build.

---

## Simplify the canvas Generate popup — `decided` (2026-06-19)

**Idea:** The canvas Generate popup is too busy. Strip it to a single **"Add prompt"** input for now.

**Decision:** In the canvas Generate dialog, remove the **paste prompts** and **generate prompts** (multi-prompt) controls; leave just one prompt field.

**Where:** `CanvasGenerateDialog` wraps `GeneratorPanel`. Relevant props/state: `onPastePrompts` / `pastePrompts` and the multi-prompt rows (`GeneratorPanel.tsx:125`). `showPaste` already exists as a toggle. Confirm exact controls to hide at build — this is a canvas-only simplification, don't change the AI Images generator.

---

## Replace library/upload in popup with reference images — `decided` (2026-06-19)

**Idea:** The canvas Generate popup has "Pick From Library" and "Upload Image" controls (next to aspect ratio). These break the canvas model — on canvas you generate from the image(s) you've _selected on the canvas_, not from images picked/uploaded inside a dialog.

**Decision:**

1. **Remove** "Pick From Library" and "Upload Image" from the canvas Generate popup. The selected canvas image _is_ the input.
2. **Add reference-image support** instead, reusing the AI Images pattern (`RefImageStrip`, shown in `GeneratorPanel` when `maxRefImages > 0`). Reference images are _not_ added to the canvas — they're just refs for the generation.
3. This tightens the model curation: canvas should prefer/require models that accept **additional reference images** (edit endpoint with `maxRefImages > 0`), so the "add reference images" flow is meaningful. Connects to the "Curate the canvas model list" entry above. Degrades gracefully — `RefImageStrip` already self-hides when the model has no ref support.

**Parity with AI Images — CONFIRMED tracked (no issue needed):** Reference images are persisted to `generation_metadata.reference_image_ids` inside the shared `generateImage` server fn (`generate-image-internal.server.ts:305-317`); retry/variations/edit all read+write it (`retry-generation.server.ts:84`). Canvas uses that same server fn. **To preserve parity:** ensure the canvas generate path — the `handleGenerate` override in `use-canvas-generate.ts` — forwards `referenceImageIds` into `generateImage` exactly like `use-generator.ts:327` does. Then identical requests record identical metadata, for free.

---

## Generate from a multi-image selection (retire "Combine") — `decided` (2026-06-19, round 2)

**Idea:** Let the user grab N images and "just generate" — no separate concept, no primary-picking ceremony.

**Key finding:** This is ~70% the existing **Combine** feature (2–4 selected → all sent as reference images, with per-image `Image N: label` prompt prepend). Combine is just invisible (icon-only bottom-toolbar button — same discoverability problem we fixed for single Generate). And at the FAL level there's **no semantic "primary"** image — all images merge into one ordered array; models blend the references. Caps are per-model (Nano 3, GPT 4, FLUX.2 Pro 9, Seedream 10).

**Decision:**

1. **Retire the "Combine" name** — it's "Generate" whether 1 or N images are selected.
2. **Selection-anchored Generate pill** generalizes: under a single image (exists) or **centered under the group's bounding box** (new) for 2..max.
3. **No primary step** (all equal references); **per-image labels** for referencing (reuse existing prepend). `@`-mention deferred.
4. **Model-aware cap:** pill shows when selection ≤ the largest canvas-model cap (Seedream = 10). In the dialog, models whose `maxRefImages < count` are disabled with a hint; deselect to re-enable. Over 10 → no pill.
5. Evolve the existing Combine path (placeholders/polling/labels/metadata parity all reused); swap its hardcoded 2-model list for the curated canvas edit models filtered by selection count.

Full plan: `~/.claude/plans/this-is-an-idea-ethereal-rainbow.md`. Tracking: see round-2 issue.

---

## Auto-group origin + generations — `decided` (2026-06-19, round 3)

**Idea:** After generating from the canvas, auto-group the origin image with its generations. Came from real use ("would be way better if they were already grouped").

**Decision:** On generate, group the origin (Image 1) with its resulting previews into a `CanvasGroup`. Complements the collision-free block placement (#160 / PR #161) — the block is already spatially together; this makes it an actual group.

**Notes:** Groups already exist (`CanvasGroup`, `groupSelected`). Group the origin id + placeholder ids at submit (placeholder ids persist through resolve, so the group survives). Single-image case is clear (origin + its generations). Multi-input (group generate) is fuzzier — defer that nuance; do single-image first.

---

## Right-click drag to pan — `done` (2026-06-19, round 3)

**Idea:** Pan the canvas by right-click-dragging, in addition to the current space+drag.

**Shipped:** Right-button drag pans (mode `'pan'`, shares the existing pan math). A right-drag that moves past the threshold sets `suppressContextRef`, so the context menu is swallowed on release; a plain right-click (no movement) still opens the menu (Generate / Move to Trash). In PR #161.
