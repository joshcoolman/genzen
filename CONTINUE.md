# Continue: ImageStorage Abstraction (#111)

## What was done this session

### Rate limiting (#103) -- DONE, merged, issue closed

- Migration: `rate_window_start`/`rate_window_count` on `user_profiles` + atomic `check_rate_limit()` RPC
- `src/lib/server/rate-limit.server.ts` — 20 req/min image, 5 req/min video, fails open
- Wired into `generate-image`, `edit-image`, `generate-variation`, `generate-flf-video`

### ModelSelector panel mode -- merged

- New `'panel'` DisplayMode in `src/components/ModelSelector/ModelSelector.tsx`
- Collapsible section with vertical model list (not dropdown, not inline pills)
- `persistKey` prop saves expand/collapse to localStorage, default expanded
- `GeneratorPanel.tsx` uses `display="panel"` with `persistKey="genzen:model-panel:expanded"`

### critical-path.md -- updated and committed

- Gate 1 = infra/security/optimization, Gate 2 = payments, Gate 3 = marketing
- #103 marked DONE, sequence reordered to front-load hardening

### ImageStorage epic (#111) -- issue created

- Comprehensive GitHub issue with 6-phase plan for storage abstraction + R2 migration
- Full audit of 30+ files with scattered `supabase.storage.from('user-images')` calls

## Next step

Start #111 Phase 1: create `ImageStorage` interface + `SupabaseImageStorage` implementation in `src/lib/server/image-storage.server.ts` (file already exists with narrow `storeDownloadedImage` function -- expand it). See issue #111 for full phase breakdown and file-by-file migration list.

## Key context for next session

- Target architecture: R2 + pre-generated Sharp thumbnails (~$16/mo at 1K users vs $2,544 with Supabase transforms)
- Signed URL cache-busting is the core perf problem (R2 public URLs fix this)
- Soft-delete confirmed to orphan storage files -- abstraction enables fixing this
- `storage-url-cache.ts` (getCachedSignedUrl/invalidateCachedUrl) should be absorbed into ImageStorage.getUrl()
- FAL storage uploads (`fal.storage.upload`) are NOT part of this abstraction

## Git state

- Branch: `main`, clean, all pushed
