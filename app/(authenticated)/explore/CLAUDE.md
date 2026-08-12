# Explore

Browsing, not working. A masonry wall of every finished image, and the lightbox
over it.

## Why it exists

The lightbox was modelled on Midjourney's and then put on /images, where it felt
disorienting. The reason turned out to be context, not design: on Midjourney the
overlay lives in **Explore**, where you have no task and nothing to lose sight
of, so covering the screen costs nothing and landing back on the same scroll
position is the whole trick. On a working surface you do have a task, and the
same overlay buries it.

So this route is the context the lightbox was designed for. Nothing here is a
control: no toolbar, no filters, no sort, no select mode, no captions, no hover
actions. /images owns all of that, and a second copy would be a second place to
look for the same setting.

## Removability

**One folder and one nav entry.** Delete `app/(authenticated)/explore/` and the
`explore` item in `src/lib/nav-items.ts` and the route is gone. Nothing outside
those two places refers to it, and /images was not modified to make it work.

The dependency runs one way, Explore -> Images, and only for two imports:

- `../images/_components/lightbox/lightbox` — presentational, props only
- `../images/_hooks/use-lightbox` — the cursor over a list

Deliberately borrowed rather than moved. They have two consumers now, so by the
house standard they have earned a promotion to `src/components/` and a shared
hook — but doing that would edit the working route for the sake of an experiment
that may not survive. **If Explore stays, promote them and delete this
paragraph.**

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
