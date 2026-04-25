Chronological record of every AI generation (image + video, success + failure, including soft-deleted). Cost/time tracking view for pro teams.

## Key Files

- `types.ts` -- `ActivityEntry`, `ActivityFilters`, `ActivityTotals`, `GenerationStatus`, `GenerationKind`, `TOTALS_ROW_CAP` (5000)
- `server/list-activity.server.ts` -- paginated query over `user_images` for both `source='ai_generated'` and `source='ai_video'`. NO status filter, NO `deleted_at` filter. Optional filter params (models, statuses, dateFrom, dateTo). Runs page + totals queries in parallel. Derives user cost from `generation_metadata.generation_type` × `CREDIT_COSTS` × `DOLLARS_PER_CREDIT`. Provider cost from `generation_metadata.provider_cost_cents`.
- `hooks/use-activity-page.ts` -- page state: filters, pagination, totals. Resets page on filter change.
- `components/ActivityPage.tsx` -- full page: header + totals + filters + list + pagination
- `components/ActivityRow.tsx` -- single row: thumbnail · model · prompt · status · duration · user$ · provider$ · time. Soft-deleted rows get reduced opacity + "deleted" badge.
- `components/ActivityFilters.tsx` -- model multi-select popover, status pills, date preset pills (All / Today / 7d / 30d)
- `components/ActivityTotals.tsx` -- summary strip: runs · total time · you paid · provider cost
- `components/ActivityPreview.tsx` -- compact 5-row widget embedded in `/dashboard/account`, links to full page

## Route

`src/routes/dashboard/activity.tsx`

## Data Source

Reads from `user_images` table with `source IN ('ai_generated', 'ai_video')`. No status/deleted_at filters. Timestamps for duration come from `generation_metadata.submitted_at` + `completed_at` | `failed_at` (all ISO strings, in JSONB). Provider cost stashed at FAL completion in `generation_metadata.provider_cost_cents` (see `src/lib/server/fal-completion.server.ts` → `extractFalCostCents()`).

## Totals query

Uses a slim `select('status, generation_metadata').limit(5000)` alongside the paginated page query. `exceedsCap: true` surfaces a caveat when there are 5k+ matching rows — user should narrow with filters. In-memory aggregation avoids JSONB ops in Postgres.

## Shared Dependencies

- `@/lib/auth` -- useAuth for access token
- `@/lib/time-format` -- `formatRelativeOrDate`, `formatAbsolute`, `formatDurationMs`
- `@/features/credits` -- `CREDIT_COSTS`, `DOLLARS_PER_CREDIT` (user-cost derivation)
- `@/features/ai-images/models` -- `getModelName`, `ALL_IMAGE_MODELS` (filter options)
- `@/features/ai-video/video-models` -- `getVideoModelName`, `ALL_VIDEO_MODELS` (filter options)
- `@/lib/server/auth.server` -- requireAuth

## Quirks / Notes

- Direct Google/OpenAI generations won't have `provider_cost_cents` — row shows `—`. Populate via a per-model pricing table when #80 lands.
- FAL cost extraction is defensive: probes `cost_cents`, `price_cents`, `cost`, `price`, and nested `metering` / `fal_billing` paths. Exact FAL field name may need verification + expansion once seen in a live response.
- Model filter IDs use JSONB key `generation_metadata->>model`. Older rows that lack `model` in metadata are filtered out when any model is selected — by design.
- Page size is 50 rows. Totals are computed across all matching rows (capped at 5000), not just the visible page.
