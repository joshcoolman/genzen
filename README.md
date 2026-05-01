# GenZen

A unified workspace for working with AI image and video models. Fan prompts across providers and compare side-by-side, run non-destructive edit / variation / outpaint / scene-composition flows that track parent→child genealogy, generate video (first-last-frame and multishot), iterate in a prompt studio, and ask an in-app AI assistant about your library. Includes an MCP server so Claude Code can drive a user's account from outside the UI.

## Highlights

- **Multi-model image gen** — submit one prompt to multiple providers in parallel and compare results.
- **Edit / variation / outpaint / scenes** — non-destructive workflows; every generation records its parent so you can branch and back-track.
- **Video** — first-last-frame and multishot pipelines via FAL, with parent-child grouping for sequences.
- **AD assistant** — in-app chat sidebar with vision, tool calling, and per-feature personas (each feature registers its own context).
- **Prompt Studio + History** — author and test prompts; history keeps every generation including failures, with cost and timing.
- **Credits & Activity log** — every generation is metered; the activity log surfaces a chronological per-generation cost/time view.
- **MCP for Claude Code** — list models, check credits, list recent generations, upload, generate, and edit from a Claude Code session against your own account.

Full feature catalog (22 modules, each with its own `CLAUDE.md`): see the table in [`CLAUDE.md`](./CLAUDE.md).

## Stack

| Layer        | Tech                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| App          | TanStack Start (React 19 + Vite + Nitro SSR)                                    |
| UI           | Tailwind v4 (CSS config in `src/styles.css`) + shadcn/ui                        |
| Data / auth  | Supabase (Postgres + RLS)                                                       |
| Storage      | Cloudflare R2 (persistent public URLs)                                          |
| AI providers | FAL (image + video), Anthropic, Google Gemini / Imagen, OpenAI, OpenRouter, xAI |
| Hosting      | Vercel (auto-deploy from `main`)                                                |

## Repo Map

| Path                   | What's there                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `src/features/<name>/` | Domain modules. **Each has its own `CLAUDE.md` — read it before editing the feature.** |
| `src/lib/server/`      | Server-only helpers (files use `.server.ts` suffix).                                   |
| `src/components/`      | Shared components, plus `ui/` for shadcn primitives.                                   |
| `server/api/`          | Nitro h3 routes (e.g. `server/api/mcp.post.ts`).                                       |
| `src/features/mcp/`    | MCP server factory and tools — see [MCP](#mcp-agent-facing-api).                       |
| `supabase/migrations/` | Timestamp-prefixed Postgres migrations.                                                |
| `CLAUDE.md`            | Authoritative feature catalog + service / convention notes.                            |

## Local Dev

```bash
pnpm install
supabase start                 # Docker required; prints local Supabase keys
cp .env.example .env.local     # then fill in keys (see Env)
pnpm dev                       # http://localhost:3000
```

## Scripts

| Command                             | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `pnpm dev`                          | Vite dev server on :3000                    |
| `pnpm build`                        | Production build                            |
| `pnpm test`                         | Vitest                                      |
| `pnpm check`                        | Prettier + ESLint --fix (run before commit) |
| `npx shadcn@latest add <component>` | Add a shadcn component                      |

## Env

Full list in `.env.example`. Minimum to boot the app:

- Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- FAL: `FAL_KEY`
- Anthropic (used by the AD assistant): `ANTHROPIC_API_KEY`

Optional / feature-gated: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY`, `GOOGLE_AI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `GOOGLE_APPLICATION_CREDENTIALS`, `R2_*` + `VITE_R2_PUBLIC_URL`, `ENABLE_FAL_WEBHOOKS` + `VITE_APP_URL` + `VITE_ENABLE_FAL_WEBHOOKS`, `DOCS_PASSWORD`.

Service-role and provider keys are server-only. Anything prefixed `VITE_` ships to the browser.

## MCP (agent-facing API)

GenZen exposes an MCP server at `POST /api/mcp` (Nitro h3, stateless JSON-RPC). It's designed for Claude Code: the install UX in the in-app API Keys settings page generates a `gz_live_*` personal key plus a paste-ready `claude mcp add` command. Other MCP clients aren't part of the supported flow today.

- Route: `server/api/mcp.post.ts`
- Server factory + tool registry: `src/features/mcp/server/server.ts` (`createMcpServer(userId)`)
- Per-feature notes: `src/features/mcp/CLAUDE.md`

Currently registered tools: `list-image-models`, `list-edit-models`, `get-credit-balance`, `list-recent-generations`, `upload-image`, `generate-image`, `edit-image`. Every tool closes over the authenticated `userId` and filters by it explicitly (the service-role client bypasses RLS).

## Conventions / Gotchas

- `src/routeTree.gen.ts` is autogenerated by TanStack Router — never edit by hand.
- Tailwind v4 has no `tailwind.config.*`; theme lives in `src/styles.css`.
- Server-only code uses the `.server.ts` suffix; do not import these from client code.
- Supabase Edge Functions are not used here — write Nitro h3 routes in `server/api/` instead.
- FAL generation status is reconciled via on-demand polling in `src/lib/server/check-pending-generations.server.ts`. Webhooks are optional and gated by env.
- R2 public URLs do not expire — safe to persist in DB rows.

## Deploy

Pushes to `main` deploy automatically via Vercel. There is no manual deploy command.
