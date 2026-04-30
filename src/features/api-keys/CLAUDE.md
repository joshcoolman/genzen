# API Keys

Personal access tokens (`gz_live_*`) for the Genzen MCP server. Stored sha256-hashed; the raw key is shown once at creation.

## Key Files

- `types.ts` -- `ApiKey` shape returned to the client (no hash, no raw key)
- `server/list-api-keys.server.ts` -- list current user's keys (active + revoked)
- `server/create-api-key.server.ts` -- create a key, returns `{ rawKey, key }` (raw shown once)
- `server/revoke-api-key.server.ts` -- mark a key revoked (timestamps `revoked_at`)
- `hooks/use-api-keys.ts` -- list/create/revoke with optimistic updates
- `components/ApiKeysSection.tsx` -- list UI mounted on `/dashboard/settings`
- `components/CreateApiKeyDialog.tsx` -- create flow with one-time reveal + copy

## Core lib

The DB-touching primitives live in `src/lib/server/api-keys.server.ts`:
`createApiKey`, `verifyApiKey`, `revokeApiKey`, `listApiKeys`, plus pure helpers
`hashApiKey` and `generateRawApiKey`. `verifyApiKey` defaults to the service-role
client because the MCP path has no user session yet.

## DB Table

`api_keys` (`id`, `user_id`, `name`, `key_hash`, `key_prefix`, `created_at`,
`last_used_at`, `revoked_at`). RLS: user owns rows.
