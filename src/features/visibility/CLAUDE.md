# Visibility

Taking rows off a wall without destroying them, and its opposite -- showing
only the ones you named (#504). `hidden_at` on `user_images` is the whole
store.

Promoted here from `app/(authenticated)/images/_hooks/` in #537, when Video
became the second consumer. The same shape as grouping before #517: the write
never filtered on `source`, so it was correct for a clip the day it shipped and
only the surface was missing.

## Quirks

- **Focus has no entry point.** #587 took the Focus verb out of select mode on
  both routes, and nothing else ever set `focusIds` -- so every focus branch
  below is unreachable, and its tests keep it looking maintained. #590 is the
  decision: remove it, or give it a home that is not a batch verb. The two
  quirks under this one are written as if it still runs, and go with it.
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
- **The bar is scoped; `withheldIds` is not** (#546). The hook takes an
  `inScope` predicate saying where the wall is standing, and the tray, the
  count and `Show` are all about that place -- **the bar reports what would come
  back if you pressed Show**, which is the sentence that settles every scoping
  question, origin scope included. `withheldIds` stays library-wide, because it
  feeds group cards for groups you are _not_ in and scoping it would put a
  hidden picture back on a card the moment you stepped out. `inScope` must not
  know about hiding: it is asked of hidden rows, so a predicate that already
  filtered them would answer no to every one. It was unscoped until #546, which
  made the count wrong ("4 hidden" over a wall missing nothing) and `Show`
  wrong in a way that took an action -- pressing it inside a group unhid the
  library.
- **A group card says how many of its own are hidden**, counted by the route,
  not here. Otherwise the scoped bar makes hiding inside a group invisible from
  outside it, which is #504's failure at one level down.
- **A hidden row is never drawn among the visible ones.** The first shape
  toggled them back in while still calling them hidden, which read as broken:
  "4 hidden" over four visible pictures. The bar's tray is a holding area,
  plainly somewhere else, so the wall stays true.
