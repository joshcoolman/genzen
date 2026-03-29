## Overview

Recover or permanently delete soft-deleted images. Protects linked images (referenced by active images or placed on canvas) from accidental permanent deletion. Supports batch operations and ZIP archive download.

## How It Works

1. Queries `user_images` where `deleted_at IS NOT NULL`
2. Linked image detection: checks if image is referenced by active images via `generation_metadata` or `on_canvas = true`
3. Linked images shown with badge, protected from permanent deletion
4. Permanent delete cascades: if deleting a variation whose hidden root has no remaining variations, root is cleaned up too
5. All mutations use optimistic updates with rollback on error
6. Supabase Realtime (UPDATE + DELETE events) for live updates

## Usage

- Navigate to Trash from sidebar
- Restore or permanently delete individual or batch-selected images
- Download all trashed images as ZIP before emptying

## Key Files

- `src/features/trash/hooks/useTrash.ts` -- Core hook: fetch trashed images, linked image detection, restore/delete/batch/empty
- `src/features/trash/components/TrashDisplay.tsx` -- Full-page UI: image list, single/batch restore/delete, linked badges, empty-trash
- `src/features/trash/components/TrashDownloadButton.tsx` -- ZIP download dialog (JSZip + file-saver, concurrency=4)

## Dependencies

- Supabase -- queries, storage, realtime
- JSZip + file-saver -- ZIP download
- `@/lib/use-selection` -- multi-select for batch operations
- `@/components/ImageGrid`, `@/components/Thumbnail` -- shared display components

## Route

`/dashboard/trash`
