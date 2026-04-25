# Continue: Activity page — chronological cost & time log

## Where we are

- **Branch:** `feat/activity-log-130` (local only, not yet pushed)
- **Tracking issue:** #130 "feat: Activity page — chronological cost & time log for all generations"
- **Full plan:** `~/.claude/plans/and-we-should-probably-zippy-wave.md`
- **Phase 1 done** (uncommitted): route + nav + time-format util + empty page stub

## What this feature is

A new top-level route `/dashboard/activity` — chronological record of every generation run (image + video, success + failure, including soft-deleted rows). Framed as a cost/time tracking tool for pro teams whose accountants need to see where the spend went.

**Columns:** thumbnail · model · prompt (truncated) · status · duration · **user cost** (credits × $) · **provider cost** (FAL/OpenAI raw $) · time

**Filters:** model multi-select, status pills, date range (today / 7d / 30d / custom)
**Totals at top:** count · total duration · total user $ · total provider $

Existing `/dashboard/history` is a visual thumbnail grid that filters out failures and soft-deleted rows — by design. This new page is the "log everything" counterpart.

## Phase 1 changes (uncommitted, on branch)

- `src/lib/nav-items.ts` — added `activity` entry with `Logs` icon (lucide), `activeOnly: true`, inserted between `history` and `trash`
- `src/lib/time-format.ts` — NEW: `formatRelativeOrDate` (today → `3h ago`, else → `Monday, April 20`), `formatAbsolute`, `formatDurationMs`
- `src/routes/dashboard/activity.tsx` — NEW: minimal route wrapper, mirrors `history.tsx` pattern
- `src/features/activity/components/ActivityPage.tsx` — NEW: stub with h1 only

`routeTree.gen.ts` regenerated (auto — do not edit manually per CLAUDE.md).

Verified: `pnpm tsc --noEmit` reports no errors in new files. Pre-existing errors elsewhere in codebase are unrelated.

## Key decisions locked in

1. **Name: "Activity"** (not "Logs" or "Usage"). Route `/dashboard/activity`, feature folder `src/features/activity/`, icon is lucide `Logs`.
2. **No schema migration for timestamps.** Duration computed from existing `generation_metadata.submitted_at` + `completed_at` | `failed_at` (all ISO strings inside JSONB). See `src/lib/server/media.server.ts:101,178,206` and `src/lib/server/fal-completion.server.ts:55,94,125-146` for where these are stamped.
3. **New JSONB field, not column:** `generation_metadata.provider_cost_cents` (integer, optional). Populated at FAL completion.
4. **User cost derivation:** in-memory lookup — `generation_metadata.generation_type` → `CREDIT_COSTS` (`src/features/credits/types.ts`) × `DOLLARS_PER_CREDIT` (0.1). No join to credit_transactions needed.
5. **Provider cost sources:** FAL only in v1. Google/OpenAI direct get `—` until a pricing table is built (that's #80 territory, explicitly deferred).
6. **Unified query:** one query over `user_images` for both `source='ai_generated'` and `source='ai_video'`. NO status filter, NO `deleted_at` filter. Soft-deleted rows render with reduced opacity + "deleted" badge.
7. **Account page:** replace inline Recent Activity widget (`src/routes/dashboard/account.tsx` lines ~291–336) with a 5-row Activity preview + "View all" link. Remove `transactions` state, `refreshTransactions`, `useEffect`. Keep credit balance widget.
8. **Reuse, don't reinvent:** `getR2PublicUrl` (`src/lib/image-storage.ts:104-109`), `getModelName` (used in `src/features/history/hooks/use-history-page.ts:26`), `Badge`, `SectionCard`, `StatsRow`, `EmptyStateCard`. HistoryCardList (`src/features/history/components/HistoryCard.tsx:81-137`) is the row-shape reference but adapt for denser column set.

## Outstanding work (phases 2–8)

Tasks in TaskList:

- **Phase 2:** `src/features/activity/types.ts` + `src/features/activity/server/list-activity.server.ts` — paginated query over `user_images` for both source types, no status/deleted_at filter, optional filter params, returns entries + totals
- **Phase 3:** `ActivityRow` + `ActivityPage` list rendering (no filters/totals yet), `hooks/use-activity-page.ts`
- **Phase 4:** `ActivityFilters` — model multi-select, status pills, date range picker
- **Phase 5:** `ActivityTotals` — summary stat row respecting active filters
- **Phase 6:** `src/lib/server/fal-completion.server.ts` — in `processImageResult` and `processVideoResult`, capture FAL cost into `generation_metadata.provider_cost_cents`. **Verify FAL's response field name at implementation time** — don't hardcode, inspect the actual shape.
- **Phase 7:** Replace Recent Activity widget on `/dashboard/account` with Activity preview
- **Phase 8:** `src/features/activity/CLAUDE.md` + update root `CLAUDE.md` feature table + `pnpm check && pnpm build` clean

## Notable context

- Related future work: #129 (direct OpenAI routing for GPT Image — experiment with direct Google/OpenAI vs FAL for speed on 3-5 image batches). User wants to validate direct-provider speed BEFORE revisiting Stripe/real-pricing (#26 currently In Progress, should likely move back to Up Next).
- #80 "credits: real FAL-based pricing and spend tracking" is the natural follow-up for the provider_cost column — once FAL cost capture lands here, #80 becomes the per-model pricing table for direct providers.
- User emphasized this is NOT a dev log — it's a tool pro teams will rely on for billing commissions. Take UI polish seriously. Filters and totals are table stakes, not nice-to-haves.

## Git state

- Branch `feat/activity-log-130` checked out
- Uncommitted: 2 modified (`nav-items.ts`, `routeTree.gen.ts`), 3 new (`time-format.ts`, `activity.tsx`, `features/activity/`)
- Issue #130 exists on GitHub, added to project board "GenZen Roadmap"
- Nothing pushed yet
