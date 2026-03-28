# Continue: Cloudflare R2 Storage Migration (Issue #112)

## Branch

`feat/r2-image-storage` -- PR #115 open, 3 commits ahead of main. All changes committed and pushed.

## What was done

- Added `R2ImageStorage` class to `src/lib/image-storage.ts` using `@aws-sdk/client-s3`
- Factory function `createImageStorage()` checks `VITE_STORAGE_PROVIDER` (client) / `STORAGE_PROVIDER` (server) to pick R2 vs Supabase
- R2 `getUrl` returns plain public URLs (no signing, permanent CDN cache)
- S3 credentials stay server-only (`process.env`); only `VITE_STORAGE_PROVIDER` and `VITE_R2_PUBLIC_URL` are client-visible
- AI image generation (server-side via `downloadAndStoreImage` in `image-storage.server.ts`) works end-to-end on R2 -- tested and confirmed
- Added Supabase fallback for client-side upload/download/remove when S3 client is null

## What's broken (the remaining task)

User image uploads go through `useImageUpload.ts` which calls `createImageStorage(supabase).upload()` **client-side**. With R2 active, the S3 client is null on the client, so it falls back to Supabase. But `getUrl` returns R2 URLs for everything -- so uploaded files are in Supabase but display URLs point to R2, causing black/broken thumbnails.

## The fix needed: move client-side storage writes to server functions

The core issue is that Supabase's JS SDK allows direct client-side uploads (browser -> Supabase Storage), but R2's S3 API requires server credentials. All `upload`, `download`, and `remove` calls from client hooks need to go through TanStack server functions instead.

### Specific call sites to migrate

1. **`src/features/user-images/hooks/useImageUpload.ts:35`** -- user file upload (File -> storage). Create a `uploadImage` server function that accepts base64/ArrayBuffer + metadata, uploads via R2 server-side.
2. **`src/features/user-images/hooks/useClipboardPaste.ts`** -- clipboard paste upload. Uses the same upload path, should work once useImageUpload is fixed.
3. **`remove` calls** -- grep for `.remove(` in hooks that call `createImageStorage`. These need server functions too (or at least the R2ImageStorage.remove should always use server credentials).
4. **`download` calls** -- less critical since R2 public URLs can be fetched directly via `fetch()`.

### Pattern to follow

See `src/features/user-images/server/create-thumbnail.server.ts` for the existing server function pattern: `createServerFn({ method: 'POST' })` with `requireAuth` + `getSupabaseAdmin`.

### After migration

- Remove the Supabase fallback from R2ImageStorage (the `this.fallback` pattern is transitional)
- Remove `SupabaseImageStorage` class entirely if no longer needed
- Clean up: can remove the Supabase `user-images` bucket once confirmed

## Env vars in .env.local

```
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=<set>
R2_ACCESS_KEY_ID=<set>  (32-char S3 Auth token, NOT the 64-char Account API token)
R2_SECRET_ACCESS_KEY=<set>
R2_BUCKET_NAME=genzen-images
R2_PUBLIC_URL=https://pub-a37265d861064afe91729ec3e0068aa5.r2.dev
VITE_STORAGE_PROVIDER=r2
VITE_R2_PUBLIC_URL=https://pub-a37265d861064afe91729ec3e0068aa5.r2.dev
```

## Cloudflare R2 setup (done)

- Account ID: 43d49d56d3b13fc6ebf246260b6126fe
- Bucket: genzen-images (public dev URL enabled)
- S3 Auth token created (the second one -- first was an Account API token which has wrong key length)

## Key file

`src/lib/image-storage.ts` -- the ImageStorage interface, SupabaseImageStorage, R2ImageStorage, and createImageStorage factory
