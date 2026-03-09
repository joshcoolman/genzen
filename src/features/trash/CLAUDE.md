# Trash

Soft-delete recovery for user images. Supports restore, permanent delete, and empty-all.

## Key Files

- `index.ts` -- Re-exports `TrashDisplay` and `useTrash`
- `hooks/useTrash.ts` -- Core hook: fetches trashed images, signs storage URLs, handles restore/delete/empty
- `components/TrashDisplay.tsx` -- Full-page UI with image list, restore/delete buttons, empty-trash confirmation

## Route

`src/routes/dashboard/trash.tsx`

## Shared Dependencies

- `@/features/user-images/types` -- `UserImage` type
- `@/lib/supabase` -- Client-side Supabase for queries and storage
- `@/lib/auth` -- `useAuth()` for current user
- `@/components/ImageGrid` -- Grid/list layout for images
- `@/components/ImageCard` -- Individual image card rendering
- `@/components/ui/alert-dialog` -- Confirmation dialogs for destructive actions

## Quirks / Notes

- Uses Supabase Realtime (`postgres_changes`) to live-update the trash list when items are trashed/restored elsewhere
- Queries filter by `deleted_at IS NOT NULL` and `hidden = false` and `source IN ('upload', 'ai_generated')`
- Permanent delete cascades: if deleting a variation whose hidden root image has no remaining living variations, the root is also cleaned up (both DB row and storage file)
- All mutations use optimistic updates with rollback on error
- Storage URLs are signed with 1-hour expiry
