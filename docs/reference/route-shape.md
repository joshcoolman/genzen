# Route shape

**The shape itself now lives in the house standard**
(`~/repos/project-standard/README.md`, "Route shape") — the file tree, the
no-styles-in-the-view rule, the `_hooks/` split, the naming, and the
server/client seam. #189 was the proof it survives a complex view: Canvas went
from a 1698-line component to `page.tsx` -> `view.tsx` + `use-view.ts`, eight
concern hooks and twelve component folders, rendering pixel-identical.

What stays here is genzen's own: the primitives that fell out of these
conversions, and the evidence behind the rules.

Established converting Activity (#185, `3ec82c1`), settled by Trash (the
server/client seam), proved by Images and Canvas (#189). **Copy Trash** — it is
the one with the seam right; Activity still fetches from the client and is the
exception, not the pattern.

## What the no-styles rule bought

Three things, observed rather than predicted:

- **It converts markup into named things.** A styled `<div>` stays anonymous
  forever; a component has to be called something, and naming it is what reveals
  it already exists elsewhere.
- **It smoked out primitives.** `Stack`, `PageHeader` and `Pagination` fell out
  of one route. Canvas added `canvas-surface`, which named a boundary that had
  been implicit: what scales with the zoom versus what stays a fixed screen
  size.
- **It fixed a defect a comment was holding shut.** The seven-value
  `grid-template-columns` was declared twice, on the header strip and on the
  row, with a note in each file asking the next reader to keep them in step. The
  two are siblings, so a single declaration needs an owner for both: `run-table`
  now defines `--run-columns` and `run-row` reads it. Structure replaced the
  comment.

A fourth, from Canvas: splitting a component out forces you to list the CSS
rules it owns, and `styles.selected` turned out never to have existed — every
selected card had been rendering `class="undefined"` for as long as the rule was
missing.

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

## The conversion diffs, and why they came out clean

The pixel-diff method is in the house standard. One genzen-specific reason the
numbers were as clean as they were, worth keeping because it explains the
absence of a whole class of regression:

**A module class is unlayered, so it beat every utility it replaced.**
(Historical — Tailwind is gone as of #186.) Tailwind's output sat in
`@layer utilities`; an unlayered rule wins whatever the specificity. Convenient
for `hover:` pairs — `.deleteButton { color }` no longer needed a hover twin to
outrank `hover:text-accent-foreground`. Dangerous for anything a shadcn variant
sized: `Button` set its own svg via `[&_svg:not([class*='size-'])]:size-4`, so
the `h-3 w-3` on the icon was already dead, and restating it as
`.icon { width: .75rem }` would have silently shrunk an icon the conversion was
supposed to leave alone. The lesson that outlives Tailwind: check what a
declaration is _actually_ doing before porting it — here, only the margin was.
