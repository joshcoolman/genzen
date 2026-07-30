# User Images

Manage user-uploaded and AI-generated images. Reads and writes go through
server actions that take identity from the session cookie -- the browser no
longer talks to the database.

## Key Files

- `types.ts` -- UserImage, CollectedImage, CreateUserImageInput types, Zod schemas, ColorPalette/ShadeScale types
- `hooks/useUserImages.ts` -- CRUD hook: fetch, create, update, soft-delete images via `server/images.actions`
- `hooks/useExistingImages.ts` -- Fetch user's existing images + public R2 URLs (used by the shared image picker)
- `hooks/useImageUpload.ts` -- S3 upload + DB insert + triggers background thumbnail generation
- `lib/file-hash.ts` -- Client-side SHA-256 hashing for duplicate detection
- `lib/save-to-library.ts` -- `saveFileToLibrary()`: object to storage, then the
  row, with a rollback if the insert fails. **Standalone, not a hook**, so a
  caller that only needs to write one image does not mount `useUserImages` --
  that hook fetches the whole library on mount, and a second copy on the same
  page doubles the query. `useUserImages.create` delegates to it
- `lib/filename-parser.ts` -- Converts filenames to title-case display names
- `lib/palette-generator.ts` -- Extracts color palettes from images using Canvas + k-means clustering in LAB space
- `lib/process-files.ts` -- Shared pipeline for file picker and clipboard: hash, title, validate, upload
- `server/images.actions.ts` -- list / create / update / soft-delete, user scoped by `resolveAuth()`
- `server/upload-image.server.ts` -- server action wrapper for image upload
- `server/upload-image-internal.server.ts` -- core async implementation for R2 upload with magic-byte validation and user-scoped path enforcement
- `server/remove-images.server.ts` -- Server function for deleting images from R2 storage (batch, user-scoped)
- `server/create-thumbnail.server.ts` -- Server function for async thumbnail generation post-upload

## Route and UI

No dedicated route, and no components: this is a headless utility feature. Its
hooks (`useUserImages`, `useImageUpload`, `useExistingImages`) and its
upload/remove/thumbnail server actions are consumed by the ai-images and canvas
routes. The library picker they both open is
`app/(authenticated)/_components/existing-image-picker/`.

## Shared Dependencies

- `#/lib/auth` -- useAuth for user context
- `#/components` -- `Thumbnail`, `ImageGrid`, `ActionButton`

## Quirks / Notes

- **No client-side database access.** Every query is a server action that
  derives `user_id` from the session cookie, so a caller cannot name whose rows
  it wants. RLS is no longer the thing keeping users apart -- the explicit
  `user_id` filter in each action is.
- **An attached image is saved the moment it arrives, not at submit** (#224). An
  image is a complete artifact on arrival, so it is worth keeping whether or not
  a generation follows -- and without a row, a failed generation can never be
  retried, because there is nothing left to send. The typed prompt is the
  opposite case and is captured only at submit; there are no drafts.
- Delete is soft-delete (sets `deleted_at` timestamp)
- Storage uses R2 public URLs (no signing/expiry), loaded incrementally per-image
- Palette generator runs entirely in-browser via Canvas API (no edge function)
- Storage uses R2 via `createImageStorage()` from `#/lib/image-storage`
- Max upload size: 50MB; allowed types: JPEG, PNG, WebP, GIF
