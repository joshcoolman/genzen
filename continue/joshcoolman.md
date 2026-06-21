# Continue — joshcoolman

Personal resume pointer, keyed to GitHub login. Synced via git so any machine with
the latest pull gives the same session-start summary. **Keep this current:** replace
the "Where I left off" / "Next up" sections at the end of a work session and commit
(the `/handoff` skill writes here). This is a live pointer, not an append log — git
history holds the past. See `continue/README.md` for the convention.

## ⏯ Where I left off

**Shipped (2026-06-20) — PR #163** (branch `fix/canvas-model-labels-failures`):
FLUX Kontext Pro ref-image fix, persistent failed tiles + on-canvas model labels,
Activity `queued` status, and tests (registry invariants / masonry / persistence
contract / extracted `mapOutcomesToPlaceholders`). Also landed `ARCHITECTURE.md`
and `docs/generation-presentation-contract.md`.

## ▶ Next up — canvas convergence backlog

Full checklist lives in `docs/generation-presentation-contract.md`.

**Tier 1 issues:**

- **#164** — in-progress tile is a gray square with no spinner/model (the original
  complaint, only half-fixed)
- **#165** — completed-but-no-signedURL silently drops the tile
- **#166** — failed-tile Dismiss is UI-only (leaves stale `on_canvas=true` row)

**Sequencing:** do the Tier 2 `normalizeGeneration(record): GenerationView`
extraction **first** (functional core, single enforcement point for the
presentation-contract invariants) — #164 and the `pending`/`failed` boolean
nomenclature drift fall out of it — then #165, then #166.
