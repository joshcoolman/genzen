# Continue: Canvas Supabase-Backed Images Refactor

## Context / Why

Canvas generation from a source image was broken -- source image not passing to FAL, wrong aspect ratio, thumbnail-sized pastes. While debugging, we realized the root cause is architectural: Canvas stores images as ephemeral data URLs in IndexedDB, while AI Images stores everything in Supabase (`user_images` table). This mismatch causes CORS issues, URL format juggling, and thumbnail-vs-full-res problems that are unfixable without changing the storage model.

User decided: **Canvas should use Supabase storage like AI Images. All images are just images -- the distinction (uploaded, pasted, generated) is metadata, not a different storage path.**

## Changes made so far (uncommitted, branch `canvas-generate-reuse`)

Intermediate bug fixes that should be **discarded or superseded** by the larger refactor:

- `use-canvas-generate.ts`: Added `detectAspectRatio` import, aspect ratio detection from canvas image dimensions in `open()`, fetch+convert for non-data-URL sources
- `InfiniteCanvas.tsx`: Paste handler grabs clipboard file as CORS fallback before async fetch
- Deleted old files: `CanvasVariationsDialog.tsx` (old), `use-canvas-variations.ts`, `canvas-generate.server.ts`

These fixes were band-aids. The real fix is the architectural change below.

## Key decisions

1. **Canvas images go to Supabase** -- paste/drop uploads to `user_images` immediately, canvas state stores `recordId` + layout (x, y, width, height, groups), not image data
2. **"Everything is just an image"** -- no meaningful distinction between user-uploaded and AI-generated images at the storage level. The `source` column on `user_images` tracks origin (`'uploaded'`, `'pasted'`, `'ai_generated'`). Code should not branch on this.
3. **Canvas generation becomes trivial** -- `open()` passes `recordId` instead of data URL. Same pipeline as AI Images. No CORS, no data URL juggling, no `ensureSourceRecordId` hack.
4. **IndexedDB stays for layout only** -- positions, groups, zoom/pan transform. Image display uses Supabase signed URLs (full-res, not 400px thumbnails).
5. **Gallery thumbnails are the paste-size problem** -- `use-images.ts` creates signed URLs with `transform: { width: 400 }`. When user copies an image from AI Images gallery, clipboard HTML has the 400px URL. Canvas needs full-res.

## Existing infrastructure to reuse

### Upload path (`useUserImages.create()`)

- Located: `src/features/user-images/hooks/useUserImages.ts` line 148
- Accepts: `CreateUserImageInput { title: string, file: File, file_hash: string, description?: string }`
- Does: upload to `user-images` bucket → insert `user_images` row → returns `UserImage` row (has `.id`, `.storage_path`)
- Storage path format: `{userId}/{timestamp}_{uuid}_{sanitizedFileName}`
- Hash util: `computeFileHash(file)` from `src/features/user-images/lib/file-hash.ts`
- Already used by canvas in `ensureSourceRecordId` (fire-and-forget) -- will become the primary path

### Signed URL generation (full-res)

- Pattern from `ImageEditDialog.tsx` line 58: `supabase.storage.from('user-images').createSignedUrl(path, 86400)` -- no transforms = full-res
- Gallery uses transforms: `.createSignedUrl(path, 86400, { transform: { width: 400, resize: 'contain', quality: 80 } })` -- avoid this for canvas display
- Canvas should use full-res signed URLs, possibly with a longer TTL and a URL cache in state

### `user_images` table columns (relevant subset)

- `id` (uuid, PK), `user_id`, `storage_path`, `status` ('completed'/'pending'/'failed')
- `source` ('ai_generated' / 'uploaded' -- may want to add 'pasted' or 'canvas')
- `title`, `file_name`, `file_size`, `mime_type`, `file_hash`
- `generation_metadata` (jsonb -- prompt, model, aspect_ratio, etc.)
- `sort_order` (float, for gallery ordering)
- `deleted_at` (soft delete)

### `CanvasImage` type (current)

