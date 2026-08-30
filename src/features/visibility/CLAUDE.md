# Visibility

Taking rows off a wall without destroying them, and its opposite -- showing
only the ones you named (#504). `hidden_at` on `user_images` is the whole
store.

Promoted here from `app/(authenticated)/images/_hooks/` in #537, when Video
became the second consumer. The same shape as grouping before #517: the write
never filtered on `source`, so it was correct for a clip the day it shipped and
only the surface was missing.

## Quirks

- **Hide and focus are one predicate**, `isVisible`. "Hide these eight" and
  "show only these two" are the same filtered view from opposite ends, so there
  is one rule with two inputs rather than two filters to keep in agreement.
- **Focus wins outright over hidden**, never intersects with it. While a
  spotlight is on, "hidden" is not the question being asked -- you named the
  rows you wanted. Intersecting would silently drop rows you had just selected,
  with the bar reporting a count that did not match the wall.
- **Only hiding persists.** Hidden is a decision and survives a refresh, because
  the noise you cleared away is still noise tomorrow. Focus is a glance and dies
  with the page, because a spotlight left on yesterday is indistinguishable from
  a broken wall.
- **Independent of `deleted_at`.** Trashing does not clear `hidden_at`, so a
  restore puts a hidden row back hidden. Nothing else is cleared either -- group,
  canvas membership, objects all stay, because nothing is being taken away.
  That is the whole difference from Trash, which clears `group_id` and canvas
  membership so a restore has one destination.
- **The hook knows nothing about either surface.** It takes rows satisfying
  `HideableRow` -- an id and a nullable timestamp -- and a `patch` function for
  the optimistic write. It took a `GalleryState` and read `SavedAiImage` rows
  until #537, neither of which a clip is and neither of which it needed.
- **The bar is the feature, not the hiding.** Hidden state you cannot see is a
  slower kind of lost, so `HiddenBar` (in `app/(authenticated)/_components/`,
  app-shared since #537) is what makes hiding a single click with no
  confirmation. It was a quiet rule _under_ the grid for one build, which is the
  one place it cannot work -- you reach it after running out of things to look
  at, which is when you have stopped looking.
- **A hidden row is never drawn among the visible ones.** The first shape
  toggled them back in while still calling them hidden, which read as broken:
  "4 hidden" over four visible pictures. The bar's tray is a holding area,
  plainly somewhere else, so the wall stays true.
