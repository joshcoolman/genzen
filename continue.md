# Continue: Genzen MCP Server v1 — Phase 1 (API key system)

## Where we are

- **Branch:** `main` (working tree clean apart from this file). **Per PR-workflow memory: do NOT execute on main — cut `feat/mcp-api-keys` first** and open a PR when done.
- **Plan file:** `/Users/joshcoolman/.claude/plans/so-higgsfield-has-an-partitioned-mountain.md`
- **Epic on GH:** [#135 Epic: Genzen MCP Server v1](https://github.com/joshcoolman-smc/genzen/issues/135) — labeled `epic`, on GenZen Roadmap project board
- **Phases on GH (all on the board):** #131 (this phase), #132, #133, #134

## What this is

Building an MCP server that lets external Claude clients (Claude Code / Desktop / Cursor in any other repo) generate images via a user's Genzen account. v1 exposes 7 tools: `list_image_models`, `list_edit_models`, `upload_image`, `generate_image`, `edit_image`, `get_credit_balance`, `list_recent_generations`.

**Locked-in design decisions (don't relitigate):**

- Transport: remote HTTP MCP at `https://genzen.app/mcp` (Streamable HTTP)
- Auth: personal API keys `gz_live_<random>`, sha256-hashed at rest, shown once
- Async: `generate_image` blocks until FAL completes (≤90s timeout)
- Image return: R2 public URL in tool response

## This phase: API key foundation (#131)

Pure foundation. No MCP code yet. Independently shippable.

### Files to create

- `supabase/migrations/<timestamp>_api_keys.sql`
  - Table `api_keys`: `id, user_id, name, key_hash (sha256), key_prefix (first 12 chars for display), created_at, last_used_at, revoked_at`
  - RLS: user can CRUD only their own rows; service role bypasses
- `src/lib/server/api-keys.server.ts`
  - `createApiKey(userId, name)` → returns one-time-visible `gz_live_*` raw key + db row
  - `verifyApiKey(rawKey)` → `{ userId }` or throws (sha256 lookup, updates `last_used_at`, rejects revoked)
  - `revokeApiKey(userId, id)`
  - `listApiKeys(userId)` (no hashes / no raw values)
- `src/features/api-keys/` — components + hook for the Settings UI section
  - List rows: name, prefix (e.g. `gz_live_abcd…`), created, last used
  - "Create key" dialog: name input → reveals key once with copy button
  - Revoke action with confirm
- Vitest covering: create→verify round-trip, hash mismatch rejection, revoked-key rejection

### Files to edit

- `src/lib/server/auth.server.ts` — add `requireAuthFromApiKey(rawKey)` returning the same `{ id, email? }` shape as the existing `requireAuth(accessToken)`. Don't touch `requireAuth` itself.
- `src/routes/dashboard/settings.tsx` — mount the new `<ApiKeysSection />`

### Files NOT to touch this phase

- Any `generate-image.server.ts` / `edit-image.server.ts` / `upload-image.server.ts` / `check-credits.server.ts` — that's Phase 2 (`{ userId }` channel refactor)
- `server/api/mcp.ts` — Phase 3 doesn't exist yet
- Any tool handler in `src/features/mcp/` — Phase 3+

## Conventions to follow

- Reuse shared components per memory `feedback_use_shared_components.md` (dialog, button — check `src/components/`)
- Use `ActionButton` for primary CTAs (loading + icon props, no `asChild`)
- Server-only files use `.server.ts` suffix (already implied by filenames above)
- Migration filename: timestamp-prefixed, follow existing `supabase/migrations/` pattern (most recent is `20260406100000_prompt_studio_sets.sql` — pick a timestamp after that)

## Verification before completing this phase

1. `pnpm check` (prettier + eslint)
2. `pnpm build` (must succeed)
3. `pnpm test` for the new vitest file
4. Manual: dev server → `/dashboard/settings` → API Keys section → create a key → it appears in list with the correct prefix → revoke removes it
5. Open PR against `main`, link to #131, do not self-merge until reviewed
6. After merge: run `/continue-prompt` again, then start Phase 2 (#132)

## Git state

- On `main`, only `continue.md` modified
- Cut `feat/mcp-api-keys` before any code changes
- 5 issues open on the board: #131 (this), #132, #133, #134, #135 (epic)
