Searchable history of completed AI image generations with list and grid views.

## Key Files

- `types.ts` -- HistoryEntry, GenerationMetadata, ViewMode types
- `server/list-history.server.ts` -- Paginated query of user_images with prompt search (ILIKE on generation_metadata->>'prompt')
- `hooks/use-history-page.ts` -- Page state: search (debounced), pagination, view mode, copy/use-again actions
- `components/HistoryPage.tsx` -- Layout: search bar, view toggle, grid/list content, pagination
- `components/HistoryCard.tsx` -- HistoryCardGrid + HistoryCardList card variants
- `components/HistoryGridView.tsx` -- Responsive grid of HistoryCardGrid
- `components/HistoryListView.tsx` -- Vertical feed of HistoryCardList

## Route

`src/routes/dashboard/history.tsx`

## Data Source

Reads from `user_images` table: `source='ai_generated'`, `status='completed'`, `deleted_at IS NULL`. Prompt text from `generation_metadata->>'prompt'` JSONB. GIN trigram index supports search.

## Actions

- Copy prompt: clipboard copy
- Use again: sets `genzen:prompts` localStorage, navigates to AI Images

## Shared Dependencies

- `@/lib/auth` -- useAuth for access token
- `@/lib/image-storage` -- R2 public URL resolution (VITE_R2_PUBLIC_URL)
- `@/lib/server/auth.server` -- requireAuth
