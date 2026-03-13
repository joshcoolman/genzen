# Continue: Style Collections Feature

## Branch: `feature/ad-panel`

## What was built (all uncommitted)

### Phase 1: Database + Storage

- `supabase/migrations/20260314000000_style_collections.sql` -- `style_collections` + `style_images` tables with RLS, `styles` storage bucket with user-scoped policies, indexes
- Server CRUD in `src/features/style-trainer/server/`:
  - `create-style.server.ts`, `get-styles.server.ts`, `save-style-image.server.ts`, `delete-style.server.ts`, `remove-style-image.server.ts`
  - Images copied into style-specific storage (not linked to library)
  - Auto-thumbnail on first image, storage cleanup on delete

### Phase 2: UI Rework

- `src/features/style-trainer/hooks/useStyleCollections.ts` -- replaces old 5-step mock wizard with library/create/edit CRUD hook
- `src/features/style-trainer/components/StyleTrainerPageContent.tsx` -- library grid + create form + edit view with image management
- Route + barrel exports updated

### Phase 3: Compositor + Generation Integration

- `src/features/style-trainer/server/compose-style-sheet.server.ts` -- Sharp-based grid compositor, tiles into contact sheets when >14 images
- `src/features/style-trainer/server/resolve-style-refs.server.ts` -- fetches style images, composes sheets, uploads to FAL
- `src/features/ai-images/server/generate-image.server.ts` -- added optional `styleId`, resolves style refs server-side
- `src/features/ai-images/hooks/use-generator.ts` -- added `selectedStyleId` state
- `src/features/ai-images/components/GeneratorPanel.tsx` -- added `StylePicker` (paintbrush icon dropdown)
- `src/routes/dashboard/ai-images.tsx` -- `useStyleOptions` hook fetches styles, passes to GeneratorPanel

### Phase 4: Polish

- Auto-thumbnail, storage cleanup, empty/loading states
- Production build passes clean
- Feature CLAUDE.md updated

## Key decisions

- No ML/training -- styles = curated image collections passed as reference images
- Self-contained storage -- images copied into styles bucket, not linked to library
- Contact sheet compositor: <=14 images pass directly, >14 tile into grids of ~12
- Style picker only shows when styles exist (no empty UI clutter)

## Files modified (existing)

- `src/features/ai-images/server/generate-image.server.ts`
- `src/features/ai-images/hooks/use-generator.ts`
- `src/features/ai-images/components/GeneratorPanel.tsx`
- `src/routes/dashboard/ai-images.tsx`
- `src/routes/dashboard/style-trainer.tsx`
- `src/features/style-trainer/index.ts`
- `src/features/style-trainer/CLAUDE.md`

## Last file edited

`src/features/style-trainer/CLAUDE.md`
