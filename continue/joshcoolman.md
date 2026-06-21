# Continue — joshcoolman

Personal resume pointer, keyed to GitHub login. Synced via git so any machine with
the latest pull gives the same session-start summary. **Keep this current:** replace
the "Where I left off" / "Next up" sections at the end of a work session and commit
(the `/handoff` skill writes here). This is a live pointer, not an append log — git
history holds the past. See `continue/README.md` for the convention.

## ⏯ Where I left off

**Session (2026-06-21) — canvas in-progress presentation polish (on main):**

Refined the canvas loading/label presentation on top of `6f925ab`'s screen-space
labels:

- **Loading state is now a screen-space overlay** (centered spinner + model name),
  fixed readable size at any zoom, sized to match the Generate pill — replaced the
  in-plane counter-scale (capped at 3×) that read tiny inside big gray tiles. The
  gray placeholder stays in-plane and scales with the tile.
- **Model-label visibility floor at 10%** (`transform.scale >= 0.1`).
- **Loading model name hidden at ≤10% zoom** (spinner only); shows above 10%.

Closed the Tier 1 canvas issues **#164 / #165 / #166** (fixed in `6f925ab` + this
polish).

Note: earlier this session I rebuilt the same Tier 1 work on a branch off a stale
main before realizing `6f925ab` (from the other machine) already had it + better.
Discarded the duplicate, took main. Git workflow is now **commit to main by
default** (see `CLAUDE.md`).

## ▶ Next up

No active canvas work items. Small optional follow-ups:

- **Failed tile** still counter-scales in-plane (not screen-space like loading) —
  minor consistency gap at low zoom.
- **`normalizeGeneration` has no unit tests** on main.

Parked Tier 2/3 structural (lower priority, await input):

- Canvas renders via bespoke markup vs shared `Thumbnail`
- Duplicated completion-polling loops (`use-images` vs `use-canvas-generate`)
- `boundsOf` / `getBounds` duplication; extract `spatialSort` + placeholder-collision geometry
- Deletion semantics differ (genealogy-aware vs plain `deleted_at`)
