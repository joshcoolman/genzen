# Canvas — execution plan

Promoted from the `decided` items in [canvas.md](./canvas.md). That file is the decision log + rationale; this file is the sequenced build spec (the execution membrane). On "let's execute": create a feature branch + tracking issue (per PR/phased workflow), build phases in order, flip items to `done` in `canvas.md`.

**STATUS (2026-06-19): all 5 phases SHIPPED** on `feature/canvas-generate-overhaul` (local commits, not pushed). Tracking: [genzen#156](https://github.com/joshcoolman/genzen/issues/156). Kling pre-flight resolved (image-to-image variant exists on FAL but deferred — needs shared registry change).

## Theme

Make the canvas Generate flow match the canvas mental model: **select image(s) on canvas → add a prompt → optionally add reference images → generate**, on a curated set of ref-capable models. Plus discoverability (surface Generate) and correct delete semantics.

## Pre-flight (resolve before / during Phase 2)

- **Kling V3 check** — user trusts "Kling V3" but registry Kling entries are text-to-image only (no `supportsImageInput`). Verify via FAL OpenAPI whether a Kling image-input/edit variant exists. Add it if real; otherwise drop Kling from the canvas list.
- **On-image Generate button placement** — overlay on the selected image vs. floating near it. Low stakes; decide when building Phase 4.

---

## Phase 1 — Quick wins (low risk, standalone)

1. **Generate button label** — change the bottom-toolbar Generate from icon-only to show text "Generate" (`SelectionActions.tsx:79`).
2. **Delete = Remove from canvas** — Delete key/action on a selected image flips `on_canvas = false` instantly (no modal), keeps the row in the library. Show a toast: "Removed from canvas · Undo · Move to Trash".
   - Wire Undo into the existing undo stack.
   - "Move to Trash" in the toast escalates (see Phase 5).

_Files:_ `SelectionActions.tsx`, `InfiniteCanvas.tsx`, canvas persistence (`setOnCanvas`).

## Phase 2 — Curate the canvas model list (foundation for Phase 3)

1. Add a code-based canvas model allowlist (array of IDs, not user-editable), sourced from `src/features/ai-images/models.ts` (don't hardcode FAL IDs).
2. Two-layer filter: **(a)** hard gate `supportsImageInput === true`; **(b)** the curated quality list on top. Prefer models with `maxRefImages > 0` so the Phase 3 reference flow is meaningful.
3. Excluded by layer (a): Kling v3, Kling o3, Recraft v3, Grok Imagine. Eligible: FLUX, FLUX 2 Pro, Seedream v4/v4.5, GPT Image 1.5/2, Nano Banana 2, FLUX Pro Kontext.
4. Point both canvas Generate and Combine at this single curated source for consistency.

_Files:_ new `src/features/canvas/canvas-models.ts` (or similar), `CanvasGenerateDialog.tsx`, `CanvasCombineDialog.tsx`.

## Phase 3 — Overhaul the Generate popup (depends on Phase 2)

1. **Simplify:** remove paste-prompts + multi-prompt rows; leave a single "Add prompt" field (canvas-only — don't touch the AI Images generator).
2. **Remove** "Pick From Library" and "Upload Image" controls.
3. **Add reference images:** surface `RefImageStrip` (already conditional on `maxRefImages > 0`). Reference images are NOT added to the canvas.
4. **Parity:** ensure the canvas generate path (`use-canvas-generate.ts` `handleGenerate` override) forwards `referenceImageIds` into `generateImage` like `use-generator.ts:327`, so `generation_metadata.reference_image_ids` is recorded identically to AI Images.

_Files:_ `CanvasGenerateDialog.tsx`, `use-canvas-generate.ts`, `GeneratorPanel` props (canvas usage only).

## Phase 4 — Surface Generate on selection (depends on Phase 3)

1. Selecting a single image exposes a Generate button on/near that image; deselect hides it. Opens `CanvasGenerateDialog`.
2. Decide whether to **drop** the bottom-toolbar Generate button (user dislikes two ways to do one thing — likely remove it once the on-image affordance exists).

_Files:_ `InfiniteCanvas.tsx`, `SelectionActions.tsx`.

## Phase 5 — Move to Trash from canvas

1. Add "Move to Trash" to the image context menu (and wire the Phase 1 toast action).
2. Must `setOnCanvas(false)` **then** set `deleted_at` — Trash's linked-image protection blocks trashing any row with `on_canvas = true`.

_Files:_ `InfiniteCanvas.tsx`, canvas persistence, trash mutation path.

---

## Verification

- `pnpm check` + `pnpm build` clean.
- Manual (preview): delete→remove+undo+escalate-to-trash; curated dropdown shows only ref-capable models; generate with reference images; confirm `generation_metadata.reference_image_ids` written (matches an equivalent AI Images request).
- Tests for critical paths: delete/trash semantics (data-loss adjacent), referenceImageIds parity.

## Open / deferred (not in this batch)

- Prompt-enhancement quality — tracked separately in [genzen#155](https://github.com/joshcoolman/genzen/issues/155).
