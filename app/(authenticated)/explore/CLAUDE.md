# Explore

Browsing, not working. A masonry wall of every finished image, and the lightbox
over it.

## Why it exists

A wall with no task attached to it. Nothing here is a control: no toolbar, no
filters, no sort, no select mode, no captions, no hover actions. /images owns
all of that, and a second copy would be a second place to look for the same
setting.

This route was created on the theory that the lightbox belonged **only** here --
that an overlay covering everything costs nothing while browsing and buries your
work while working, so /images should preview in place instead (#308). The
second half of that did not survive contact: a preview that leaves the working
surface visible offers actions unrelated to the image you are looking at, which
is worse than covering it. /images went back to an overlay and its in-place
preview was deleted.

What stands is the first half. Browsing is a mood worth its own surface, and
this is it. An overlay is simply not exclusive to it.

## The overlay is `image-detail/`, and never "the lightbox"

`_components/image-detail/` is the three-column one: image, the prompt that
made it, filmstrip of the wall. **Do not rename it toward "lightbox", and do
not let another route import it.**

That is not fussiness. The name cost two rounds of the same mistake. The
component lived in `images/_components/lightbox/` and Explore borrowed it, so
anyone asked for a plain viewer on /images found "a lightbox" already in the
tree, wired to it, and shipped a prompt column and a filmstrip nobody wanted
there. /images now has its own `image-viewer/`, which is what a lightbox
actually looks like — scrim, chevrons, an X, no text. The two answer different
questions: this one is "what made this picture", that one is "show me this
bigger".

It was briefly `job-view/`, after the internal name in #271. That is
Midjourney's word for a generation and means nothing in this codebase.

The cursor is `_hooks/use-image-detail.ts`. /images has its own near-identical
copy, on purpose — sharing the hook is how the layout got imposed the first
time.

`_hooks/use-wheel-step.ts` is the wheel gesture (#394's sibling, #393): bound on
the overlay root so it works with the pointer anywhere, `passive: false` so it
takes the event rather than letting the rail scroll itself away from the image.
`createWheelStepper` is the pure accumulator underneath it and is unit-tested —
mapping event to step gives one image per notch on a mouse and forty on a
trackpad flick, so deltas buy steps against a pixel budget with a rate cap.

**Paging must not blank the frame.** The overlay held `loaded` state that reset
on every URL change, so each step went image → pulsing placeholder → image even
when the next was already cached from the preload. It now holds the outgoing
image until the incoming one decodes, and shows the placeholder only after 250ms
— which is the difference between a load and a strobe.

## Removability

**One folder and one nav entry.** Delete `app/(authenticated)/explore/` and the
`explore` item in `src/lib/nav-items.ts` and the route is gone. There are no
cross-route imports in either direction any more; the overlay and its cursor
live here now.

## Quirks

- **`columns`, not a JS masonry.** A width rather than a count, so the column
  count falls out of the space available and no breakpoint is needed. (The
  justification used to name the collapsing sidebar; that collapse was retired
  in #471, and the property still earns its place on its own.) The cost is reading order — items fill down each column, then
  across — which is the right trade on a surface with no order worth following
- **The rows are a snapshot.** `page.tsx` loads once and nothing polls. A
  generation finishing while you browse does not appear until you reload, which
  is correct here: the wall shifting under a pointer mid-scroll is the failure,
  not the stale row
- **Completed images only**, and only those with a `storage_path`. A pending or
  failed generation is a job, and jobs belong on the working surface
