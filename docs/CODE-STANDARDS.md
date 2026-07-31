genzen follows [project-standard](https://github.com/joshcoolman/project-standard). This file states only where
it **differs**, and the one rule the standard leaves open that genzen has
settled. Everything not listed here, the standard decides — do not restate it.

## Deltas

**Commit straight to `main`.** No PR, no branch for ordinary work. The standard
says never commit to `main`; the global `~/.claude/CLAUDE.md` says branch before
non-trivial work. Both are overridden here and only here.

_Why:_ one person, one machine at a time, and `main` is how work moves between
three Macs. A branch left open is a machine that cannot continue. Feature
branches are justified only for genuinely risky or experimental work, and are
merged and deleted before the session ends.

**Server-only code carries a `.server.ts` suffix.** The standard has no such
convention. It exists because a server-only module imported from a client
component is a build error with a confusing message, and the suffix makes the
mistake visible in the import line rather than in the build log.

**`R2_*` env names are historical, not descriptive.** `src/lib/image-storage.ts`
is a generic S3 client pointed by `R2_ENDPOINT` — MinIO locally, any
S3-compatible bucket in a deployment. genzen has never been deployed and no
storage provider is chosen. The names were kept rather than churned across
`.env.local`, `scripts/local-up.mjs` and the deploy config.

**Never a raw color outside `src/styles/tokens.css`.** Checked, not remembered:
`pnpm check:colors` fails a `.module.css` that writes one. A deliberate
exception carries `/* raw-color-exempt: <why> */`, which covers the file and
requires a reason — `grep raw-color-exempt` is the whole list.

_Why:_ the token file claims a reskin is one channel edit. That claim was false
— 64 raw colors sat above it and the palette had drifted to 153 properties
where ten names resolved to four values, so a divider and a panel fill were the
same variable (#229). The bar for a token is the squint test: count the
surfaces and text tones you can actually distinguish in the rendered app, and
have that many. Three surfaces, two inks, one line, one accent. If a new token
is within a few percent of an existing one, it is the existing one.

**Unused code rots; unused data accrues.** A field with readers and no writers
is a bug (it reports a fact nobody records); a field with writers and no readers
is fine, and often correct. A surface can be built over a captured fact whenever
someone wants it — a fact not captured at the moment it existed is gone. So
capture the irreplaceable half of any pair and say in the comment that nothing
reads it yet: `original_prompt` and `source_image_sha256` in
`generation_metadata` are both that, from #210.

_The asymmetry that decides it:_ an enhanced prompt can be re-derived from the
text you typed; your intent cannot be re-derived from an enhanced prompt.

## Settled: what earns a `features/` folder

The standard says `src/features/` holds domain code shared beyond one route. It
does not say how much sharing is enough. genzen's answer, taken from
`~/repos/bootsy/src/features/CLAUDE.md`:

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
bootsy tried the same thing and collapsed `features/activity/` and
`features/trash/` back into `app/` for this reason.

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
