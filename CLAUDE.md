## Stack

TanStack Start (React 19 + Vite + Nitro SSR), Supabase, FAL AI (image gen), Tailwind v4, shadcn/ui

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

## Feature Modules (src/features/)

Each feature has its own `CLAUDE.md` be sure to reference, create and or update when working on features.

## Key Conventions

- Path aliases: `@/components`, `@/lib`, `@/features` (via tsconfig paths)
- Server code uses `.server.ts` suffix and lives in `src/lib/server/`
- Route tree is auto-generated (`routeTree.gen.ts`) -- do not edit manually
- FAL generation completion: on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase migrations in `supabase/migrations/` with timestamp prefix
- UI components via shadcn CLI: `npx shadcn@latest add <component>`
- Tailwind v4 -- uses CSS-based config in `src/styles.css`, no tailwind.config file
