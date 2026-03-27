# Dev Workspace

Sandbox hub for testing shared components and hosting experimental feature pages.

## Key Files

- `index.ts` -- exports `DevWorkspacePage`
- `components/DevWorkspacePage.tsx` -- component testing sandbox (ModelSelector, ImageSourceButtons, AspectRatioSelect)

## Route

- `src/routes/dashboard/dev-workspace.tsx` -- layout with secondary left navigation and sidebar collapse/restore on enter/exit
- `src/routes/dashboard/dev-workspace.index.tsx` -- redirects to `/dashboard/dev-workspace/outpaint`

## Sub-Routes

All nested under `/dashboard/dev-workspace/`:

- `dev-workspace.outpaint.tsx` -- image outpainting (from `@/features/outpaint`)
- `dev-workspace.prompt-studio.tsx` -- multi-LLM prompt comparison (from `@/features/prompt-studio`)
- `dev-workspace.models.tsx` -- FAL model catalog (from `@/features/models`)
- `dev-workspace.model-selector.tsx` -- model selector component testing (uses DevWorkspacePage)
- `dev-workspace.multi-model.tsx` -- multi-model comparison grid (from `@/features/multi-model`)

## Navigation

Secondary left navigation sidebar with links to: Outpaint, Prompt Studio, Models, Model Selector, Multi-Model

## Quirks / Notes

- Layout collapses the dashboard sidebar on entry and restores it on exit
- Base route redirects to outpaint (not a standalone page)
- The model-selector route uses DevWorkspacePage from this feature for component testing
- Most sub-routes delegate to their own feature module in `src/features/`
