# Continue: Image Grouping & Genealogy Separation

## What was worked on

Major refactor of the ai-images feature to fully separate **grouping** (mutable, user-driven organization via `parent_id`) from **genealogy** (immutable generation lineage via `source_image_id`, `root_image_id`, `generation_type`). This was a multi-session effort spanning ~10 commits over the past week.

## Architecture established

Two systems that never intersect in code:

- **Grouping**: `parent_id` in `generation_metadata`. Managed by `group-images.server.ts` (batch set) and `ungroup-images.server.ts` (batch remove). `reparent-image.server.ts` is a thin single-image wrapper. These functions only touch `parent_id` — zero genealogy awareness.
- **Genealogy**: `source_image_id`, `root_image_id`, `generation_type`. Set once at generation time by generation endpoints. Never modified by grouping operations.

## Key changes this week (chronological)

- **414f8c2**: Initial separation — added `parent_id` field, updated generation endpoints to set both `parent_id` and `source_image_id`, changed group discovery to use `parent_id`
- **bb26f87**: Fixed unlink/ungroup destroying `generation_type` (immutable)
- **3bd3d26**: Fixed "Original" thumbnail showing for edits (was only variations)
- **2723517**: Mobile UI improvements — `useIsMobile` hook, `MobileDialogHeader`, `CircularIconButton`, full-screen dialogs replacing drawers
- **84209c7**: The big refactor — new `group-images.server.ts` and `ungroup-images.server.ts`, gutted `reparent-image.server.ts` (187 → 72 lines), replaced all client-side Supabase grouping mutations with server function calls, added `parent_id` to `SavedAiImage` TypeScript type, fixed `deleteImageWithDescendants` to walk `parent_id` instead of `source_image_id`
- **f65b312 → fad82cd**: "Original" thumbnail display rules — children hidden from gallery grid don't need suppression, group parents legitimately show their Original
- **b489f68**: Fixed edit view not showing "Original" — `use-edit-page.ts` was discarding `generation_metadata` when constructing `parentAsSaved`, and passing empty `rootImageMeta={}`. Now carries full metadata and fetches source image URLs

## Key files modified

| File | What changed |
|------|-------------|
| `src/features/ai-images/types.ts` | Added `parent_id?: string` to `generation_metadata` |
| `src/features/ai-images/server/group-images.server.ts` | **NEW** — batch set `parent_id` |
| `src/features/ai-images/server/ungroup-images.server.ts` | **NEW** — batch remove `parent_id` (by IDs or parentId) |
| `src/features/ai-images/server/reparent-image.server.ts` | Gutted — only sets/removes `parent_id`, no tree walking |
| `src/features/ai-images/hooks/use-images.ts` | `ungroupChildren`, `deleteAndDetachChildren`, `deleteImageWithDescendants` use server functions |
| `src/features/ai-images/hooks/use-edit-page.ts` | Carries full `generation_metadata` through, fetches source URLs, exposes `rootImageMeta` |
| `src/features/ai-images/hooks/use-ai-images-page.ts` | Removed `generation_type !== 'edit'` filter from `parentIds` |
| `src/features/ai-images/components/ImageGallery.tsx` | "Original" display logic — shows for edits and variations |
| `src/features/ai-images/components/ImageCard.tsx` | "Unlink" menu only shows when image has `parent_id` |
| `src/features/ai-images/components/GroupPickerDialog.tsx` | `pointer-events-none` on circle indicator for full-area click |
| `src/routes/dashboard/ai-images.tsx` | All handlers use batch `groupImages`/`ungroupImages` calls, `onUnlink` wired up |
| `src/routes/dashboard/edit.$imageId.tsx` | Passes `page.rootImageMeta` instead of `{}` |

## Key decisions

- Grouping is flat: one level only (primary + children). No nested groups, no cycle detection needed.
- `generation_type`, `source_image_id`, `root_image_id` are **never** modified after initial generation
- Client-side Supabase mutations for grouping replaced with auth-checked server functions
- "Original" thumbnail shows on ungrouped images and group parents (children are filtered from gallery grid by `childIds`)
- `deleteImageWithDescendants` BFS walks `parent_id` (group children), not `source_image_id` (genealogy descendants)

## Outstanding / next steps

- **Genealogy visualization**: The `source_image_id` chain enables family tree / branching history views. No UI for this yet — deferred until grouping is fully settled.
- **Data cleanup**: Old `reparent-image.server.ts` previously set `generation_type: 'variation'` on adopted images. Existing data may have corrupted `generation_type` on user uploads. A migration to clean this up was discussed but not implemented.
- **Revenue gate**: All feature/R&D work is parked until Gate 2 (payments: FAL pricing, Stripe, ToS) is done. See memory `project_critical_path.md`.

## Git state

- Branch: `main`
- Working tree: clean
- Latest commit: `b489f68` — all changes committed and pushed
- Remote: up to date with `origin/main`
