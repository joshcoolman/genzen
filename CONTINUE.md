# Continue: AI Images Multi-Select -- Add Delete & Move Actions

## Branch: `feature/ai-images-multi-select` (all committed, clean, pushed)

## What was built this session

Two multi-select systems built on shared primitives:

### Shared primitives (reusable across features)

- `src/lib/use-selection.ts` -- headless selection hook: `Set<string>` state, `toggle(id, shiftKey)` with shift-range, `selectAll`, `clearSelection`, auto-prunes stale IDs
- `src/components/SelectionDrawer.tsx` -- fixed-position bottom bar with show/hide animation (plain div, NOT Vaul -- Vaul blocked pointer events). Consumer passes action buttons as children
- `src/components/Thumbnail.tsx` -- added `overlayActionsBottomLeft`, `listImageClassName`, `onClick` now passes optional `MouseEvent`
- `src/components/ui/drawer.tsx` -- shadcn Drawer (vaul) installed but NOT used by SelectionDrawer (kept for future use)

### Trash feature (complete, merged to main)

- Multi-select with shift-click, circle/check icons, batch delete/restore via `permanentDeleteMany`/`restoreMany` in `useTrash`
- SelectionDrawer with "Restore (N)" + "Delete (N)" + "Deselect all" buttons
- Larger thumbnails (`h-24 w-24`), `select-none` on rows

### AI Images feature (selection UI only, on feature branch)

- Circle/check icon in bottom-left of each grid thumbnail (with `bg-background/80 backdrop-blur-sm` matching other overlay icons)
- Two interaction modes: click circle to enter select mode, then transparent `imageOverlay` div makes clicking anywhere on cards reliable
- When selecting: hides menu/delete/lightbox overlays, disables navigation
- Title moved from pill overlay to white text below image (above muted description)
- SelectionDrawer shows "Actions coming soon" placeholder

## Key decisions

- Vaul/shadcn Drawer doesn't work for non-modal overlays (blocks pointer events even with `modal={false}`). Used plain fixed div instead
- Selection entry requires clicking the circle icon specifically (intentional). Once in select mode, transparent overlay makes clicking anywhere reliable -- prevents text selection and drag confusion
- Actions should be portable: `useSelection` + `SelectionDrawer` are shared, batch action hooks will be feature-specific but follow a common pattern

## Next steps -- Phase 2: Delete & Move actions

### Delete action (do first -- simpler)

- Wire a "Delete (N)" button in the SelectionDrawer
- AI Images has 3 delete strategies in `use-images.ts`: `deleteImage` (soft-delete/hide), `deleteImageWithDescendants` (cascade), `deleteAndDetachChildren` (orphan children)
- For batch: likely needs confirmation dialog asking about children (keep/delete)
- Existing single-image delete is already wired via `handleDelete` in `src/routes/dashboard/ai-images.tsx`

### Move action (more complex)

- Reparenting logic exists in `src/features/ai-images/server/reparent-image.server.ts` -- `adopt` action moves image + all descendants under new parent, updates `root_image_id` for entire subtree
- For batch move: select N images, click "Move", pick a target parent via `ParentPickerDialog`, adopt all selected under that parent
- Cycle detection already built in (can't move parent under its own descendant)

### Architecture note

- User wants actions designed for portability to AI Video and other features
- Pattern: composable action hooks like `useBatchDelete(selectedIds, clearSelection)` that wrap existing server operations, return handlers + confirmation UI
- SelectionDrawer stays generic -- consumers compose action buttons as children

## Key files for phase 2

- `src/routes/dashboard/ai-images.tsx` -- where SelectionDrawer children get wired (line ~435)
- `src/features/ai-images/hooks/use-images.ts` -- `deleteImage`, `deleteImageWithDescendants`, `deleteAndDetachChildren`
- `src/features/ai-images/server/reparent-image.server.ts` -- `adopt`/`detach` operations
- `src/features/ai-images/hooks/use-reparent.ts` -- existing single-image reparent UI hook
- `src/features/ai-images/components/ParentPickerDialog.tsx` -- target parent selection UI

---

# Blocked: Google Direct Provider for Nano Banana 2

## Branch: `model-abstraction` (all committed, clean, nano-banana-2 currently on FAL)

## What was built

Provider-aware media generation layer (Epic #81 starter). Full adapter infrastructure in place, tested with both Gemini API and Vertex AI. Currently fallen back to FAL pending one more approach.

## Key files

- `src/lib/server/google-imagen.server.ts` -- Google adapter (currently Vertex AI mode, needs to switch back to Gemini `generateContent` with `imageConfig`)
- `src/lib/server/media.server.ts` -- Provider router: `submitGeneration()` + `isGoogleProvider()`
- `src/features/ai-images/models.ts` -- Added `provider?: 'fal' | 'google'` to `ImageModel`. Currently no provider set on nano-banana-2 (FAL default). Add `provider: 'google'` to re-enable.
- Modified server files to route through `submitGeneration()`: `generate-image.server.ts`, `generate-variation.server.ts`, `submit-variations.server.ts`, `outpaint-image.server.ts`, `generate-storyboard-frame.server.ts`
- `src/features/ai-images/hooks/use-images.ts` -- Fixed trash restore (restored images now re-appear in gallery via realtime)

## BREAKTHROUGH: imageConfig.aspectRatio on generateContent

The `@google/genai` SDK has an `imageConfig` param on `generateContent` that we never used:

```ts
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }],
  config: {
    responseModalities: ['image', 'text'],
    imageConfig: {
      aspectRatio: '16:9', // NATIVE PARAM -- not prompt-based!
    },
  },
})
```

This was confirmed by Gemini's own docs. `ImageConfig` supports:

- `aspectRatio`: '1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'
- `imageSize`: '1K', '2K', '4K'
- `personGeneration`: 'ALLOW_ALL', 'ALLOW_ADULT', 'ALLOW_NONE'

Multi-image limits:

- `gemini-2.5-flash-image`: up to 3 input images
- `gemini-3-pro-image` (Nano Banana Pro): up to 14 reference images

## Next step

Rewrite `google-imagen.server.ts` to use `generateContent` (not Vertex AI `editImage`) with:

1. Multiple inline image parts (base64)
2. `imageConfig: { aspectRatio }` for native aspect ratio control
3. Can use either Gemini API key or Vertex AI auth

This should give us multi-image combining + aspect ratio control + speed. The earlier `generateContent` path worked great for image quality and combining -- we just didn't know about `imageConfig`.

## Architecture (unchanged)

- Two-phase pending record: create `status: 'pending'` immediately, call Google, update to `completed`. Safe for page navigation.
- Google records have no `request_id`, poller skips them
- On failure, record marked `status: 'failed'`
- Reference images fetched as base64 for Google path
- `edit-image.server.ts` (edit page) NOT modified -- still goes through FAL

## Auth setup (both paths available)

- GCP project: `gen-lang-client-0015600225` (aisdk)
- Service account key: `~/.keys-genzen/gen-lang-client-0015600225-00a87d4d2b71.json`
- Env vars: `GOOGLE_APPLICATION_CREDENTIALS` (local Vertex AI), `GOOGLE_SERVICE_ACCOUNT_JSON` (deploy), `GOOGLE_AI_API_KEY` (Gemini API key)
- Vertex AI API: enabled

## To re-enable Google

1. In `models.ts`, add `provider: 'google'` back to nano-banana-2
2. Rewrite `google-imagen.server.ts` to use `generateContent` with `imageConfig`
