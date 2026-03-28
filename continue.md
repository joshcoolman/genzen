# Continue: Cloudflare R2 Storage Migration (Issue #112)

## Branch

`feat/r2-image-storage` -- PR #115 open.

## What was done

- Added `R2ImageStorage` class to `src/lib/image-storage.ts` using `@aws-sdk/client-s3`
- Removed `SupabaseImageStorage` class entirely -- R2 is the only storage provider
- `createImageStorage()` always creates R2 storage, `supabase` param is accepted but unused
- R2 `getUrl` returns plain public URLs (no signing, permanent CDN cache)
- S3 credentials stay server-only (`process.env`); only `VITE_R2_PUBLIC_URL` is client-visible
- AI image generation (server-side) works end-to-end on R2
- User uploads now go through `uploadImage` server function (`upload-image.server.ts`)
- File removal goes through `removeImages` server function (`remove-images.server.ts`)
- Client hooks (`useImageUpload`, `useUserImages`, `useTrash`) all use server functions for writes
- Client-side `getUrl` returns R2 public URLs directly (no S3 client needed)
- Zero direct Supabase storage API calls remain in client code

## New server functions

- `src/features/user-images/server/upload-image.server.ts` -- accepts base64 + metadata, uploads via R2 server-side
- `src/features/user-images/server/remove-images.server.ts` -- accepts storage paths, removes via R2 server-side

## What to test

1. Upload an image via the Assets page -- should appear with correct thumbnail
2. AI image generation -- should still work end-to-end
3. Trash: permanent delete single, batch delete, empty trash -- all should work
4. All gallery views should load thumbnails via R2 public URLs
5. Clipboard paste upload should work

## Env vars in .env.local

```
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=<set>
R2_ACCESS_KEY_ID=<set>
R2_SECRET_ACCESS_KEY=<set>
R2_BUCKET_NAME=genzen-images
R2_PUBLIC_URL=https://pub-a37265d861064afe91729ec3e0068aa5.r2.dev
VITE_STORAGE_PROVIDER=r2
VITE_R2_PUBLIC_URL=https://pub-a37265d861064afe91729ec3e0068aa5.r2.dev
```

## Key files

- `src/lib/image-storage.ts` -- R2-only ImageStorage interface + R2ImageStorage + createImageStorage factory
- `src/features/user-images/server/upload-image.server.ts` -- server fn for uploads
- `src/features/user-images/server/remove-images.server.ts` -- server fn for removes
- `src/features/user-images/hooks/useImageUpload.ts` -- updated to use server fns
- `src/features/user-images/hooks/useUserImages.ts` -- updated to use server fns
- `src/features/trash/hooks/useTrash.ts` -- updated to use server fn for removes

## After confirming everything works

- Can remove `VITE_STORAGE_PROVIDER` and `STORAGE_PROVIDER` env vars (R2 is now hardcoded)
- Can remove the `user-images` Supabase storage bucket
- Can remove `@supabase/storage-js` dependency if no other code uses it
