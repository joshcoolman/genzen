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
- **FAL AI** (`FAL_KEY`) — image generation via `@fal-ai/client`.
- **Stripe** (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) — credit pack payments via Stripe Checkout (hosted). Webhook at `server/api/stripe-webhook.post.ts`. Idempotency via `credit_transactions.stripe_event_id`.
- **Supabase** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`) — auth, Postgres, RLS. Anon key client-side, service role server-side only.
- **Cloudflare R2** (`R2_*`, `VITE_R2_PUBLIC_URL`) — image/asset storage. Public URLs are persistent (no expiry).
- **Docs password** (`DOCS_PASSWORD`) — gate for the internal `/docs` route.

## Features

| Feature     | Description                                                    | CLAUDE.md                            |
| ----------- | -------------------------------------------------------------- | ------------------------------------ |
| activity    | Chronological cost/time log of every generation (inc failures) | `src/features/activity/CLAUDE.md`    |
| ad          | AI chat assistant sidebar with vision + tool calling           | `src/features/ad/CLAUDE.md`          |
| ai-images   | Multi-model image generation, edit, variation workflows        | `src/features/ai-images/CLAUDE.md`   |
| api-keys    | Personal API key management for MCP access                     | `src/features/api-keys/CLAUDE.md`    |
| canvas      | Image canvas editor                                            | `src/features/canvas/CLAUDE.md`      |
| credits     | Credit checking, deduction, and UI                             | `src/features/credits/CLAUDE.md`     |
| docs        | Internal docs route (password-gated)                           | `src/features/docs/CLAUDE.md`        |
| mcp         | MCP server for external Claude clients via API keys            | `src/features/mcp/CLAUDE.md`         |
| spotlight   | Spotlight search / command palette                             | `src/features/spotlight/CLAUDE.md`   |
| status-bar  | Bottom status bar with AD (chat) toggle                        | `src/features/status-bar/CLAUDE.md`  |
| trash       | Soft-deleted item recovery                                     | `src/features/trash/CLAUDE.md`       |
| user-images | User image uploads, library, and asset management              | `src/features/user-images/CLAUDE.md` |

## Handoffs

When using the `/handoff` skill, save the document to `./continue.md` in the project root.

## Gotchas

- `routeTree.gen.ts` is auto-generated -- never edit manually
- Tailwind v4 config is CSS-based in `src/styles.css` -- there is no `tailwind.config` file
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase edge functions don't work for us -- use Nitro h3 routes in `server/api/` instead
