# GenZen

What the app does and must do. Behaviour, not implementation — this survives a
stack change. For how the code is organized see `CLAUDE.md`; for how a generation
is presented in each state see `reference/generation-presentation-contract.md`.

## Core loop

Write a prompt, pick one or more models, generate, and keep what's worth keeping.
Everything else in the app serves that loop.

## Surfaces

**AI Images** — the primary surface. Multi-prompt, multi-model generation: select
several models and a per-model count, submit once, get every result back into one
board. Reference images can be attached. Edit and variation flows work from an
existing image rather than a blank prompt.

**Canvas** — a spatial arrangement of images from the library, where generation
happens in place. Removing an image from the canvas is non-destructive; it stays
in the library.

**Library / user images** — everything generated or uploaded, filterable, the
source for reference images and canvas placements.

**Activity** — a chronological log of every generation including failures, each
with its cost and duration.

**Trash** — soft delete with recovery. Nothing is destroyed on the first action.

**AD** — a chat assistant sidebar with vision and tool calling. Skills
(`src/lib/prompts/skills/`) are prompt-craft presets it can launch.

**MCP** — the same generation capability exposed to external Claude clients over
`POST /api/mcp`, authenticated by a personal `gz_live_*` key.

## Rules that must hold

- **A click always leaves an artifact.** Every generate path reserves its row
  before any fallible work, so a generation is always visible as pending,
  completed, or failed with a reason and a Retry. Nothing fails silently.
- **A missing provider key is a visible failure,** not a dead click — it is one
  failure among many, not a special case.
- **Cost is shown in dollars.** No credit math that obscures the real price, no
  "unlimited." What a generation cost is always recoverable from Activity.
- **State survives navigation and refresh.** Moving between surfaces or reloading
  never loses in-flight work or an unsubmitted prompt.
- **Results appear as they complete.** Never batch-wait for the slowest model in a
  multi-model submit.
- **Deletion is recoverable.** Soft delete, with Trash as the recovery path.
- **A user only ever sees their own data.** Server code holding a service-role
  credential filters by user id explicitly rather than relying on row-level
  policy.

## Non-goals

- Not a SaaS. This is a personal playground; there is no signup funnel, no
  marketing homepage, no growth surface. `/` goes to the app or to login.
- No general-purpose document/image management. The library exists to feed
  generation.
