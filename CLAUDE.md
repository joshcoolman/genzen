TanStack Start (React 19 + Vite + Nitro SSR), Supabase, FAL AI (image gen), Tailwind v4, shadcn/ui

## Commands

- `pnpm check` -- prettier + eslint fix (run before commit)
- `pnpm build` -- production build (run after check, before commit)
- `pnpm test` -- vitest
- `npx shadcn@latest add <component>` -- add UI components

## Structure

- `src/features/` -- domain modules, **each has its own CLAUDE.md -- read it before working on a feature**
- `src/lib/server/` -- server-only code uses `.server.ts` suffix
- `src/components/` -- shared components + `ui/` (shadcn)
- `supabase/migrations/` -- Postgres migrations (timestamp-prefixed)

## Gotchas

- `routeTree.gen.ts` is auto-generated -- never edit manually
- Tailwind v4 config is CSS-based in `src/styles.css` -- there is no `tailwind.config` file
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase edge functions don't work for us -- use Nitro h3 routes in `server/api/` instead
