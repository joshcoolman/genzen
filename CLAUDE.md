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

## Services

All keys present in `.env.local` — assume server-side access unless a feature explicitly says otherwise. Don't propose new auth/env plumbing for these.

- **Anthropic** (`ANTHROPIC_API_KEY`) — Claude. Server-side AND browser-stored BYOK for the AD panel (`useAnthropicKey`); either path is available.
- **Google Gemini / Imagen** (`GOOGLE_AI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`) — image gen + vision.
- **OpenAI** (`OPENAI_API_KEY`), **OpenRouter** (`OPENROUTER_API_KEY`), **xAI** (`XAI_API_KEY`) — available via `src/lib/text-models.ts` model registry / `@ai-sdk/*` providers.
- **FAL AI** (`FAL_KEY`) — image and video generation via `@fal-ai/client`.
- **Supabase** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`) — auth, Postgres, RLS. Anon key client-side, service role server-side only.
- **Cloudflare R2** (`R2_*`, `VITE_R2_PUBLIC_URL`) — image/asset storage. Public URLs are persistent (no expiry).
- **Trigger.dev** (`TRIGGER_SECRET_KEY`) — background jobs.
- **Docs password** (`DOCS_PASSWORD`) — gate for the internal `/docs` route.

## Features

| Feature       | Description                                                    | CLAUDE.md                              |
| ------------- | -------------------------------------------------------------- | -------------------------------------- |
| activity      | Chronological cost/time log of every generation (inc failures) | `src/features/activity/CLAUDE.md`      |
| ad            | AI chat assistant sidebar with vision + tool calling           | `src/features/ad/CLAUDE.md`            |
| ai-images     | Multi-model image generation, edit, variation workflows        | `src/features/ai-images/CLAUDE.md`     |
| ai-video      | Video generation (FLF + multishot) with parent/child grouping  | `src/features/ai-video/CLAUDE.md`      |
| canvas        | Image canvas editor                                            | `src/features/canvas/CLAUDE.md`        |
| credits       | Credit checking, deduction, and UI                             | `src/features/credits/CLAUDE.md`       |
| dev-workspace | Developer workspace utilities                                  | `src/features/dev-workspace/CLAUDE.md` |
| docs          | Internal docs route (password-gated)                           | `src/features/docs/CLAUDE.md`          |
| history       | Generation history browsing                                    | `src/features/history/CLAUDE.md`       |
| models        | Model registry and selection                                   | `src/features/models/CLAUDE.md`        |
| multi-model   | Multi-model parallel image generation                          | `src/features/multi-model/CLAUDE.md`   |
| multi-shot    | Residual multishot types + ShotCard for ai-video reuse         | `src/features/multi-shot/CLAUDE.md`    |
| notes         | Markdown notes with AD integration                             | `src/features/notes/CLAUDE.md`         |
| outpaint      | Image outpainting / expansion                                  | `src/features/outpaint/CLAUDE.md`      |
| prompt-studio | Prompt authoring and testing                                   | `src/features/prompt-studio/CLAUDE.md` |
| prompts       | Prompt library and management                                  | `src/features/prompts/CLAUDE.md`       |
| scenes        | Scene composition from multiple images                         | `src/features/scenes/CLAUDE.md`        |
| spotlight     | Spotlight search / command palette                             | `src/features/spotlight/CLAUDE.md`     |
| status-bar    | Bottom status bar with AD toggle                               | `src/features/status-bar/CLAUDE.md`    |
| trash         | Soft-deleted item recovery                                     | `src/features/trash/CLAUDE.md`         |
| user-images   | User image uploads, library, and asset management              | `src/features/user-images/CLAUDE.md`   |

## Gotchas

- `routeTree.gen.ts` is auto-generated -- never edit manually
- Tailwind v4 config is CSS-based in `src/styles.css` -- there is no `tailwind.config` file
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase edge functions don't work for us -- use Nitro h3 routes in `server/api/` instead
