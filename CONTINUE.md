# Continue: Infrastructure Scaling (Tier 2 — COMPLETE)

## What was done this session

### #104 — Local JWT Verification (closed)

- Installed `jose`
- `src/lib/server/auth.server.ts` verifies tokens locally via JWKS, cached per-process, with remote fallback

### #105 — Idempotent Credit Deductions (closed)

- Migration `20260326000003_idempotency_key.sql`
- `generate-image.server.ts` + `edit-image.server.ts`: idempotencyKey check + credit refund on FAL error
- `generate-variation.server.ts`: refunds remaining credits if FAL fails mid-loop
- `refundCredits()` helper in `check-credits.server.ts`

### #102 — Signed URL Caching (closed)

- `src/lib/storage-url-cache.ts`: process-lifetime `Map` cache, `getCachedSignedUrl()` + `invalidateCachedUrl()`
- All 5 hooks (`use-images`, `useGenerationResults`, `use-edit-children`, `useUserImages`, `useExistingImages`) now use the cache
- First gallery load calls `createSignedUrl`; subsequent loads hit the in-memory cache
- Cache entry invalidated on image delete in `use-images.ts`

### #101 — FAL Webhooks (closed)

- `server/api/fal-webhook.post.ts`: Nitro POST handler at `/api/fal-webhook`
  - HMAC-SHA256 signature verification (`x-fal-signature` header, `FAL_KEY` as secret)
  - Looks up `user_images` by `request_id`, calls `processImageResult` / `processVideoResult` / `markGenerationFailed`
- All `fal.queue.submit` calls pass `webhookUrl` when `ENABLE_FAL_WEBHOOKS=true`
- Polling `setInterval` in `use-images.ts` and `useGenerationResults.ts` guarded by `VITE_ENABLE_FAL_WEBHOOKS !== 'true'`
- Supabase Realtime handles UPDATE events → webhooks + Realtime = no polling needed in prod

---

## New env vars

```
ENABLE_FAL_WEBHOOKS=false        # true in prod; false keeps polling for local dev
VITE_APP_URL=https://yourapp.com # Used to construct webhook callback URL
VITE_ENABLE_FAL_WEBHOOKS=false   # Client-side flag to skip polling
```

## Deployment notes

To enable webhooks in production:

1. Set `ENABLE_FAL_WEBHOOKS=true` and `VITE_APP_URL=https://yourapp.com` in env
2. Set `VITE_ENABLE_FAL_WEBHOOKS=true` in client env
3. FAL will POST to `https://yourapp.com/api/fal-webhook` on completion
4. Local dev: leave all three as `false` — polling continues to work

---

## Git state

- Branch: `main`
- All work committed: JWT caching, idempotent credits, URL caching, FAL webhooks
