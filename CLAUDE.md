## Session Memory

At the start of every session, read `memory/progress.md` for architecture reference, key decisions, and how features work.
Only update `memory/progress.md` when architecture changes (new features, key files, or decisions) — not for routine commits.
Backlog and task tracking live in GitHub Issues + Project board (`gh issue list`, `gh project`).

---

## Stack

TanStack Start (React 19 + Vite + Nitro SSR), Supabase (auth/postgres/realtime), FAL AI (image gen), Tailwind v4, shadcn/ui (new-york style), Fly.io deploy

## Commands

- `pnpm dev` -- dev server on port 3000
- `pnpm build` -- production build
- `pnpm test` -- vitest run
- `pnpm check` -- prettier + eslint fix

## Directory Structure

```
src/
  routes/          # TanStack file-based routing (dashboard/, docs/, login)
  features/        # Domain modules (ai-images, user-images, docs)
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

## Commit Messages

Format: `area: subject line` (under 70 chars)

Area prefixes (match feature dirs): `ai-images`, `assets`, `video`, `storyboard`, `nav`, `auth`, `docs`, `notes`, `shared` (cross-cutting components/lib), `infra` (build/deploy/migrations), `dx` (dev workspace/tooling). Use `fix(area):` for bug fixes.

Body (for non-trivial changes):

- Line 1: WHY -- the motivation or problem (not derivable from the diff)
- Then: key files added/removed, behavioral changes, or migration notes
- End with `Closes #XX` if resolving a GitHub issue

Keep it to 1 logical change per commit. If bullet list covers 3+ unrelated things, split into separate commits.

Examples:

- `ai-images(edit): add optimistic pending cards for variations`
- `shared: extract CopyButton and ExpandableText from feature modules`
- `fix(nav): sidebar not restoring width after dev workspace exit`
- `infra: add gemini3Flash to ai.server.ts model registry`

## Feature Modules

Each feature has its own `CLAUDE.md` with architecture details. Read the relevant one before working on a feature.

| Feature           | Path                          | Summary                                                                                     |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| **ai-images**     | `src/features/ai-images/`     | Multi-model image generation, brainstorm, edit, variation, reparenting workflows via FAL AI |
| **ai-video**      | `src/features/ai-video/`      | Workspace-based video generation using first-frame/last-frame (FLF) workflow                |
| **ad**            | `src/features/ad/`            | Embedded AI chat assistant (right sidebar) with route-aware context                         |
| **characters**    | `src/features/characters/`    | Character generation wizard (mock/UI-only)                                                  |
| **combine**       | `src/features/combine/`       | Combine multiple images into one via FAL edit models                                        |
| **credits**       | `src/features/credits/`       | Credit balance system for metering AI generation usage                                      |
| **dev-workspace** | `src/features/dev-workspace/` | Sandbox hub hosting experimental feature pages                                              |
| **docs**          | `src/features/docs/`          | Documentation viewer with sidebar nav and ToC                                               |
| **models**        | `src/features/models/`        | Browsable FAL AI model catalog with search and filtering                                    |
| **multi-shot**    | `src/features/multi-shot/`    | Multi-shot video generation (elements + shots + duration budget)                            |
| **notes**         | `src/features/notes/`         | AD conversation snapshots -- save, review, reload into context                              |
| **outpaint**      | `src/features/outpaint/`      | Extend images to new aspect ratios via FAL edit models                                      |
| **prompt-studio** | `src/features/prompt-studio/` | Run prompts against multiple LLMs and compare side-by-side                                  |
| **shots**         | `src/features/shots/`         | Linear pipeline: source image -> describe -> prompts -> generate variations                 |
| **spotlight**     | `src/features/spotlight/`     | Cmd+K navigation dialog                                                                     |
| **status-bar**    | `src/features/status-bar/`    | Fixed bottom-right floating bar with contextual hints                                       |
| **storyboard**    | `src/features/storyboard/`    | Story prompt -> scene breakdown -> frame generation -> video clips                          |
| **style-trainer** | `src/features/style-trainer/` | Curated image collections used as style references during generation                        |
| **trash**         | `src/features/trash/`         | Soft-delete recovery for user images                                                        |
| **user-images**   | `src/features/user-images/`   | Asset library: upload, manage, download user + AI-generated images                          |

## Shared Terms

See `shared-terms.md` for domain vocabulary (focused edit view, variations, brainstorm, etc.)

## Key Conventions

- Path aliases: `@/components`, `@/lib`, `@/features` (via tsconfig paths)
- Server code uses `.server.ts` suffix and lives in `src/lib/server/`
- Route tree is auto-generated (`routeTree.gen.ts`) -- do not edit manually
- FAL generation completion: on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase migrations in `supabase/migrations/` with timestamp prefix
- UI components via shadcn CLI: `npx shadcn@latest add <component>`
- Tailwind v4 -- uses CSS-based config in `src/styles.css`, no tailwind.config file
