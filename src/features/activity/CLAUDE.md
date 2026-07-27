Chronological record of every AI generation (image, success + failure, including soft-deleted). With credits gone this is the only spend guard, so its cost figures have to be honest about where they came from.

## Key Files

- `types.ts` -- `ActivityEntry`, `ActivityEntryDetail`, `ActivityReferenceImage`, `ActivityGenerationMetadata`, `ActivityFilters`, `ActivityTotals`, `ListActivityResult`, `GenerationStatus`, `TOTALS_ROW_CAP` (5000)
- `server/list-activity.server.ts` -- paginated query over `user_images` for `source='ai_generated'`. NO status filter, NO `deleted_at` filter. Optional filter params (models, statuses, dateFrom, dateTo). Runs page + totals queries in parallel. Cost comes from `generation_metadata.provider_cost_cents` — what FAL charged. There is no second, user-facing currency.
- `server/get-activity-entry.server.ts` -- fetches a single `user_images` row by ID. Returns `ActivityEntryDetail` with full file metadata, reference images (resolved from `generation_metadata.reference_image_ids`), and raw JSON-stringified metadata.
- `hooks/use-activity-page.ts` -- page state: filters, pagination, totals, `getThumbUrl`. Resets page on filter change. No database access and no realtime: it calls `list-activity.server.ts`, and polls `checkPendingGenerations` every 5s while pending rows exist, refetching when a poll settles a row.
- `components/ActivityPage.tsx` -- full page: header + totals + filters + list + pagination + detail panel. Arrow keys (left/right) cycle selected entry while detail panel is open.
- `components/ActivityRow.tsx` -- single row rendered as a `<button>`: thumbnail · model · prompt · status · duration · cost · time. Calls `onSelect` to open detail panel. Soft-deleted rows get reduced opacity + "deleted" badge.
- `components/ActivityDetailPanel.tsx` -- slide-over Sheet showing full detail for a single generation: prompt (with copy), error message, costs, duration, file metadata (size/dimensions/MIME), reference image thumbnails, and syntax-highlighted raw metadata JSON.
- `components/ActivityFilters.tsx` -- model multi-select popover, status pills, date preset pills (All / Today / 7d / 30d)
- `components/ActivityTotals.tsx` -- summary strip: runs · total time · cost
- `components/ActivityPreview.tsx` -- compact 5-row widget embedded in `/dashboard/account`, links to full page

## Route

`app/dashboard/activity/page.tsx`

## Data Source

Reads from `user_images` table with `source = 'ai_generated'`. No status/deleted_at filters. Timestamps for duration come from `generation_metadata.submitted_at` + `completed_at` | `failed_at` (all ISO strings, in JSONB). Cost stashed at FAL completion in `generation_metadata.provider_cost_cents` (see `src/lib/server/fal-completion.server.ts` → `extractFalCostCents()`).

## Totals query

Uses a slim `select('status, generation_metadata').limit(5000)` alongside the paginated page query. `exceedsCap: true` surfaces a caveat when there are 5k+ matching rows — user should narrow with filters. In-memory aggregation avoids JSONB ops in Postgres.

## Shared Dependencies

- `#/lib/auth` -- useAuth for access token
- `#/lib/time-format` -- `formatRelativeOrDate`, `formatAbsolute`, `formatDurationMs`
- `#/lib/utils` -- `cn` (classname merge)
- `#/features/ai-images/models` -- `getModelName`, `ALL_IMAGE_MODELS` (filter options)
- `#/lib/server/auth.server` -- requireAuth
- `#/lib/server/check-pending-generations.server` -- FAL polling for pending rows
- `#/components/ui/sheet` -- Sheet/SheetContent for detail panel

## Quirks / Notes

- Cost is `provider_cost_cents`, written once at completion by `processImageResult` as `extractFalCostCents(result) ?? estimated_cost_cents`. FAL's image queue results carry no cost field in practice, so it is nearly always the estimate — `provider_cost_is_estimate` records which, and the UI prefixes estimates with `~`. Every one of the five generate paths writes `estimated_cost_cents` via `computeFalCostCents` at submit; a row shows `—` only when the pricing lookup itself failed.
- FAL cost extraction is defensive: probes `cost_cents`, `price_cents`, `cost`, `price`, and nested `metering` / `fal_billing` paths. None has ever been observed in a live image-queue response — expand if one appears.
- Model filter IDs use JSONB key `generation_metadata->>model`. Older rows that lack `model` in metadata are filtered out when any model is selected — by design.
- Page size is 50 rows. Totals are computed across all matching rows (capped at 5000), not just the visible page.
- Detail panel fetches reference images from `generation_metadata.reference_image_ids` array; missing refs show "missing" placeholder. Refs preserve metadata order.
- No realtime: the channel went with #173/#174. FAL polling (5s interval) runs only while pending rows exist on the current page, and a settled row triggers a silent refetch.
- Arrow keys (left/right) cycle through entries when detail panel is open; skips when focus is in an input/textarea.
