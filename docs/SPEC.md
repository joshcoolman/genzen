# GenZen

What the app does and must do. Behaviour, not implementation — this survives a
stack change. For how the code is organized see `CLAUDE.md`; for how a generation
is presented in each state see `reference/generation-presentation-contract.md`.

## Core loop

Write a prompt, pick one or more models, generate, and keep what's worth keeping.
Everything else in the app serves that loop.

## Surfaces

**Images** — the primary surface. Multi-prompt, multi-model generation: select
several models and a per-model count, submit once, get every result back into one
board. Reference images can be attached.

Clicking a gallery image highlights it, and a highlighted image is the primary
reference for whatever you prompt next. Clicking it again takes the highlight
off. Whether the resulting call is an edit or a generation is a detail of
building the request -- there is no edit mode and no edit route.

**Canvas** — a spatial arrangement of images from the library, where generation
happens in place. Removing an image from the canvas is non-destructive; it stays
in the library.

**Library / user images** — everything generated or uploaded, filterable, the
source for reference images and canvas placements.

**Activity** — a chronological log of every generation including failures, each
with its cost and duration.

**Trash** — soft delete with recovery. Nothing is destroyed on the first action.

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
- **Throwing things away stays cheap.** Generation is exploratory and most of
  what it produces is disposable — the work depends on being able to trash a
  batch and start over without hesitating. So the app must never accumulate
  enough weight to make that feel expensive: no confirmation in front of a
  reversible action, no organisation that has to be maintained, no state whose
  loss you would have to weigh first. Recoverability is what buys this, which is
  why Trash exists and why it is the only thing that interrupts (#236). A
  feature that makes deleting feel consequential is working against the core
  loop, however tidy it looks.
- **A user only ever sees their own data.** Server code holding a service-role
  credential filters by user id explicitly rather than relying on row-level
  policy.

## Non-goals

- Not a SaaS. This is a personal playground; there is no signup funnel, no
  marketing homepage, no growth surface. `/` goes to the app or to login.
- No general-purpose document/image management. The library exists to feed
  generation.
