## Overview

Manages all user-uploaded and AI-generated images. Provides upload, gallery browsing with filters/sort, batch ZIP download, clipboard paste, color palette extraction, and duplicate detection via file hashing. Central image storage layer used by most other features.

## How It Works

1. Images uploaded to storage (Supabase/R2) with DB record in `user_images`
2. Duplicate detection via SHA-256 file hash
3. Gallery with filter tabs (uploads, AI-generated, videos), sort, and adjustable thumbnail size
4. View preferences persisted to localStorage
5. Signed URLs with 24h TTL, loaded per-image
6. Soft-delete sets `deleted_at` (recoverable via Trash feature)

## Usage

- Navigate to Assets from sidebar
- Upload images, browse gallery with filters
- Click image for lightbox editing
- Supports `?imageId=` deep link to open specific image

## Key Files

- `src/features/user-images/types.ts` -- UserImage, CollectedImage, CreateUserImageInput types, Zod schemas
- `src/features/user-images/hooks/useUserImages.ts` -- CRUD hook: fetch, create, update, soft-delete via Supabase client
- `src/features/user-images/hooks/useExistingImages.ts` -- Fetch existing images + signed URLs (used by combine, shots)
- `src/features/user-images/hooks/useImageUpload.ts` -- Storage upload + DB insert + thumbnail generation
- `src/features/user-images/hooks/useClipboardPaste.ts` -- Global paste listener for image upload
- `src/features/user-images/hooks/useDownloadImages.ts` -- Batch ZIP download (JSZip + file-saver, concurrency=4)
- `src/features/user-images/lib/file-hash.ts` -- Client-side SHA-256 for duplicate detection
- `src/features/user-images/lib/palette-generator.ts` -- Color palette extraction via Canvas + k-means clustering in LAB space
- `src/features/user-images/lib/process-files.ts` -- Shared pipeline: hash, title, validate, upload
- `src/features/user-images/components/UserImagesDisplay.tsx` -- Grid, filters (uploads/AI/videos), sort, upload
- `src/features/user-images/components/ExistingImagePicker.tsx` -- Dialog with source filter tabs, checkbox select
- `src/features/user-images/components/ImageEditDialog.tsx` -- Lightbox for editing title/description

## Dependencies

- Supabase -- storage (user-images bucket), DB, RLS
- `@/components/Thumbnail`, `@/components/ImageGrid` -- shared display components

## Configuration

- Max upload: 50MB
- Allowed types: JPEG, PNG, WebP, GIF
- Storage bucket: `user-images`

## Route

`/dashboard/assets`
