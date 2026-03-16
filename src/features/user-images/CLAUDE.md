Manage user-uploaded and AI-generated images with Supabase storage and RLS.

## Key Files

- `types.ts` -- UserImage, CollectedImage, CreateUserImageInput types, Zod schemas, ColorPalette/ShadeScale types
- `hooks/useUserImages.ts` -- CRUD hook: fetch, create, update, soft-delete images via Supabase client
- `hooks/useExistingImages.ts` -- Fetch user's existing images + signed URLs (used by shots, combine, style-trainer)
- `hooks/useImageUpload.ts` -- Supabase storage upload + DB insert, returns CollectedImage
- `hooks/useClipboardPaste.ts` -- Global paste listener that uploads clipboard images
- `hooks/useDownloadImages.ts` -- Batch download as ZIP (uses JSZip + file-saver)
- `lib/file-hash.ts` -- Client-side SHA-256 hashing for duplicate detection
- `lib/filename-parser.ts` -- Converts filenames to title-case display names
- `lib/palette-generator.ts` -- Extracts color palettes from images using Canvas + k-means clustering in LAB space
- `lib/process-files.ts` -- Shared pipeline for file picker and clipboard: hash, title, validate, upload
- `components/UserImagesDisplay.tsx` -- Main orchestrator: grid, filters, sort, upload, clipboard paste
- `components/ImageCard.tsx` -- Thumbnail card wrapping shared Thumbnail component
- `components/ImageGrid.tsx` -- Re-exports shared ImageGrid, provides EmptyState
- `components/ImageUploadButton.tsx` -- File picker button with multi-file support
- `components/ImageDownloadButton.tsx` -- Dropdown for downloading all/uploads/AI-generated as ZIP
- `components/ImageEditDialog.tsx` -- Full-screen lightbox for editing title/description
- `components/ExistingImagePicker.tsx` -- Dialog with source filter tabs, checkbox select (used by combine)

## Route

`src/routes/dashboard/assets.tsx` -- supports `?imageId=` deep link to open lightbox

## Shared Dependencies

- `@/lib/supabase` -- Supabase client (direct queries, no server functions)
- `@/lib/auth` -- useAuth for user context
- `@/components/Thumbnail` -- Shared composable thumbnail component
- `@/components/ImageGrid` -- Shared responsive grid
- `@/components/ActionButton` -- Shared loading button

## Quirks / Notes

- No server functions -- all CRUD runs client-side with Supabase RLS
- Delete is soft-delete (sets `deleted_at` timestamp)
- Signed URLs expire after 1 hour; loaded incrementally per-image
- View preferences (filter, sort, thumb size, info toggle) persist to localStorage
- Palette generator runs entirely in-browser via Canvas API (no edge function)
- Storage bucket name is hardcoded as `user-images`
- Max upload size: 50MB; allowed types: JPEG, PNG, WebP, GIF
