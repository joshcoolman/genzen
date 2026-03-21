# Dev Workspace

Sandbox hub for testing shared components and hosting experimental feature pages.

## Key Files

- `index.ts` -- exports `DevWorkspacePage`
- `components/DevWorkspacePage.tsx` -- component testing sandbox (ModelSelector, ImageSourceButtons, AspectRatioSelect)

## Route

- `src/routes/dashboard/dev-workspace.tsx` -- layout with sidebar collapse/restore on enter/exit
- `src/routes/dashboard/dev-workspace.index.tsx` -- base page (DevWorkspacePage component tests)

## Sub-Routes (experimental features)

All nested under `/dashboard/dev-workspace/`:

- `dev-workspace.brainstorm.tsx` -- ai-images brainstorm panel
- `dev-workspace.characters.tsx` -- character generation wizard
- `dev-workspace.combine.tsx` -- multi-image combine
- `dev-workspace.models.tsx` -- FAL model catalog
- `dev-workspace.model-selector.tsx` -- model selector testing
- `dev-workspace.outpaint.tsx` -- image outpainting
- `dev-workspace.prompt-studio.tsx` -- multi-LLM prompt comparison
- `dev-workspace.shots.tsx` -- shot variation pipeline
- `dev-workspace.storyboard.tsx` -- storyboard pipeline
- `dev-workspace.style-trainer.tsx` -- style collection management

## Quirks / Notes

- Layout collapses the dashboard sidebar on entry and restores it on exit
- The base page is a component composability test, not a user-facing feature
- Most features under dev-workspace have their own feature module in `src/features/`
