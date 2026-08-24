Chronological record of every AI generation -- **images and clips**, success and failure, including soft-deleted. With credits gone this is the only spend guard, so its cost figures have to be honest about where they came from.

## Key Files

- `types.ts` -- `ActivityEntry`, `ActivityEntryDetail`, `ActivityReferenceImage` (an alias of ai-images' `GenerationInputImage`, not its own shape), `ActivityGenerationMetadata`, `ActivityFilters`, `ListActivityResult`, `GenerationStatus`
- `server/list-activity.action.ts` -- paginated query over `user_images` for `source in ('ai_generated','ai_video')`. NO status filter, NO `deleted_at` filter. Optional filter params (models, statuses). Windowed to the last `ACTIVE_DAYS` (3) days that **produced runs** — idle days do not count, so a week away does not empty the page. The window is computed over the filtered set, so narrowing to a model last used months ago still shows that model's last three working days. Cost comes from `generation_metadata.provider_cost_cents` — what FAL charged. There is no second, user-facing currency.

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
#406), which is the right home for it. The two agree on what they are counting
since #398; before that the overview counted clips and Activity could not see
them, so the same money had two answers.

## Data Source

Reads from `user_images` with `source in ('ai_generated','ai_video')` -- clips were excluded outright until #398, which made the log blind to most of the spend (a 20s Flux 3 clip is $3.40 against $0.08 for the dearest still). No status/deleted_at filters. Timestamps for duration come from `generation_metadata.submitted_at` + `completed_at` | `failed_at` (all ISO strings, in JSONB). Cost stashed at FAL completion in `generation_metadata.provider_cost_cents` (see `src/lib/server/fal-completion.server.ts`), and it may be a **fraction of a cent** since #400 -- do not assume an integer.

## Shared Dependencies

This folder is two files. What they import, in full:

- `#/lib/server/auth.server` -- `resolveAuth`
- `#/lib/server/db.server` -- `sql`, `first`
- `#/features/ai-images/models` -- `getModelName`
- `#/features/video/models` -- `expandVideoFilterId` (the video half of the filter)
- `#/features/ai-images/generation-inputs` -- the shared input shape

The route at `app/(authenticated)/activity/` is what pulls in `#/lib/auth`,
`#/lib/time-format`, `#/components` and the poll. Those are the route's, not
this feature's -- this file documents both, and the distinction was lost once.

## Quirks / Notes

- Cost is `provider_cost_cents`, written once at completion by `processImageResult` as `extractFalCostCents(result) ?? estimated_cost_cents`. FAL's image queue results carry no cost field in practice, so **every figure here is genzen's own arithmetic** and `provider_cost_is_estimate` is true on essentially every row — the UI prefixes those with `~`. Figures are **not rounded to a whole cent**: a z-image generation is 0.52c and rounding made it 1c, a 2x over-report on the cheapest tier. A row shows `—` when the endpoint had no price at all.
- **How close is it?** Measured against FAL's own invoices over a full day (#400): $6.135 recorded against $6.185 billed, **0.8% low**, and exact on video and Nano Banana — the models that are most of the money. The drift left is structural rather than a bug: a megapixel-billed model varies with output size and the lineup carries one figure per model. Per-generation cost **cannot** come from FAL — its usage API is hourly aggregates per endpoint with no request id — so this will always be arithmetic, and the `~` will always be honest.
- FAL cost extraction is defensive: probes `cost_cents`, `price_cents`, `cost`, `price`, and nested `metering` / `fal_billing` paths. None has ever been observed in a live image-queue response — expand if one appears.
- Model filter IDs use JSONB key `generation_metadata->>model`. Older rows that lack `model` in metadata are filtered out when any model is selected — by design. A **video** option's id is `video:<slug>`, not an endpoint id: one video model is two or three endpoints in the data, and listing them separately would split a model across three unreadable rows. `expandVideoFilterId` does the widening in the query, not the component.
- **A clip is named from `model_label`, never resolved.** `getModelName` reads the image lineup, so a video endpoint would render a raw `lightricks/...` id. The label was pinned by the submit, which also means a model leaving the lineup does not rename the clips it made.
- **A clip's thumbnail is a `<video>`, via `MediaBox`** (`#/components`). There is no poster frame anywhere in the app — no ffmpeg on the server, so `thumbnail_path` is NULL on every clip — and an mp4 in an `<img>` lands on the broken-file fallback. The detail panel's large preview gets `controls`; the two square boxes do not. That component exists because the decision had been made three times (Video's card, Trash's row, then here).
- Page size is 50 rows, inside the three-active-day window. `created_at::date` buckets in UTC, so a run late at night local time lands on the next day's bucket — not worth a timezone round trip at this granularity.
- The detail panel's References block shows **every image the generation was given**, resolved by `ai-images/server/generation-inputs.server.ts` (#380) -- not one metadata field. The same fact is written as `reference_image_ids` or `source_image_id` depending on the submit path, and reading only the first meant an edit through a model's image endpoint showed no references at all. `parent_id` (filing) and `root_image_id` (ancestry) are deliberately excluded. Metadata order is preserved; a missing ref shows a "missing" placeholder and a trashed one is marked rather than dropped.
- No realtime: the channel went with #173/#174. FAL polling runs only while pending rows exist on the current page, and a settled row triggers a silent refetch. The interval is not fixed -- `useGenerationPoll` backs off by the age of the oldest pending work (5s under a minute, 15s under five, 30s after) and stops entirely while the tab is hidden.
- Arrow keys (left/right) cycle through entries when detail panel is open; skips when focus is in an input/textarea.

- **Load generation hands a run to the Images panel** (#458). The detail panel's
  one verb: prompt and reference images into the generator, then `/images`.
  Aspect ratio, generations-per-model and the model selection are all left
  alone -- the selection is the working context you are already in, not part of
  the thing being loaded. Images only; a clip's generation would arrive at the
  wrong kind of model. It goes through `src/lib/panel-handoff.ts`, the same door
  the lab uses (#433), and reuses `loadGeneration` rather than re-deriving the
  payload -- that action moved out of Images' `_actions/` when this became its
  second consumer. **The missing-inputs warning is said here, before
  navigating**: the handoff carries a request and never a result, so a toast on
  the far side would need the door to grow a field nothing else wants.
