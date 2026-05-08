# Continue: Cost Tracking Layer — Issue #80

## What was being worked on

Issue #80: real-dollar cost tracking for all FAL AI generations. Everything is now committed and pushed on `main`. The cost layer is live and verified working via the Activity page ($1.60 provider cost observed after a multi-model run).

## What shipped (committed: 3ba3d63)

**New files:**

- `supabase/migrations/20260506000000_fal_price_cache.sql` — `fal_price_cache(endpoint_id PK, unit_price, unit, currency, fetched_at)`. Migration applied to DB.
- `src/lib/server/fal-pricing.server.ts` — `getFalModelPrice(endpointId)` with 24h cache. `warmFalPriceCache()` exists but isn't hooked in.
- `src/lib/server/compute-cost.server.ts` — `computeFalCostCents(endpointId, params)` handles `images`/`units`, `megapixels`/`processed megapixels`, `seconds`.

**Wired into generation paths:**

- `generate-image-internal.server.ts` — calls `computeFalCostCents` before insert, stores as `estimated_cost_cents` in `generation_metadata`
- `generate-video.server.ts` — same for FLF and multishot branches
- `fal-completion.server.ts` — `processImageResult`/`processVideoResult` use `falCostCents ?? estimatedCostCents` as `provider_cost_cents`

**Provider toggle removed:**

- Removed FAL/Google provider toggle UI from `GeneratorPanel.tsx`
- Removed `providerOverride` state from `use-ai-images-page.ts`, `use-generator.ts`, and `ai-images.tsx` route
- Each model now uses its native provider automatically (no override)

## Key decisions

- FAL pricing API: `GET https://api.fal.ai/v1/models/pricing?endpoint_id=<id>` returns `{prices:[{unit_price, unit, currency}]}`. Confirmed working.
- Pricing units: `megapixels` (FLUX), `processed megapixels` (FLUX-2-Pro), `images` (Seedream, Nano Banana), `seconds` (video — Kling $0.14/sec), `units` (GPT Image $1 flat).
- Cost in `generation_metadata` JSONB as `estimated_cost_cents` — no new column on `user_images`.
- `computeFalCostCents` wrapped in `.catch(() => null)` everywhere — never blocks generation.
- Google Imagen models return `null` cost gracefully — deferred.

## Confirmed working

Activity page shows correct costs: Seedream v4 $0.030, Seedream v4.5 $0.040, FLUX.2 Pro $0.060, Nano Banana 2 $0.080, FLUX Dev $0.050, FLUX Kontext Pro $0.040, GPT Image 2 $1.00. All match FAL published rates.

## Outstanding work

1. **Regenerate Supabase types** — `fal_price_cache` table exists in DB but isn't in generated types yet. `fal-pricing.server.ts` uses `supabase as any` cast. Run `supabase gen types typescript --project-id <id> > src/types/supabase.ts`, then remove the cast.
2. **`warmFalPriceCache()`** exists but isn't called — optional: hook into a server startup route.
3. **Not wired**: `edit-image-internal.server.ts`, `submit-variations.server.ts`, `retry-generation.server.ts` — variation/retry paths. Low priority.
4. **Close #80** after types are regenerated.

## Next issues (Gate 2 critical path)

`#147 ToS + Privacy Policy` and `#26 Stripe` run in parallel. #26 needs cost data to set margin/pricing — that's now available.

## Git state

Branch: `main`. All changes committed (3ba3d63) and pushed. Build passes clean. No uncommitted work.

---

# Continue: Activity Panel + Image Card UX Improvements

## What shipped this session (uncommitted)

### Image card improvements

- `src/components/Thumbnail.tsx` — added `failedLabel` prop (model name shown in failed thumbnail center, parallel to `pendingLabel`)
- `src/features/ai-images/components/PendingImageCard.tsx` — body now matches completed card layout (model name as title, prompt as description); removed date footer and `createdAt` prop
- `src/features/ai-images/components/FailedImageCard.tsx` — shows model name in thumbnail + body title; clicking the thumbnail opens a Dialog with full raw error + copy button
- `src/features/ai-images/components/ImageGallery.tsx` — removed unused `createdAt` prop from `PendingImageCard`

### Server fixes

- `src/lib/server/fal-completion.server.ts` — `title: getModelName(model)` (was raw model ID like `fal-ai/gpt-image-2`)
- `src/lib/server/media.server.ts` — Google failure path now writes `generation_error` column (was only writing to nested `generation_metadata.error`), fixing "Unknown error" display for Google failures

### Model routing

- `src/lib/server/google-imagen.server.ts` — `GEMINI_MODEL_MAP` maps `fal-ai/nano-banana-2` to `gemini-2.5-flash-image` (direct to Google, ~50% cheaper than FAL). Attempted `gemini-3.1-flash-image-preview` but it's not enabled in project `gen-lang-client-0015600225` — revert back when enabled via Vertex AI Model Garden.

## Next: Activity Panel Provider + Error UX

### Goal

1. Show **provider** (FAL AI / Google Vertex AI / OpenAI) in the activity detail panel and list rows
2. Make the **error section** copyable with a `CopyButton` + render in monospace `pre` block

### Provider derivation logic

```typescript
function deriveProvider(meta) {
  if (meta.provider === 'google') return 'Google Vertex AI'
  if (meta.provider === 'openai') return 'OpenAI'
  if (meta.fal_model_id || meta.model?.startsWith('fal-ai/')) return 'FAL AI'
  return null
}
```

`generation_metadata.provider` is set to `'google'` by `media.server.ts` for Google generations. FAL generations don't set it but are identifiable via `fal_model_id` or `fal-ai/` prefix.

### Files to change

1. `src/features/activity/types.ts` — add `provider: string | null` to `ActivityEntry` + `ActivityEntryDetail`; add `provider?` + `fal_model_id?` to `ActivityGenerationMetadata`
2. `src/features/activity/server/list-activity.server.ts` — derive + pass provider
3. `src/features/activity/server/get-activity-entry.server.ts` — derive + pass provider
4. `src/features/activity/components/ActivityDetailPanel.tsx` — add Provider `DetailRow`, wrap error in `pre` with `CopyButton`
5. `src/features/activity/components/ActivityRow.tsx` — optional provider badge in list

### Key file locations

- Detail panel: `src/features/activity/components/ActivityDetailPanel.tsx` (418 lines) — `CopyButton` already exists in file, `Section`/`DetailRow` components already there
- Types: `src/features/activity/types.ts` (77 lines)
- `ActivityEntry` → `ActivityEntryDetail` extends it; both need `provider`
