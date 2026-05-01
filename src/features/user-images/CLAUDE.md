# User Images

Manage user-uploaded and AI-generated images with Supabase storage and RLS.

## Key Files

- `types.ts` -- UserImage, CollectedImage, CreateUserImageInput types, Zod schemas, ColorPalette/ShadeScale types
- `hooks/useUserImages.ts` -- CRUD hook: fetch, create, update, soft-delete images via Supabase client
- `hooks/useExistingImages.ts` -- Fetch user's existing images + signed URLs (used by shots, combine, style-trainer)
- `hooks/useImageUpload.ts` -- Supabase storage upload + DB insert + triggers background thumbnail generation
- `hooks/useClipboardPaste.ts` -- Global paste listener that uploads clipboard images
- `hooks/useDownloadImages.ts` -- Batch download as ZIP (uses JSZip + file-saver, concurrency=4)
- `lib/file-hash.ts` -- Client-side SHA-256 hashing for duplicate detection
- `lib/filename-parser.ts` -- Converts filenames to title-case display names
- `lib/palette-generator.ts` -- Extracts color palettes from images using Canvas + k-means clustering in LAB space
- `lib/process-files.ts` -- Shared pipeline for file picker and clipboard: hash, title, validate, upload
- `server/upload-image.server.ts` -- TanStack server fn wrapper for image upload
- `server/upload-image-internal.server.ts` -- core async implementation for R2 upload with magic-byte validation and user-scoped path enforcement; called directly by MCP tools to avoid TanStack RPC stub corruption
- `server/remove-images.server.ts` -- Server function for deleting images from R2 storage (batch, user-scoped)
- `server/create-thumbnail.server.ts` -- Server function for async thumbnail generation post-upload
- `components/UserImagesDisplay.tsx` -- Main orchestrator: grid, filters (uploads/AI images/videos), sort, upload, clipboard paste
- `components/ImageCard.tsx` -- Thumbnail card wrapping shared Thumbnail component
- `components/ImageGrid.tsx` -- Re-exports shared ImageGrid, provides EmptyState
- `components/ImageUploadButton.tsx` -- File picker button with multi-file support
- `components/ImageDownloadButton.tsx` -- Dropdown for downloading all/uploads/AI-generated as ZIP
- `components/ImageEditDialog.tsx` -- Full-screen lightbox for editing title/description
- `components/ExistingImagePicker.tsx` -- Dialog with source filter tabs, checkbox select (used by combine)

## Route

UserImagesDisplay is rendered within the dashboard layout; supports `?imageId=` deep link to open lightbox

## Shared Dependencies

- `@/lib/supabase` -- Supabase client (RLS enforces security)
- `@/lib/auth` -- useAuth for user context
- `@/components/Thumbnail` -- Shared composable thumbnail component
- `@/components/ImageGrid` -- Shared responsive grid
- `@/components/ActionButton` -- Shared loading button
- `@/components/video-player-dialog` -- AI video playback
- `@/features/ai-video` -- `useVideos` hook for fetching videos from the unified `user_images` table

## Quirks / Notes

- Most CRUD runs client-side with Supabase RLS; upload, remove, and thumbnail generation are server functions
- Delete is soft-delete (sets `deleted_at` timestamp)
- Storage uses R2 public URLs (no signing/expiry), loaded incrementally per-image
- View preferences (filter, sort, thumb size, info toggle) persist to localStorage (`assets-view-prefs`)
- Palette generator runs entirely in-browser via Canvas API (no edge function)
- Storage uses R2 via `createImageStorage()` from `@/lib/image-storage`
- Max upload size: 50MB; allowed types: JPEG, PNG, WebP, GIF
- Source filtering includes AI videos as a separate tab
