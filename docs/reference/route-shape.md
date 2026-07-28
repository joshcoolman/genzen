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
├── use-view.ts           the state view.tsx renders
├── _actions/             this route's own reads and writes
└── _components/
    ├── <subject>/        <subject>.tsx + <subject>.module.css
    └── …
```

`page.tsx`, `view.tsx`, `view.module.css` and `use-view.ts` sit bare in the
route folder. They are **route files**, the category Next.js already puts there
(`page`, `layout`, `loading`, `error`), not components — so "one folder per
component, everywhere, no exceptions" does not reach them. State it as the
category, never as an exception, or the next reader argues their component is
special too.

## Rules

- **`view.tsx` carries no styles.** No `className`, no module of its own. It is
  a `Stack` of components.
- **The wrapper takes a role name** (`view`). One per route, so the folder
  supplies the subject.
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

**Do one job per commit.** Convert, then rename, then move, then extract. A
diff cannot distinguish a styling regression from a renamed import, and reuse
converges values that a faithful conversion is trying to preserve — so extract
a primitive only where the call sites are already identical, and let anything
requiring a visual decision land in a commit that says so.