```ts
// src/features/canvas/types.ts
export interface CanvasImage {
  id: string // canvas-local UUID
  src: string // data URL or remote URL (THE PROBLEM)
  x: number
  y: number
  width: number
  height: number
  pending?: boolean
  recordId?: string // optional link to user_images (added recently)
}
```

### `PersistedState` (IndexedDB schema)

```ts
export interface PersistedState {
  images: Array<CanvasImage> // currently includes src (data URLs = huge)
  transform: Transform // { x, y, scale }
  groups?: Array<CanvasGroup> // { id, imageIds, columns, padding }
}
```

## Detailed refactor plan

### Phase 1: Change `CanvasImage` type and persistence

**`src/features/canvas/types.ts`**:

```ts
export interface CanvasImage {
  id: string // canvas-local UUID (NOT the user_images id)
  recordId: string // REQUIRED link to user_images (was optional)
  x: number
  y: number
  width: number
  height: number
  pending?: boolean
  // REMOVED: src -- no longer stored
  // Runtime only (not persisted):
  signedUrl?: string // cached signed URL for display
}
```

**`src/features/canvas/lib/persistence.ts`**:

- `savePersistedState`: strip `signedUrl` before saving (it's ephemeral, expires)
- `loadPersistedState`: returns images without `signedUrl` -- canvas must fetch them on load

**Migration concern**: existing IndexedDB data has `src` (data URLs) and optional `recordId`. Need a migration path:

- On load, if image has `src` but no `recordId`, upload it to Supabase and get a `recordId`
- Or: just clear canvas state on first load after the change (simpler, acceptable for this stage)

### Phase 2: Upload on paste/drop

**`src/features/canvas/components/InfiniteCanvas.tsx`**:

Current paste flow:

1. Get file from clipboard → `fileToDataUrl()` → `addImageFromDataUrl(dataUrl, x, y)` → canvas image with `src: dataUrl`

New paste flow:

1. Get file from clipboard
2. Compute hash: `computeFileHash(file)`
3. Upload via `userImages.create({ title: 'Canvas Image', file, file_hash })`
4. Get back `UserImage` with `.id` and `.storage_path`
5. Fetch full-res signed URL: `supabase.storage.from('user-images').createSignedUrl(storagePath, 86400)`
6. Determine dimensions (from `new Image()` loaded with the signed URL, or from the original file)
7. Add to canvas: `{ id: uuid(), recordId: record.id, x, y, width, height, signedUrl }`

**Show loading state**: Since upload takes a moment, show a placeholder skeleton at the paste position. Replace with real image when upload + URL fetch completes. Use the same `pending: true` pattern as generation placeholders.

**`addImagesFromFiles` / `addImageFromDataUrl`**: These helpers need to become async and include the upload step. Or create a new `addImageFromFile(file, x, y)` that does upload+add.

**Drop handler** (`onDrop`): same pattern as paste -- upload first, then add to canvas.

**Library picker** (`ExistingImagePicker`): when picking from library, the `recordId` is already known. Just need to fetch a full-res signed URL and add the layout entry.

### Phase 3: Display with signed URLs

**On canvas load**:

- Read `PersistedState` from IndexedDB (has `recordId` per image, no `signedUrl`)
- Batch-fetch signed URLs: for each image, `supabase.storage.from('user-images').createSignedUrl(storagePath, 86400)`
- Need `storage_path` -- either persist it alongside `recordId` in IndexedDB, or fetch from `user_images` table on load
- Simpler: persist `{ recordId, storagePath }` in IndexedDB so we don't need a DB query on load
- Set `signedUrl` on each image in state

**Image rendering in canvas** (`InfiniteCanvas.tsx`):

- Currently renders `<img src={img.src}>` -- change to `<img src={img.signedUrl}>`
- If `signedUrl` is undefined (loading), show a placeholder

**URL refresh**: Signed URLs expire (currently 24h). If canvas stays open > 24h, URLs break. Could:

- Re-fetch on visibility change (`document.addEventListener('visibilitychange', ...)`)
- Or just re-fetch when an image fails to load (`onError`)

### Phase 4: Simplify generation

**`src/features/canvas/hooks/use-canvas-generate.ts`**:

Current `open()` does:

- Set source image from data URL or remote URL (with CORS workarounds)
- Detect aspect ratio from canvas dimensions
- Pre-fill prompt from generation_metadata

New `open()`:

- The source image already has a `recordId`
- Fetch `user_images` record to get `storage_path` + `generation_metadata`
- Get full-res signed URL
- Call `generator.setSourceFromUrl(signedUrl, 'canvas-image')` -- this works reliably because Supabase signed URLs have CORS headers
- Set aspect ratio from canvas image dimensions (keep existing `detectAspectRatio` call)
- Pre-fill prompt from `generation_metadata.prompt`

**Remove**: `ensureSourceRecordId`, `dataUrlToFile`, the data URL vs URL branching in `open()`

**`handleAfterSubmit`**: Currently maps record IDs to placeholders and polls for completion, then fetches signed URL → converts to data URL. Simplify: poll for completion, then just store the `recordId` on the canvas image and fetch a signed URL. No data URL conversion.

### Phase 5: Cleanup

- Remove `fileToDataUrl` import/usage in canvas (only needed if migrating old data)
- Remove `dataUrlToFile` helper from `use-canvas-generate.ts`
- Remove `ensureSourceRecordId` callback
- Update `src/features/canvas/CLAUDE.md` to reflect new architecture
- Delete old dead files if not already deleted: `CanvasVariationsDialog.tsx`, `use-canvas-variations.ts`, `canvas-generate.server.ts`

## Gotchas / Edge cases

- **Auth required**: Upload needs `userId` from `useAuth()`. Canvas must handle unauthenticated state (disable paste? show login prompt?)
- **Duplicate detection**: `computeFileHash` prevents re-uploading the same file. But pasting the same image twice should create two canvas items pointing to the same `recordId`. That's fine.
- **Offline**: Canvas currently works offline (IndexedDB + data URLs). Supabase-backed images require connectivity. This is an acceptable tradeoff.
- **IndexedDB size**: Data URLs made IndexedDB huge. With just layout data, it becomes tiny. Big win.
- **Signed URL in `PersistedState`**: Don't persist `signedUrl` -- it expires. Persist `recordId` + `storagePath`, re-fetch URLs on load.

## Key files to read

| File                                                      | Why                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/features/canvas/types.ts`                            | `CanvasImage` type to change                                          |
| `src/features/canvas/lib/persistence.ts`                  | IndexedDB save/load to update                                         |
| `src/features/canvas/components/InfiniteCanvas.tsx`       | Paste, drop, render, ~1200 lines                                      |
| `src/features/canvas/hooks/use-canvas-generate.ts`        | Generation hook to simplify                                           |
| `src/features/canvas/components/CanvasGenerateDialog.tsx` | Dialog wrapping GeneratorPanel                                        |
| `src/features/user-images/hooks/useUserImages.ts`         | `create()` method for upload (line 148)                               |
| `src/features/user-images/lib/file-hash.ts`               | `computeFileHash(file)` for dedup                                     |
| `src/features/ai-images/hooks/use-generator.ts`           | `useGenerator` -- `setSourceFromUrl`, `setSourceFromBase64`           |
| `src/features/ai-images/hooks/use-images.ts`              | Gallery signed URL pattern (line 96) -- **avoid** the 400px transform |
| `src/features/ai-images/constants.ts`                     | `detectAspectRatio(w, h)` utility                                     |

## Git state

- Branch: `canvas-generate-reuse`
- Uncommitted: intermediate bug fixes in `use-canvas-generate.ts` and `InfiniteCanvas.tsx` (may want to `git stash` or `git checkout -- .` before starting the refactor since they'll be superseded)
- Last commit: `ce7e206` canvas: reuse AI Images GeneratorPanel for canvas generation
- Old deleted files in working tree: `CanvasVariationsDialog.tsx`, `use-canvas-variations.ts`, `canvas-generate.server.ts`
