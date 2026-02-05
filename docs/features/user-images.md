# User Images

Upload, view, edit, and delete images from the dashboard.

## Status

- [ ] Planned
- [ ] In Progress
- [x] Complete

## Overview

Allows users to manage a personal image library. Images are stored in Supabase Storage with metadata in the database. Useful as a foundation for image-based workflows (e.g., AI image generation reference images).

## Implementation

### Key Files

- `src/features/user-images/` - Feature module
  - `hooks/useUserImages.ts` - State management, CRUD operations
  - `components/UserImagesDisplay.tsx` - Main container
  - `components/ImageGrid.tsx` - Responsive grid layout
  - `components/ImageCard.tsx` - Individual image display
  - `components/ImageUploadButton.tsx` - File picker with auto-hash
  - `components/ImageEditDialog.tsx` - Edit title/description
  - `types.ts` - Types and Zod validation schemas
  - `lib/file-hash.ts` - SHA-256 hashing utilities
  - `lib/filename-parser.ts` - Auto-title generation
- `src/routes/dashboard/images.tsx` - Route component
- `src/components/ui/dialog.tsx` - Dialog component (Radix)

### How It Works

1. **Upload**: User selects files via file picker. Client computes SHA-256 hash, generates title from filename, uploads to Supabase Storage (`user-images` bucket), then creates DB record.

2. **Display**: Hook fetches user's images via Supabase client (RLS enforces ownership). Signed URLs generated for each image.

3. **Edit**: Click image opens dialog. Changes saved on Enter/close with optimistic updates.

4. **Delete**: Optimistic removal from UI, then DB delete, then storage cleanup.

### Dependencies

- Supabase Storage (`user-images` bucket)
- Supabase Database (`user_images` table)
- Radix UI Dialog
- Web Crypto API (for SHA-256)

## Usage

Navigate to `/dashboard/images` from the sidebar. Click "Upload Images" to add files.

## Configuration

No additional configuration needed. Uses existing Supabase credentials.

Required database table and storage bucket are created via migration (`20260204215304_remote_schema.sql`).

## Testing

1. Login as test user
2. Navigate to `/dashboard/images`
3. Upload an image - should appear in grid
4. Click image - edit dialog opens
5. Change title, press Enter - saves
6. Click trash icon - image deleted
7. Refresh page - changes persist

## Future Improvements

- Duplicate detection (file_hash infrastructure exists)
- Search/filter by title
- Pagination
- Bulk selection and delete
- Drag-and-drop upload
- Image dimensions extraction
