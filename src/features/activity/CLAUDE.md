Chronological record of every AI generation (image, success + failure, including soft-deleted). With credits gone this is the only spend guard, so its cost figures have to be honest about where they came from.

## Key Files

- `types.ts` -- `ActivityEntry`, `ActivityEntryDetail`, `ActivityReferenceImage` (an alias of ai-images' `GenerationInputImage`, not its own shape), `ActivityGenerationMetadata`, `ActivityFilters`, `ListActivityResult`, `GenerationStatus`
- `server/list-activity.action.ts` -- paginated query over `user_images` for `source='ai_generated'`. NO status filter, NO `deleted_at` filter. Optional filter params (models, statuses). Windowed to the last `ACTIVE_DAYS` (3) days that **produced runs** — idle days do not count, so a week away does not empty the page. The window is computed over the filtered set, so narrowing to a model last used months ago still shows that model's last three working days. Cost comes from `generation_metadata.provider_cost_cents` — what FAL charged. There is no second, user-facing currency.

Two files left here when the Activity route was restructured, because each had a
single consumer and this folder is earned by two or more:

- `get-activity-entry` -> `app/(authenticated)/activity/_actions/get-entry.ts`
- `use-activity-page` -> `app/(authenticated)/activity/use-view.ts`

What remains is what Activity and Account's Recent-activity preview both use.

## Route and UI

`app/(authenticated)/activity/` -- `page.tsx` renders `view.tsx`, which composes
components and carries no styles of its own; `use-view.ts` holds the state.
Parts live in `_components/` (`run-table`, `run-row`, `filters`,
`detail-panel`). `activity-preview/` (the compact 5-row widget) lives with the
one route that renders it, `app/(authenticated)/account/`.

**Activity does not total anything.** A `totals` component, `ActivityTotals` and
a `TOTALS_ROW_CAP` were documented here long after they had been deleted. The
aggregate view is the account overview instead (`src/lib/server/account-stats.server.ts`,
#406), which is the right home for it: it counts video as well, and Activity
still cannot see video at all (#398).

## Data Source

Reads from `user_images` table with `source = 'ai_generated'`. No status/deleted_at filters. Timestamps for duration come from `generation_metadata.submitted_at` + `completed_at` | `failed_at` (all ISO strings, in JSONB). Cost stashed at FAL completion in `generation_metadata.provider_cost_cents` (see `src/lib/server/fal-completion.server.ts`), and it may be a **fraction of a cent** since #400 -- do not assume an integer.

## Shared Dependencies

- `#/lib/auth` -- useAuth for the current user (id and email; there is no token)
- `#/lib/time-format` -- `formatRelativeOrDate`, `formatAbsolute`, `formatDurationMs`
- `#/features/ai-images/models` -- `getModelName`, `IMAGE_MODELS` (filter options)
- `#/lib/server/auth.server` -- requireAuth
- `#/lib/server/check-pending-generations.action` -- FAL polling for pending rows
- `#/components` -- `Sheet`/`SheetContent` for the detail panel

## Quirks / Notes

- Cost is `provider_cost_cents`, written once at completion by `processImageResult` as `extractFalCostCents(result) ?? computeFalCostFromTimings(...) ?? estimated_cost_cents`. FAL's image queue results carry no cost field in practice, so **every figure here is genzen's own arithmetic** and `provider_cost_is_estimate` is true on essentially every row — the UI prefixes those with `~`. The middle term is the `compute seconds` models (#400): nothing at submit knows how long the GPU will run, so they wrote no cost at all until the completion started pricing the result's own `timings.inference`. It is **not rounded to a whole cent** — a FLUX.2 Flash run is ~$0.0004, and rounding it stores 0. A row shows `—` when the pricing lookup failed, or when a compute-seconds model returned no timings at all, which Grok does.
- FAL cost extraction is defensive: probes `cost_cents`, `price_cents`, `cost`, `price`, and nested `metering` / `fal_billing` paths. None has ever been observed in a live image-queue response — expand if one appears.
- Model filter IDs use JSONB key `generation_metadata->>model`. Older rows that lack `model` in metadata are filtered out when any model is selected — by design.
- Page size is 50 rows, inside the three-active-day window. `created_at::date` buckets in UTC, so a run late at night local time lands on the next day's bucket — not worth a timezone round trip at this granularity.
- The detail panel's References block shows **every image the generation was given**, resolved by `ai-images/server/generation-inputs.server.ts` (#380) -- not one metadata field. The same fact is written as `reference_image_ids` or `source_image_id` depending on the submit path, and reading only the first meant an edit through a model's image endpoint showed no references at all. `parent_id` (filing) and `root_image_id` (ancestry) are deliberately excluded. Metadata order is preserved; a missing ref shows a "missing" placeholder and a trashed one is marked rather than dropped.
- No realtime: the channel went with #173/#174. FAL polling (5s interval) runs only while pending rows exist on the current page, and a settled row triggers a silent refetch.
- Arrow keys (left/right) cycle through entries when detail panel is open; skips when focus is in an input/textarea.
