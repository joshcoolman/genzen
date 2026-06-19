# Plan: Remove Video Entirely

**Goal:** Reduce GenZen to its true product — AI image generation + Canvas, on the credits / activity / trash / account spine. Eliminate video as a complete vertical so it stops weighing on the workspace.

## North Star (the thing this serves)

> GenZen is the best place to **generate and organize AI images**. One prompt, fanned across the image models worth using; branch and compare non-destructively; laid out on an infinite canvas you can think in. Canvas and AI Images are **one product, two UIs** over the same `user_images` source of truth (delete in one, gone in both).
>
> It is **opinionated, not exhaustive** — routes to the fast, good models (Nano Banana direct to Google) and hides or cuts the slow ones (GPT Image).
>
> **It refuses to be:** a kitchen sink, a video tool, a neutral pipe to every model that exists.

Kept and loved: Trash, Activity, Credits, personal user account. Payment stays — as the quality bar ("shippable to a stranger"), decoupled from the separate decision of whether to ever open real signups.

## Key finding: no DB work

Dedicated video tables (`video_workspaces`, `video_generations`, `multishot_sequences`, `storyboards`) were **already dropped** in `20260613000000_drop_dead_tables.sql`. Videos now exist only as `user_images` rows (mp4 `fal_url` in `generation_metadata`). The old additive `ALTER TABLE user_images` video source-type / mime migrations are inert — leave them. **No new migration required.**

## The one real decision

Existing video **rows** in `user_images` (and their mp4s in R2) will become orphaned — no UI will surface them. Options:

- **(A) Leave dormant** — zero risk, a few dead rows. Recommended; do nothing.
- **(B) Purge** — `DELETE FROM user_images WHERE <is-video>` + R2 cleanup. Only if a clean DB matters to you. Reversible only from backup.

Default to (A) unless you say otherwise.

## Execution strategy: let the compiler be the checklist

1. Do **Phase A** (delete whole units) first.
2. Run `pnpm build`. TypeScript will now error on **every** dangling video import — that error list _is_ Phase B's worklist. No need to hunt tendrils by hand; fix until the build is green.

## Phase A — Delete whole units (no surgery)

- `src/features/ai-video/` (entire directory, 25 files)
- `src/features/multi-shot/` (entire directory)
- `src/routes/dashboard/video.tsx`
- `src/routes/dashboard/video.index.tsx`
- `src/routes/dashboard/video.edit.$videoId.tsx`
- `server/api/video-proxy.get.ts`
- `src/components/video-player-dialog.tsx` _(confirm no image path imports it — grep first)_

## Phase B — Snip tendrils in shared files (compiler-guided)

- `src/lib/nav-items.ts` — remove the `ai-video` nav entry
- `src/components/ModelSelector/models.ts` + `types.ts` — drop video model imports/types
- `src/components/ModelShowcase.tsx` — remove `ALL_VIDEO_MODELS` section
- `src/components/FeaturedModels.tsx` — remove video refs
- `src/lib/use-enabled-models.ts` — drop video models
- `src/routes/dashboard/settings.tsx` — remove video model toggles
- `src/lib/server/fal-completion.server.ts` — remove `processVideoResult`
- `src/lib/server/check-pending-generations.server.ts` — remove video polling branch
- `src/features/mcp/server/poll-fal-record.ts` — remove video poll handling
- `server/api/fal-webhook.post.ts` — remove video webhook branch
- `src/lib/server/fal-pricing.server.ts` — remove video pricing
- `src/lib/server/rate-limit.server.ts` — remove lone video ref
- `src/features/activity/` — `ActivityFilters.tsx` (`getVideoModelName`), `server/list-activity.server.ts`, `server/get-activity-entry.server.ts`, `types.ts`, `components/ActivityRow.tsx`, `ActivityPreview.tsx`, `ActivityDetailPanel.tsx`
- `src/features/credits/types.ts` + `components/TransactionHistory.tsx` — remove video credit-cost entries
- `src/features/ad/context/ad-context.tsx` — remove `/dashboard/video` persona line

## Phase C — Tests

- `src/features/credits/server/check-credits.server.test.ts` — drop video cost cases
- `src/lib/server/check-pending-generations.server.test.ts` — drop video case
- `server/api/fal-webhook.post.test.ts` — drop video case

## Phase D — Docs & copy

- `README.md` — strip video from Highlights + module count (22 → fewer)
- root `CLAUDE.md` — remove video/multishot from feature catalog
- `src/routes/terms.tsx`, `src/routes/privacy.tsx` — drop "video" mentions
- Delete `src/features/ai-video/CLAUDE.md`, `src/features/multi-shot/CLAUDE.md` (go with the dirs)

## Phase E — Auto-regenerated

- `src/routeTree.gen.ts` — regenerates on build once video routes are gone; never hand-edit
- `src/lib/types/supabase.ts` — leave; tables already dropped, so no change needed

## Phase F — Verify (acceptance)

- `pnpm build` passes clean
- `pnpm test` passes
- `agent-browser` smoke: sidebar has no Video; Canvas + AI Images generate and persist; Activity, Trash, Credits, Account all load

## Out of scope (do NOT drift into)

- GPT Image removal — separate, smaller chunk; next session.
- Provider-curation pass (hide slow models) — separate.
- Any new feature. This chunk only subtracts.
