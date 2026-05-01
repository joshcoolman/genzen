# MCP

Genzen's Model Context Protocol server. Lets external Claude clients (Claude Code/Desktop, Cursor) call into a user's Genzen account via personal API keys.

## Transport

- `server/api/mcp.post.ts` -- Nitro h3 route at `POST /api/mcp`. Reads `Authorization: Bearer gz_live_*`, calls `verifyApiKey`, builds a per-request `McpServer` with the userId baked in, and dispatches via `WebStandardStreamableHTTPServerTransport` in stateless / JSON response mode (no SSE, no session).
- 401 returned as a JSON-RPC error envelope with `WWW-Authenticate: Bearer realm="genzen"` so MCP clients surface the failure cleanly.

## Server factory

- `server/server.ts` -- `createMcpServer(userId)` returns an `McpServer` with all tools registered. New instance per request; cheap because tools are pure registration.

## Tools

Read-only inspection:

- `server/tools/list-image-models.ts` -- catalog from `ALL_IMAGE_MODELS`
- `server/tools/list-edit-models.ts` -- catalog from `EDIT_MODELS` (with `maxRefImages`)
- `server/tools/get-credit-balance.ts` -- balance + dollar value via `getCreditRepository().getBalance(userId)`
- `server/tools/list-recent-generations.ts` -- recent `user_images` rows, optional `kind` filter, R2 public URLs

Generation (Phase 4):

- `server/tools/upload-image.ts` -- decode base64 (≤10MB), call `uploadImageInternal`, insert `user_images` row, return `{ imageId, url }`. No credit cost.
- `server/tools/generate-image.ts` -- call `generateImageInternal` with `{ userId, sourceClient: 'mcp' }`, poll until completion, return `{ imageId, url, model, creditsCharged, creditsRemaining, dollarsCharged, providerCostCents }`. Costs 1 credit. `sourceImageId` resolves to an R2 public URL via DB lookup filtered by user_id.
- `server/tools/edit-image.ts` -- same shape via `editImageInternal`. Validates `referenceImageIds.length <= EDIT_MODELS[modelId].maxRefImages` before submitting.

Generation tools call the `*Internal` server functions directly (not the TanStack `createServerFn` wrappers) to avoid RPC stub corruption of the response shape.

Polling:

- `server/wait-for-generation.ts` -- `waitForGeneration(userId, recordId)` polls every 1.5s up to 90s. Calls `pollFalRecord` first to update the DB row from FAL, then reads `user_images`. On `completed` returns `{ id, storage_path, generation_metadata, title }`, on `failed` throws with FAL error, on timeout throws with recordId for a "check /dashboard/activity" hint.
- `server/poll-fal-record.ts` -- `pollFalRecord(recordId)` queries the `user_images` row for its FAL `request_id`, checks FAL queue status, and processes completed results via `processImageResult`/`processVideoResult`. Returns true if row status was updated, false if still pending.

All tool handlers must close over `userId` from the route. They use the service-role admin client (`getSupabaseAdmin()` directly or via the credit repository) and **must filter `.eq('user_id', userId)`** on every read -- the service-role client bypasses RLS so the explicit filter is the only protection.

Generations submitted via MCP get `generation_metadata.source_client = 'mcp'` so the activity log can mark "via MCP". Plumbed through an optional `sourceClient` field on `generateImage` / `editImage` server fns.

## Install UX

Surfaced in the API keys settings page (`src/features/api-keys/components/`):

- **Reveal dialog** (`CreateApiKeyDialog.tsx`) shows the raw `gz_live_*` key AND a one-line `claude mcp add` command with the key already embedded. Both displayed only at creation time -- they're the same secret with the same one-time visibility. User clicks Copy on the install command, pastes in any project's terminal, registers Genzen as an MCP scoped to that directory.
- **Keys list** (`ApiKeysSection.tsx`) shows a template version of the same command with `<YOUR_GENZEN_KEY>` as a placeholder. For users who saved a key elsewhere (password manager, etc.) and want to install in a new project without remembering the route shape.

Both snippets source the URL from `window.location.origin`, so dev/prod auto-correct without an env var.

Claude Code persists the registered server (and the bearer token) in `~/.claude.json` under the directory where `claude mcp add` was run -- `--scope local` is the default. Token sits in plaintext on disk; no OS keychain integration in Claude Code yet.

`claude mcp list` shows it after; `claude mcp remove genzen` removes it.
