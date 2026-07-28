# Route shape

How a route is built. Established converting Activity (#185, `3ec82c1`), which
is the worked example — read it beside this file.

Provisional: Activity is the only route in this shape. It is a candidate for
`~/repos/project-standard` once a complex view (Images, Canvas) proves it
survives contact.

## The shape

```
app/(authenticated)/<route>/
├── page.tsx              renders <View />, nothing else
├── view.tsx              composes components; no className, no module
├── use-view.ts           the state view.tsx renders -- omit if there is none
├── _actions/             this route's own reads and writes
└── _components/
    ├── <subject>/        <subject>.tsx + <subject>.module.css
    └── …
```

`page.tsx`, `view.tsx` and `use-view.ts` sit bare in the route folder. There is
no `view.module.css` -- the view has no styles to put in one. They are **route files**, the category Next.js already puts there
(`page`, `layout`, `loading`, `error`), not components — so "one folder per
component, everywhere, no exceptions" does not reach them. State it as the
category, never as an exception, or the next reader argues their component is
special too.

## Rules

- **`view.tsx` carries no styles.** No `className`, no module of its own. It is
  a `Stack` of components. Where the frame itself is the design -- Login is a
  full-height centred column -- that frame becomes a named component
  (`centered-panel`), not a module on the view.
- **The wrapper takes a role name** (`view`). One per route, so the folder
  supplies the subject.
- **The hook paired with `view.tsx` takes the same role name** — `use-view.ts`,
  always. The pair shares a base name because it is one thing split in two.
- **Any other hook takes a subject name** — `use-generate.ts`, not
  `use-canvas-generate.ts`. Same shape as components: one role-named wrapper,
  subject-named parts.
- **A part takes a subject name, and a bare shape is not one.** `row`, `card`,
  `panel`, `list` need a subject; `totals`, `filters` already are one. Hence
  `run-row`, matching the existing `image-card` family.
- **Never repeat the route name.** `activity/_components/run-row/`, not
  `activity-row/`. Qualify only to break a real collision — renaming
  `activity-filters` to `filters` collided with `import type { ActivityFilters
as Filters }` in its own file, and the type kept its name.
- **`features/` is earned by two or more routes.** One consumer comes home:
  Activity's `use-activity-page` and `get-activity-entry` did.

## Why no styles in the view

Not tidiness. Three things it buys, all observed rather than predicted:

- **It converts markup into named things.** A styled `<div>` stays anonymous
  forever; a component has to be called something, and naming it is what reveals
  it already exists elsewhere.
- **It smoked out primitives.** `Stack`, `PageHeader` and `Pagination` fell out
  of one route. `ImageBox`, `Label`, `Card`, `EmptyState` and `StatusBadge` are
  visible and waiting — see #187.
- **It fixed a defect a comment was holding shut.** The seven-value
  `grid-template-columns` was declared twice, on the header strip and on the
  row, with a note in each file asking the next reader to keep them in step. The
  two are siblings, so a single declaration needs an owner for both: `run-table`
  now defines `--run-columns` and `run-row` reads it. Structure replaced the
  comment.

The cost: it needs a layout primitive to exist first, or the view has nowhere to
put spacing. `Stack` is deliberately two props — every prop added to it is a
styling decision creeping back into the view.

## Primitives

Staged in `src/components/primitives/` — a temporary folder with its own README,
flattened into `src/components/` before #185 closes. All exported from the single
root barrel, so the import path never changes.

| built          | why it exists                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `Stack`        | the view has to compose spacing without styling                                                            |
| `PageHeader`   | title + optional description, and an `aside` slot so "put a stat opposite the title" stays out of the view |
| `Pagination`   | domain wording behind an `itemNoun` prop                                                                   |
| `MultiSelect`  | trigger with count, grow-to-fit panel, pinned "Clear all", brand-green check                               |
| `SingleSelect` | segmented pills, one at a time; choosing the chosen one clears it                                          |

Candidates, seen two or more times and waiting for the next sighting to fix
their shape: `ImageBox`, `EmptyState`, `Card`, `Label`, `StatusBadge`.

`StatBadge` was built and deleted the same day when its only consumer went
(`git show adf67e8`). An unused primitive is worse than a missing one — it gets
shaped by needs nobody has.

**A note on grain.** `Thumbnail` already existed when three call sites
hand-rolled a small image box, because it had grown to 15+ props — delete
button, four overlay slots, selection, pending/failed states. Every one was
locally reasonable and the ratchet only turns one way. The test: a new prop must
be a **variant of the same thing** (size, tone, density). A new _capability_ is
a second primitive.

## Unresolved: the server/client seam

`page.tsx` is three lines and `use-view.ts` fetches from the client in an
effect. `~/repos/bootsy` does the opposite: `page.tsx` is a server component
doing auth and queries, handing props to a `'use client'` view.

The file tree looks identical either way, so this decides itself by default if
nobody decides it — and Activity is now the thing six other routes will copy.
Settle it before Images.

## Verifying a conversion

The pixel diff is what makes "renders identically" a fact. Method and the traps
it has caught are on #185; two that bear repeating:

- `--full` screenshots resize the viewport and re-render, so lazy images land
  mid-paint and the diff is nondeterministic. Set a tall viewport instead.
  `img.complete` is true well before anything is painted.
- When a column is genuinely unstable, mask it and say so. "Excluding the
  thumbnail column, max delta 0" is a stronger and more honest claim than one
  number over the whole image.
- **Park the pointer off _content_, not merely off the element under test.**
  Moving it to 900,700 to clear a popover put it over a table row instead, and
  `.row:hover` repainted a border and a background: 72,657 pixels of difference
  that were entirely the mouse. `1435,3` is outside everything.

**Do one job per commit.** Convert, then rename, then move, then extract. A
diff cannot distinguish a styling regression from a renamed import, and reuse
converges values that a faithful conversion is trying to preserve — so extract
a primitive only where the call sites are already identical, and let anything
requiring a visual decision land in a commit that says so.
