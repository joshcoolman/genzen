# Continue: Async Thumbnail Generation (#111 Phase 4)

## What was done this session

### ImageStorage abstraction (#111 Phases 1-3) -- DONE, merged to main

- Created `src/lib/image-storage.ts`: `ImageStorage` interface, `SupabaseImageStorage` class, `createImageStorage(supabase)` factory
- Migrated all ~30 files that called `supabase.storage.from('user-images')` to use the abstraction
- Deleted `src/lib/storage-url-cache.ts` (absorbed into `ImageStorage.getUrl()` with built-in cache)
- Two commits: Phase 1-2 (interface + server callers), Phase 3 (client callers + cleanup)

### R2 migration issue (#112) -- created

- Covers Phases 5-6: `R2ImageStorage` implementation, batch migration, orphan cleanup, gallery virtualization
- Separate from #111 because it introduces a new vendor (Cloudflare R2)

## Next step

#111 Phase 4: Async thumbnail generation. Decouple `generateAndStoreThumbnail` from the synchronous image completion pipeline so images appear ~200-500ms faster.

### Current flow (synchronous)

1. Image completes (FAL/Google) -> download + upload via `ImageStorage`
2. **Blocking:** `generateAndStoreThumbnail()` downloads, resizes with Sharp, uploads WebP
3. DB update with `storage_path` + `thumbnail_path` -> UI shows completed image

### Target flow (async)

1. Image completes -> download + upload via `ImageStorage`
2. DB update with `storage_path` + `thumbnail_path: null` -> status `completed` -> UI shows full image
3. **Background:** generate thumbnail, then update `thumbnail_path` via DB
4. Gallery picks up `thumbnail_path` via existing Supabase Realtime subscription

### Key files

- `src/lib/server/generate-thumbnail.server.ts` -- the Sharp resize + upload function (already uses `ImageStorage`)
- `src/lib/server/image-storage.server.ts` -- `downloadAndStoreImage()` calls `generateAndStoreThumbnail` synchronously
- `src/lib/server/media.server.ts` -- Google provider path, also calls `generateAndStoreThumbnail` synchronously
- `src/lib/server/fal-completion.server.ts` -- FAL path, calls `downloadAndStoreImage` which handles thumbnail
- Gallery hooks (`use-images.ts`, `useUserImages.ts`) -- already prefer `thumbnail_path` when available, fall back to `storage_path`

### Approach

- Remove `generateAndStoreThumbnail` call from `downloadAndStoreImage` and `media.server.ts`
- Fire thumbnail generation as a background task after DB update (fire-and-forget)
- When thumbnail completes, update `thumbnail_path` on the DB record
- Gallery already handles null `thumbnail_path` by falling back to `storage_path`

## Git state

- Branch: `main`, clean, all pushed
