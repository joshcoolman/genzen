## Stack

TanStack Start (React 19 + Vite + Nitro SSR), Supabase, FAL AI (image gen), Tailwind v4, shadcn/ui

## Directory Structure

```
src/
  routes/          # TanStack file-based routing (dashboard/, docs/, login)
  features/        # Domain modules (each has its own CLAUDE.md)
  components/      # Shared components + ui/ (shadcn)
  lib/
    server/        # Server-only code (.server.ts files)
    supabase.ts    # Supabase client
    auth.ts        # Auth helpers
    types/         # Shared types
    animations/    # Animation utilities
supabase/
  migrations/      # Postgres migrations
  functions/       # Edge functions
  seed.sql
```

## Pre-Commit Workflow

Before staging and committing, always run `pnpm check` (prettier + eslint fix). Fix any errors before proceeding. Sequence: `pnpm check` -> `pnpm build` -> stage -> commit -> push.

## Feature Modules (src/features/)

Each feature has its own `CLAUDE.md` -- reference it before working on a feature.

| Feature           | What it does                                                           | CLAUDE.md                              |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| **ai-images**     | Multi-model image generation, edit, variation, reparenting via FAL AI  | `src/features/ai-images/CLAUDE.md`     |
| **ai-video**      | Workspace-based video generation using first-frame/last-frame workflow | `src/features/ai-video/CLAUDE.md`      |
| **user-images**   | Image upload, storage, gallery management with Supabase                | `src/features/user-images/CLAUDE.md`   |
| **canvas**        | Infinite pan-zoom spatial moodboard with grouping and AI generation    | `src/features/canvas/CLAUDE.md`        |
| **scenes**        | 3x3 grid for camera-angle variations via Claude vision prompts         | `src/features/scenes/CLAUDE.md`        |
| **multi-model**   | 3x3 grid comparing 9 AI models on a single prompt                      | `src/features/multi-model/CLAUDE.md`   |
| **multi-shot**    | Multi-shot video generation (Kling V3 Pro) with elements and shots     | `src/features/multi-shot/CLAUDE.md`    |
| **outpaint**      | Extend images to new aspect ratios with offset positioning             | `src/features/outpaint/CLAUDE.md`      |
| **credits**       | Credit balance system for metering AI usage                            | `src/features/credits/CLAUDE.md`       |
| **ad**            | Embedded AI chat sidebar (Assistant Director) with vision              | `src/features/ad/CLAUDE.md`            |
| **notes**         | Save/load AD chat conversations as markdown snapshots                  | `src/features/notes/CLAUDE.md`         |
| **prompt-studio** | Run prompts against multiple LLMs in parallel                          | `src/features/prompt-studio/CLAUDE.md` |
| **prompts**       | Personal prompt library bottom sheet with seeded defaults              | `src/features/prompts/CLAUDE.md`       |
| **models**        | Browsable FAL AI model catalog with search and filtering               | `src/features/models/CLAUDE.md`        |
| **trash**         | Soft-delete recovery with linked image protection                      | `src/features/trash/CLAUDE.md`         |
| **docs**          | Documentation presentation components                                  | `src/features/docs/CLAUDE.md`          |
| **spotlight**     | Cmd+K navigation dialog                                                | `src/features/spotlight/CLAUDE.md`     |
| **status-bar**    | Bottom-right floating bar with hints and scene progress                | `src/features/status-bar/CLAUDE.md`    |
| **dev-workspace** | Sandbox hub for experimental feature pages                             | `src/features/dev-workspace/CLAUDE.md` |

## Key Conventions

- Path aliases: `@/components`, `@/lib`, `@/features` (via tsconfig paths)
- Server code uses `.server.ts` suffix and lives in `src/lib/server/`
- Route tree is auto-generated (`routeTree.gen.ts`) -- do not edit manually
- FAL generation completion: on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase migrations in `supabase/migrations/` with timestamp prefix
- UI components via shadcn CLI: `npx shadcn@latest add <component>`
- Tailwind v4 -- uses CSS-based config in `src/styles.css`, no tailwind.config file
