# Trash

Soft-delete recovery for user images. Supports restore, permanent delete, batch operations, and ZIP archive download.

## Key Files

- `index.ts` -- Re-exports `TrashDisplay` and `useTrash`
- `hooks/useTrash.ts` -- Core hook: fetches trashed images, manages linked image detection, signs storage URLs, handles restore/delete/batch/empty
- `components/TrashDisplay.tsx` -- Full-page UI with image list, single/batch restore/delete, linked image badges, empty-trash confirmation
- `components/TrashDownloadButton.tsx` -- Dialog for downloading all trash images as ZIP with custom filename (JSZip + file-saver, concurrency=4)

## Route

`src/routes/dashboard/trash.tsx`

## Shared Dependencies

- `@/features/user-images/types` -- `UserImage` type
- `@/lib/supabase` -- Client-side Supabase for queries and storage
- `@/lib/auth` -- `useAuth()` for current user
- `@/lib/use-selection` -- Multi-select state management for batch operations
- `@/components/ImageGrid` -- Grid/list layout for images
- `@/components/Thumbnail` -- Composable thumbnail component
- `@/components/SelectionDrawer` -- Floating drawer for batch action buttons
- `@/components/ui/alert-dialog` -- Confirmation dialogs for destructive actions

## Quirks / Notes

- Uses Supabase Realtime (`postgres_changes` UPDATE + DELETE events) to live-update the trash list
- Queries filter by `deleted_at IS NOT NULL` and `hidden = false` and `source IN ('upload', 'ai_generated')`
- **Linked image protection**: prevents deletion of images referenced by active (non-deleted, non-hidden) images via `generation_metadata` or placed on canvas (`on_canvas = true`)
- Permanent delete cascades: if deleting a variation whose hidden root image has no remaining living variations, the root is also cleaned up
- All mutations use optimistic updates with rollback on error
- Image URLs are public R2 URLs via `createImageStorage()` (no signing/expiry)
- Batch operations: select multiple images via `useSelection` hook for bulk restore/delete
