# Route shape

How a route is built. Established converting Activity (#185, `3ec82c1`) and
extended by Trash, which settled the server/client seam below. Read both beside
this file; Trash is the one with the seam right.

Provisional: still a candidate for `~/repos/project-standard` rather than part
of it, until a complex view (Images, Canvas) proves it survives contact.

## The shape

```
app/(authenticated)/<route>/
├── page.tsx              renders <View />, nothing else
├── view.tsx              composes components; no className, no module
├── use-view.ts           the state view.tsx renders -- omit if there is none
├── _actions/             this route's own reads and writes
├── _hooks/               every other hook -- appears only once there is one
│   └── use-<subject>.ts
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

**`use-view.ts` stays bare; a second hook creates `_hooks/`** and takes that one
and every one after it. The split is not arbitrary: `view.tsx` and `use-view.ts`
are one thing cut in two, which is why they share a base name, and filing one of
them away hides the pair — you would read the view and have to go looking for
its state. Every other hook is a part, and parts live in folders, exactly as
components do.

Written when Edit reached six hooks. Activity, Trash and Account have one each
and keep three bare files; they do not grow an empty folder for symmetry. The
folder is earned the same way `features/` is, so its presence carries
information: this route has state beyond its view.

## Rules

- **`view.tsx` carries no styles.** No `className`, no module of its own. It is
  a `Stack` of components. Where the frame itself is the design -- Login is a
  full-height centred column -- that frame becomes a named component
  (`centered-panel`), not a module on the view.
- **The wrapper takes a role name** (`view`). One per route, so the folder
  supplies the subject.
- **The hook paired with `view.tsx` takes the same role name** — `use-view.ts`,
  always. The pair shares a base name because it is one thing split in two.
- **Any other hook takes a subject name and lives in `_hooks/`** —
  `_hooks/use-generate.ts`, not `use-canvas-generate.ts`. Same shape as
  components: one role-named wrapper, subject-named parts.
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
  of one route. `Label`, `Card`, `EmptyState` and `StatusBadge` are visible and
  waiting — see #187.
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

They live flat in `src/components/`, one folder each, all exported from the
single root barrel.

They spent a while in a `primitives/` subfolder, which was staging and is now
gone. It is worth knowing why, because the name kept inviting people to treat it
as the design system forming: **`src/components/` already is that**, and a
subfolder inside it only asks a question with no stable answer — is `ImageBox` a
primitive or a component? `ConfirmDialog`? `Thumbnail`? Files land by mood,
and the folder stops meaning anything. #181 flattened this directory once
already; the standard's rule is "the folder listing _is_ the catalogue."

| built           | why it exists                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `ConfirmDialog` | nine imports of `AlertDialog` repeated at five call sites, varying only in their strings                   |
| `ImageBox`      | a square that shows an image, and owns the four states it can be in                                        |
| `MultiSelect`   | trigger with count, grow-to-fit panel, pinned "Clear all", brand-green check                               |
| `PageHeader`    | title + optional description, and an `aside` slot so "put a stat opposite the title" stays out of the view |
| `Pagination`    | domain wording behind an `itemNoun` prop                                                                   |
| `SingleSelect`  | segmented pills, one at a time; choosing the chosen one clears it                                          |
| `Stack`         | the view has to compose spacing without styling                                                            |

Candidates, seen two or more times and waiting for the next sighting to fix
their shape: `EmptyState`, `Card`, `Label`, `StatusBadge`. `EmptyState` picked
up its third sighting on Trash and is the next one to build.

`StatBadge` was built and deleted the same day when its only consumer went
(`git show adf67e8`). An unused primitive is worse than a missing one — it gets
shaped by needs nobody has.

**A note on grain.** `Thumbnail` already existed when three call sites
hand-rolled a small image box, because it had grown to 15+ props — delete
button, four overlay slots, selection, pending/failed states. Every one was
locally reasonable and the ratchet only turns one way. The test: a new prop must
be a **variant of the same thing** (size, tone, density). A new _capability_ is
a second primitive.

It reached **31 props**, and the worked example of the rule is its `layout`
prop. `layout="list"` returned early into a branch sharing almost nothing with
the grid one: no status, no overlays, no badges, no selection. About 20 of the
31 props were silently dead inside it — Trash's first draft passed `selected`
and `selectedClassName` and they did nothing at all. That is what a
capability wearing a variant's clothes looks like: the type says the props
exist, and the branch decides they don't.

Two symptoms worth recognising early, both visible from the call site alone:

- **A slot whose name stops being true.** `footer` genuinely was a footer in
  grid layout. In list layout nothing was below anything and it meant
  "everything that isn't the image" — one prop, two meanings, chosen by a
  different prop.
- **Wrappers that exist to satisfy the component rather than the design.** The
  Trash row needed four nested elements to reach its own title, two of them
  only because content had to be handed in through a slot.

The fix was not to simplify Thumbnail. It was to ask what the row actually
needed — a square, an image, and a fallback — and find that Base UI's `Avatar`
already owned the only hard part, the load-state machine. `ImageBox` is 60
lines. Deleting the branch it replaced removed 45 and three props.

## The server/client seam

**`page.tsx` fetches. The view is seeded, not empty.** It is a server component
that runs the route's read and hands the result to a `'use client'` view as
`initial`; `use-view.ts` seeds its state from that prop and owns every read
after it. Settled on Trash (#185); Activity still has the old shape and is the
exception, not the pattern.

```tsx
export default async function Trash() {
  const initial = await listTrashedImages()
  return <View initial={initial} />
}
```

What it buys, and the one thing to watch:

- **The loading state stops existing.** Trash's `isLoading`, its `Loading…`
  block and its empty first paint all went in the same commit. A spinner that
  covers a query the server already ran is work the page invented for itself.
- **`resolveAuth()` runs once, on the server.** The client hook took a `userId`
  prop it only used to decide whether to fetch.
- **`initial` is a seed, not the source of truth.** Every mutation here is
  optimistic and refetches, so the hook must still own the list. A route that
  reads the prop on every render instead of `useState(initial)` will snap back
  to server state mid-interaction.

## Verifying a conversion

The pixel diff is what makes "renders identically" a fact. Method and the traps
it has caught are on #185; two that bear repeating:

- `--full` screenshots resize the viewport and re-render, so lazy images land
  mid-paint and the diff is nondeterministic. Set a tall viewport instead.
  `img.complete` is true well before anything is painted.
- When a column is genuinely unstable, mask it and say so. "Excluding the
  thumbnail column, max delta 0" is a stronger and more honest claim than one
  number over the whole image.
- **A module class is unlayered, so it beat every utility it replaced.** (Historical
  — Tailwind is gone as of #186, but this is why the conversion diffs came out clean.)
  Tailwind's output sat in `@layer utilities`; an unlayered rule wins whatever
  the specificity. Convenient for `hover:` pairs — `.deleteButton { color }` no
  longer needs a hover twin to outrank `hover:text-accent-foreground`. Dangerous
  for anything a shadcn variant sizes: `Button` sets its own svg via
  `[&_svg:not([class*='size-'])]:size-4`, so the `h-3 w-3` on the icon was
  already dead, and restating it as `.icon { width: .75rem }` would silently
  shrink an icon the conversion was supposed to leave alone. Check what the
  utility was actually doing before porting it — here, only the margin was.
- **Park the pointer off _content_, not merely off the element under test.**
  Moving it to 900,700 to clear a popover put it over a table row instead, and
  `.row:hover` repainted a border and a background: 72,657 pixels of difference
  that were entirely the mouse. `1435,3` is outside everything.

**Do one job per commit.** Convert, then rename, then move, then extract. A
diff cannot distinguish a styling regression from a renamed import, and reuse
converges values that a faithful conversion is trying to preserve — so extract
a primitive only where the call sites are already identical, and let anything
requiring a visual decision land in a commit that says so.
