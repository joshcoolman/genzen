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
- `server/create-thumbnail.server.ts` -- Server function for async thumbnail generation post-upload
- `components/UserImagesDisplay.tsx` -- Main orchestrator: grid, filters (uploads/AI images/videos), sort, upload, clipboard paste
- `components/ImageCard.tsx` -- Thumbnail card wrapping shared Thumbnail component
- `components/ImageGrid.tsx` -- Re-exports shared ImageGrid, provides EmptyState
- `components/ImageUploadButton.tsx` -- File picker button with multi-file support
- `components/ImageDownloadButton.tsx` -- Dropdown for downloading all/uploads/AI-generated as ZIP
- `components/ImageEditDialog.tsx` -- Full-screen lightbox for editing title/description
- `components/ExistingImagePicker.tsx` -- Dialog with source filter tabs, checkbox select (used by combine)

## Route

`src/routes/dashboard/assets.tsx` -- supports `?imageId=` deep link to open lightbox

## Shared Dependencies

- `@/lib/supabase` -- Supabase client (RLS enforces security)
- `@/lib/auth` -- useAuth for user context
- `@/components/Thumbnail` -- Shared composable thumbnail component
- `@/components/ImageGrid` -- Shared responsive grid
- `@/components/ActionButton` -- Shared loading button
- `@/components/video-player-dialog` -- AI video playback
- `@/features/ai-video` -- getVideoUrl, getWorkspaces utilities

## Quirks / Notes

- Most CRUD runs client-side with Supabase RLS; thumbnail generation is the one server function
- Delete is soft-delete (sets `deleted_at` timestamp)
- Signed URLs use 24-hour TTL (86400 seconds), loaded incrementally per-image
- View preferences (filter, sort, thumb size, info toggle) persist to localStorage (`assets-view-prefs`)
- Palette generator runs entirely in-browser via Canvas API (no edge function)
- Storage bucket name is hardcoded as `user-images`
- Max upload size: 50MB; allowed types: JPEG, PNG, WebP, GIF
- Source filtering includes AI videos as a separate tab
