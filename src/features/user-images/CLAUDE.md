# User Images

Manage user-uploaded and AI-generated images. Reads and writes go through
server actions that take identity from the session cookie -- the browser no
longer talks to the database.

## Key Files

- `types.ts` -- UserImage, CollectedImage, CreateUserImageInput types, Zod schemas, ColorPalette/ShadeScale types
- `hooks/use-user-images.ts` -- CRUD hook: fetch, create, update, soft-delete images via `server/images.action`
- `hooks/use-existing-images.ts` -- Fetch the user's existing library rows for the shared image picker (URLs come from `#/lib/image-url`, never the bucket)
- `lib/file-hash.ts` -- Client-side SHA-256 hashing for duplicate detection
- `lib/save-to-library.ts` -- `saveFileToLibrary()`: object to storage, then the
  row, then a background thumbnail, with a rollback if the insert fails.
  **The only write path into the library** (#215). **Standalone, not a hook**, so
  a caller that only needs to write one image does not mount `useUserImages` --
  that hook fetches the whole library on mount, and a second copy on the same
  page doubles the query. `useUserImages.create` delegates to it
- `lib/filename-parser.ts` -- Converts filenames to title-case display names
- `server/images.action.ts` -- list / create / update / soft-delete, user scoped by `resolveAuth()`
- `server/image-groups.action.ts` -- `listImageGroupNames()`: every group's id
  and name, for narrowing the shared picker to one. Deliberately not
  `listImageGroups()` in `images/_actions/`, which carries a cover, a preview
  strip and a live count for the Images grid and sits with the route owning
  every group *write* -- four routes render the picker, so it may not reach
  into one of them
- `server/upload-image.action.ts` -- server action wrapper for image upload
- `server/upload-image-internal.server.ts` -- core async implementation for the bucket upload, with magic-byte validation and user-scoped path enforcement
- `server/remove-images.action.ts` -- Server function for deleting images from the bucket (batch, user-scoped)
- `server/create-thumbnail.action.ts` -- Server function for async thumbnail generation post-upload

## Route and UI

No dedicated route, and no components: this is a headless utility feature. Its
writer (`saveFileToLibrary`), its hooks (`useUserImages`, `useExistingImages`)
and its upload/remove/thumbnail server actions are consumed by the ai-images and
canvas routes. The library picker they both open is
`app/(authenticated)/_components/existing-image-picker/`.

## Shared Dependencies

Headless, so this is short. What the folder imports, in full: `resolveAuth`,
`sql`, `createImageStorage`, `imageUrl`, `userImageColumns`,
`generateAndStoreThumbnail`, and React. No `#/components`, no `#/lib/auth` --
the routes that consume this feature bring those.

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
- **A thumbnail is not the caller's decision** (#215). It is generated inside
  `saveFileToLibrary`, in the background, and its failure is tolerated -- reads
  fall back to `storage_path`, so a missing thumbnail is slower, never broken.
  When there were three upload functions, only one made a thumbnail, so whether
  the grid downloaded full-size objects depended on which one you went through
- Delete is soft-delete (sets `deleted_at` timestamp)
- **The bucket is private** (#226). Nothing is served by its object URL; the
  browser reads images from `/img/[id]`, which resolves identity from the cookie
  and filters the row by `user_id`. Build URLs only through `#/lib/image-url`.
- Storage goes through `createImageStorage()` from `#/lib/image-storage`
- `user_images.color_palette` and the `ColorPalette` type in `types.ts` are a
  column and a shape with nothing writing them -- there is no palette generator.
  The column is selected into every image read and indexed on a predicate that
  is always false; #472 has the details
- **Max upload size: 15MB** (`MAX_FILE_SIZE` in `types.ts`); allowed types:
  JPEG, PNG, WebP, GIF. **That number and two limits in
  `next.config.ts` are one decision** (#482): a file reaches the server base64'd
  inside a Server Action call, a third larger than itself, and passes through
  `proxy.ts` on the way -- so `serverActions.bodySizeLimit` **and**
  `experimental.proxyClientMaxBodySize` both have to admit it. The second is the
  one that actually bit: it defaults to exactly 10MB and **truncates rather than
  failing**, so a 9MB upload reached the action as a cut JSON string
  ("Unterminated string in JSON at position 10484432") with only a `console.warn`
  in the dev terminal. Raising the cap means raising all three. `saveFileToLibrary` refuses an oversized file before encoding
  it, and every upload failure now says why -- the old `catch {}` in
  `use-uploads.ts` was the whole reason this read as "uploads just don't work"
