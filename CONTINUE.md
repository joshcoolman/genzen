# Continue: Dev Workspace cleanup -- delete stale features

## Branch: `feat/role-based-model-abstraction` (uncommitted changes)

## What was being worked on

Cleaning up dev-workspace by removing stale/unused feature modules. Started when user noticed `BrainstormPanel` was confusingly placed inside `src/features/ai-images/` but only used by dev-workspace.

## Changes made so far (uncommitted)

- Removed `BrainstormPanel`, `use-brainstorm`, `use-brainstorm-settings`, `brainstorm-images.server` from `src/features/ai-images/`
- Removed brainstorm constants from `src/features/ai-images/constants.ts`
- Removed `BrainstormPanel` barrel export from `src/features/ai-images/index.ts`
- Updated `src/features/ai-images/CLAUDE.md` to remove all brainstorm references
- Removed `resolveStyleRefs` import and entire style ref code path from `src/features/ai-images/server/generate-image.server.ts` (removed `styleId` from interface, metadata, and `styleRefUrls` from `allImageUrls`)
- Updated `src/routes/dashboard/dev-workspace.brainstorm.tsx` import to `@/features/brainstorm` (this file is about to be deleted)

## Outstanding work -- THE MAIN TASK

Delete 6 feature directories and 6 route files, then update the dev-workspace nav:

### Delete these directories (rm -rf):

- `src/features/brainstorm/` (was created during this session then marked for deletion)
- `src/features/characters/`
- `src/features/combine/`
- `src/features/shots/`
- `src/features/storyboard/`
- `src/features/style-trainer/`

### Delete these route files:

- `src/routes/dashboard/dev-workspace.brainstorm.tsx`
- `src/routes/dashboard/dev-workspace.characters.tsx`
- `src/routes/dashboard/dev-workspace.combine.tsx`
- `src/routes/dashboard/dev-workspace.shots.tsx`
- `src/routes/dashboard/dev-workspace.storyboard.tsx`
- `src/routes/dashboard/dev-workspace.style-trainer.tsx`

### Update `src/routes/dashboard/dev-workspace.tsx`:

- Remove nav items for: brainstorm, shots, characters, storyboard, style-trainer, combine
- Keep nav items for: outpaint, prompt-studio, models, model-selector
- Remove unused lucide icon imports (Lightbulb, Grid3X3, Users, SquarePlay, Palette, Layers)

### Update `src/routes/dashboard/dev-workspace.index.tsx`:

- Change redirect from `/dashboard/dev-workspace/brainstorm` to `/dashboard/dev-workspace/outpaint` (or prompt-studio)

### After deletions:

- Run `pnpm check && pnpm build` to verify
- Commit and push

## Key decisions

- Features ONLY used by dev-workspace routes that are being kept: outpaint, prompt-studio, models -- these stay as separate feature modules (they have their own `src/features/` dirs, which is fine)
- Style trainer's `resolveStyleRefs` was the only cross-dep -- already removed from generate-image.server.ts
- No other cross-feature dependencies exist for the deleted features (verified via grep)

## Git state

Branch `feat/role-based-model-abstraction`, changes are NOT committed. The `research/` directory deletions are also in the diff (unrelated, 6 research markdown files).
