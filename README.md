# GenZen

A unified workspace for working with AI image models. Fan prompts across providers and compare side-by-side, run non-destructive edit / variation / outpaint / scene-composition flows that track parent→child genealogy, iterate in a prompt studio, and ask an in-app AI assistant about your library. Includes an MCP server so Claude Code can drive a user's account from outside the UI.

## Status — yet another abandoned SaaS, fully working, have at it

I built this solo and took it all the way to a production-grade, fully working app: auth, credits, Stripe billing, multi-provider AI image generation, an in-app assistant, an MCP server. Then I decided not to ship it as a public SaaS. The signup / billing / "app for the world" direction stopped being what I wanted to build — I just wanted the tool for myself.

So rather than let the engineering sit in a private repo forever, I'm opening it up. Everything described below works. Treat it as:

- a serious reference for a **TanStack Start + Supabase + multi-provider AI image** app, or
- a base to **fork and make your own**.

**Not maintained.** No support, no roadmap, no warranty — MIT licensed, do what you like with it. A leaner single-user successor (no signup, no billing, just the tool) is in the works; link to follow.

## Highlights

- **Multi-model image gen** — submit one prompt to multiple providers in parallel and compare results.
- **Edit / variation / outpaint / scenes** — non-destructive workflows; every generation records its parent so you can branch and back-track.
- **AD assistant** — in-app chat sidebar with vision, tool calling, and per-feature personas (each feature registers its own context).
- **Prompt Studio + History** — author and test prompts; history keeps every generation including failures, with cost and timing.
- **Credits & Activity log** — every generation is metered; the activity log surfaces a chronological per-generation cost/time view.
- **MCP for Claude Code** — list models, check credits, list recent generations, upload, generate, and edit from a Claude Code session against your own account.

Full feature catalog (each module with its own `CLAUDE.md`): see the table in [`CLAUDE.md`](./CLAUDE.md).

## Stack

| Layer        | Tech                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| App          | TanStack Start (React 19 + Vite + Nitro SSR)                            |
| UI           | Tailwind v4 (CSS config in `src/styles.css`) + shadcn/ui                |
| Data / auth  | Supabase (Postgres + RLS)                                               |
| Storage      | Cloudflare R2 (persistent public URLs)                                  |
| AI providers | FAL (image), Anthropic, Google Gemini / Imagen, OpenAI, OpenRouter, xAI |
| Hosting      | Vercel (auto-deploy from `main`)                                        |

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

You need Docker, pnpm, and **one real API key: `FAL_KEY`**. No cloud account is
required anywhere — Postgres, auth and storage all run as local containers.

```bash
pnpm install
pnpm local:up                  # asks for your FAL key, sets up everything else
pnpm dev                       # http://localhost:3000
```

That is the whole setup. There is no env file to copy or edit: `local:up` starts
MinIO (S3-compatible storage) from `docker-compose.yml` and the Supabase CLI
stack, writes `.env.local` for you, applies migrations and the seed on a fresh
database, and prompts for the FAL key. Re-run it any time; it is idempotent, it
keeps your key, and it will not reset a database you have been working in (use
`pnpm local:up --reset` for that).

| Thing           | Where                                               |
| --------------- | --------------------------------------------------- |
| App             | http://localhost:3000                               |
| Sign in as      | `testuser@gmail.com` / `supa!1QAwsEDrf`             |
| MinIO console   | http://localhost:9011 (`genzenlocal`/`genzenlocal`) |
| Supabase Studio | http://localhost:54323                              |

FAL is not mocked — generation calls fal.ai for real and costs real money. The
app boots and everything else works without a key.

Ports: MinIO is on 9010/9011 rather than its default 9000/9001, so this stack
can run alongside `~/repos/bootsy`.

## Scripts

| Command                             | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `pnpm local:up`                     | Start the local stack, write `.env.local`   |
| `pnpm local:down`                   | Stop it (data kept)                         |
| `pnpm local:reset`                  | Stop it and delete the volumes              |
| `pnpm dev`                          | Vite dev server on :3000                    |
| `pnpm build`                        | Production build                            |
| `pnpm test`                         | Vitest                                      |
| `pnpm check`                        | Prettier + ESLint --fix (run before commit) |
| `npx shadcn@latest add <component>` | Add a shadcn component                      |

## Env

**Locally there is nothing to configure.** `pnpm local:up` writes `.env.local`
itself and prompts you for the one value that is actually yours, the FAL key.
There is no local env template to copy or fill in.

`.env.example` is the reference for **deploying** genzen, split into Required
(Supabase, FAL, an S3 bucket) and Optional (other model providers, Stripe,
webhooks, the `/docs` password).

One note if you deploy: the `R2_*` names are historical. The storage layer is
plain S3 and points wherever `R2_ENDPOINT` says — MinIO locally, any provider
in production. Leave `R2_ENDPOINT` unset and set `R2_ACCOUNT_ID` to derive
Cloudflare R2's endpoint.

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
