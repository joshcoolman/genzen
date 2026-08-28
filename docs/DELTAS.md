genzen follows [project-standard](https://github.com/joshcoolman/project-standard).
This file holds only what genzen decides differently, the questions the standard
leaves open that genzen has settled, and the quirks that would otherwise bite.
Everything not listed here, the standard decides — do not restate it.

Named `DELTAS` rather than `CODE-STANDARDS` on purpose: two files with
"standard" in the name is a question about which one wins. A delta is measured
from something and cannot be mistaken for the source.

## Deltas

**Server-side code carries one of two suffixes, and they mean opposite things
about importing (#241).** The standard has no such convention.

- **`.server.ts` — the client may never import it.** Doing so is a build error
  with a confusing message, and the suffix moves the mistake to the import line.
- **`.action.ts` — a `'use server'` module the client imports on purpose.** That
  is the entire point of the file.

Both suffixes existed before, but `.server.ts` carried both meanings: fourteen
`'use server'` modules wore it, so the only way to know which rule applied was
to open the file — the one job the convention exists to do. Actions also wore
three spellings (`.server.ts`, `.action.ts`, `.actions.ts`); `.action.ts` is now
the only one.

The distinction is exactly the `'use server'` directive, so it is checked rather
than remembered: `eslint-rules/server-suffix.js` fails a `.server.ts` that
declares the directive, or an `.action.ts` that does not. Test files are exempt,
since a test imports its subject rather than declaring the directive itself.

**The no-raw-color rule is checked, not remembered.** The rule itself is the
standard's (L0: never a raw color above the token layer); what is genzen's is
the enforcement. `pnpm check:colors` fails a `.module.css` that writes one, and
a deliberate exception carries `/* raw-color-exempt: <why> */`, which covers the
file and requires a reason — `grep raw-color-exempt` is the whole list.

_And the bar for adding a token,_ which the standard leaves to taste: the squint
test. Count the surfaces and text tones you can actually distinguish in the
rendered app, and have that many. Three surfaces, two inks, one line, one
accent. If a new token is within a few percent of an existing one, it is the
existing one. This came from finding the opposite (#229): 64 raw colors above a
token file that claimed a reskin was one edit, and a palette of 153 properties
where ten names resolved to four values, so a divider and a panel fill were the
same variable.

**Unused code rots; unused data accrues.** A field with readers and no writers
is a bug — it reports a fact nobody records. A field with writers and no readers
is fine, and often correct: a surface can be built over a captured fact whenever
someone wants it, while a fact not captured at the moment it existed is gone. So
capture the irreplaceable half of any pair, and say in the comment that nothing
reads it yet. `original_prompt` and `source_image_sha256` in
`generation_metadata` are both that, from #210.

_The asymmetry that decides it:_ an enhanced prompt can be re-derived from the
text you typed; your intent cannot be re-derived from an enhanced prompt.

## Settled: what earns a `features/` folder

The standard says `src/features/` holds domain code shared beyond one route. It
does not say how much sharing is enough, and it does not say whether a feature
may hold components. genzen's answers:

**A folder in `features/` means two or more routes need it. One consumer means
it belongs to that route.**

**`features/` is headless.** No `.tsx` lives there. Components go where the
standard already puts them — `src/components/` (primitives), `app/_components/`
(app-shared), or a route's own `_components/`. A feature is the domain logic
underneath: queries, actions, types, adapters, pure functions.

_Why both halves:_ the nav is the right instinct for **naming** a feature and
the wrong test for **placing** one. genzen originally had one feature per nav
item — nine features, nine screens — which left four of them with exactly one
consumer each, and hollowed out `app/` into five-line files that forward to a
component somewhere else. The route folder stopped being readable as the route.
A sibling app, since retired, tried the same thing and collapsed its
`features/activity/` and `features/trash/` back into `app/` for this reason.

A folder that needs a paragraph defending its existence usually does not have
one.

## Not deltas, though they look like it

- **Shared server code in `src/features/<domain>/server/`** rather than a
  route's `_actions/`. This is the standard working as intended: the same
  generation, image and trash code is reached from several routes, so it is
  shared domain code by definition. A route's own reads and writes still belong
  in its `_queries/` and `_actions/`.
- **No resume or continuation files.** They existed and were deleted. Orientation
  is the README `## Status` block and open issues, which is what the standard
  already says.
- **Branch, PR, merge.** genzen committed straight to `main` through the
  structural conversion (#168 → #229) and stopped on 2026-07-31. There is no
  delta left, and the practice worth carrying — push the branch, because three
  Macs pull from this remote — is a working habit rather than a code standard.
  It lives in the root `CLAUDE.md`.
- **`R2_*` env names are historical, not descriptive.** A fact about this
  repo's environment rather than a standards question; stated in the root
  `CLAUDE.md`, where the other service facts are.
