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
is worse than covering it. /images went back to the lightbox and its in-place
preview was deleted.

What stands is the first half. Browsing is a mood worth its own surface, and
this is it. The lightbox is simply not exclusive to it.

## Removability

**One folder and one nav entry.** Delete `app/(authenticated)/explore/` and the
`explore` item in `src/lib/nav-items.ts` and the route is gone. Nothing outside
those two places refers to it, and /images was not modified to make it work.

The dependency runs one way, Explore -> Images, and only for two imports:

- `../images/_components/lightbox/lightbox` — presentational, props only
- `../images/_hooks/use-lightbox` — the cursor over a list

Still borrowed rather than moved, but the reason has expired. It was "an
experiment that may not survive, so do not edit the working route for it";
Explore stayed, and /images now renders the same lightbox for its own sake. Two
real consumers, so by the house standard both have earned `src/components/` and
a shared hook. **The move is the outstanding chore, not a judgement call.**

## Quirks

- **`columns`, not a JS masonry.** A width rather than a count, so the column
  count falls out of the space available and the collapsing sidebar needs no
  breakpoint. The cost is reading order — items fill down each column, then
  across — which is the right trade on a surface with no order worth following
- **The rows are a snapshot.** `page.tsx` loads once and nothing polls. A
  generation finishing while you browse does not appear until you reload, which
  is correct here: the wall shifting under a pointer mid-scroll is the failure,
  not the stale row
- **Completed images only**, and only those with a `storage_path`. A pending or
  failed generation is a job, and jobs belong on the working surface
