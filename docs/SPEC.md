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

Clicking a gallery image opens it bigger. The image the generator is working
from is shown and changed in one place, the chip at the top of the panel, and
the grid does not mark it (#284). Whether the resulting call is an edit or a
generation is a detail of building the request -- there is no edit mode and no
edit route.

**Canvas** — a spatial arrangement of images from the library, where generation
happens in place. Removing an image from the canvas is non-destructive; it stays
in the library.

**Library / user images** — everything generated or uploaded, filterable, the
source for reference images and canvas placements.

**Video** — the same loop for clips: a prompt, a model, optionally a starting
image. Three models, each with its own endpoints and costs.

**Lab** — where a single step of the work is put on its own page and judged
before it earns a place in the panel: Enhance, Describe, Variations, Frames.
Each states the question it is asking and shows the instruction file
it sends, so what the model was told is on screen with what it returned.

**Explore** — browsing what is already there, not working on it.

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
- **Moving things is cut and paste.** Most of the work is gathering and
  re-placing: grab a few images, paste them in as references, take a prompt that
  worked and try it somewhere else, paste, adjust, paste again. So the clipboard
  is how things move through the app, not a convenience laid over some other
  mechanism. What it forbids is the alternative: "move to…" pickers, destination
  dialogs, a step that asks where something should go. You already know — you
  are holding it. An internal copy used to carry a **reference** to the row
  rather than its bytes, so pasting something you already owned did not
  duplicate it; the only surface that put an id on the clipboard was the Cmd-F
  overlay, and both went in #348. **Today a paste carries bytes and uploads a
  new row, even for an image you already have.** That is a gap, not the intent
  -- #347 holds what putting the id back would take.
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
