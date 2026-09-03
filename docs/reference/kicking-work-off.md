# Kicking work off

What genzen is for, stated once, because it decides more design questions than
any other fact about the app.

> **A surface is a place to kick work off, never a place that hosts and
> babysits it.** You move around the app, press Generate as fast as you can
> think, and everything you started is captured and running behind you.

The session it is built around: pick a model, paste a prompt, Generate; paste a
different prompt, Generate; take three of the results into Lighting and fire
those off too. Screen full of work in play, feedback immediate, nothing waiting
on anything else.

## What that requires of a surface

- **A press is acknowledged in the same frame.** Not after a model answers, not
  after a row is reserved. If something has to be written or submitted first,
  put the placeholder down and fill it in.
- **Nothing that starts work is disabled while work is starting.** A button
  that greys out for its own request turns a four-press burst into a queue.
- **Nothing is modal about a running generation.** Navigate away, come back, it
  is still there and still arriving.
- **Results accrue in one place.** They are in Images, the spend is in
  Activity, and the delete is Trash — not a surface's private idea of any of
  those three.

## Why it also decides cost

Cost is not the friction here; friction is the friction. A press that feels
free gets pressed forty times an afternoon, which is the point — so the cheap
fast model is the default anywhere the loop matters, and the estimate is
printed before the press rather than defended after it.

## The failure this exists to prevent

A new surface reimplements the wall: its own tiles, its own polling, its own
delete, its own idea of what "pending" looks like. It is always worse, because
the shared path is the one that got the attention, and the divergence shows up
as exactly the thing the app is supposed to be good at feeling slow.

`lab/people` did this for two days (#578) — a board held in `localStorage`
against expiring provider urls, a Keep button to promote a result into the
library, a hand-rolled tile that reported "Rendering" for a minute after the
picture existed. Every one of those is something Images already does. What was
genuinely new in that page was one thing: a model writing *who* to generate.

**The test for a new surface: what does it know that the wall does not?** That
part is the feature. Everything else it needs, it should be submitting into.
See `docs/reference/generation-presentation-contract.md` for how a generation
must look once it is on screen.
