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

## Idea capture & execution

Exploratory sessions capture ideas before any build. The user pokes around the app and says "capture this"; at the end (often a later session) says "let's execute".

- One file per feature under `ideas/` (e.g. `ideas/canvas.md`), named by the sidebar label the user uses.
- On "capture this": append an entry to the relevant `ideas/<feature>.md` with the recommendation/decision inline and a status -- `open` (undecided) / `decided` (agreed, not built) / `done` (shipped).
- On "let's execute": read that feature's file, promote `decided` items into a concrete on-spec plan, confirm scope, build, then flip items to `done`. No scope drift beyond what's captured.

## Git workflow

This is a solo project. **Commit directly to main by default.** Feature branches are only justified for genuinely risky or experimental work where an escape hatch is needed.

If a branch is used, merge it and delete it before the session's final commit — never leave branches open at end of session. The goal is that main always reflects the current working state of the app, so switching computers means pulling main and continuing seamlessly.

At the end of any session, main should be:

- Up to date with all completed work
- Pushed to remote
- Free of stale local branches

## Handoffs

When using the `/handoff` skill, save the document to `continue/<github-login>.md`
(resolve via `gh api user --jq .login`). These are identity-keyed, live resume
pointers — one per developer, read at session start by the hook in
`.claude/settings.json`. See `continue/README.md` for the convention.

**Before every commit:** update and stage `continue/<login>.md`. This is enforced
by `.githooks/pre-commit` (blocks with a message if not staged) and a `PreToolUse`
hook in `.claude/settings.json` (blocks Claude-driven commits). The `prepare` npm
script (`pnpm install`) configures the git hooks path automatically.

## Gotchas

- `routeTree.gen.ts` is auto-generated -- never edit manually
- Tailwind v4 config is CSS-based in `src/styles.css` -- there is no `tailwind.config` file
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase edge functions don't work for us -- use Nitro h3 routes in `server/api/` instead
