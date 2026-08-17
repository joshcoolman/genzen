Owns the six colors a user edits on `/account/style`, and the palette derived
from them. Ported from `~/repos/bootsy`'s `features/theme` (#406).

## The dependency direction that matters

`derive.ts` is **client-safe and must stay that way** — the editing form derives
on every keystroke to draw its preview. `theme-store.server.ts` imports
`db.server` and can never be reached from the client.

`index.ts` therefore exports `derive` only. **Do not add the store to it.** A
barrel over both halves is how the database ends up in a browser bundle; server
callers import `theme-store.server` by path. `features/auth` states the same
rule for the same reason.

## How it applies

`(authenticated)/layout.tsx` reads the row, derives, and renders one `<style>`
holding a `:root` block. It beats `tokens.css` on document order alone — no
`!important`, no provider, no client state, no `data-theme`. Components never
learn a theme exists; they read the same `var(--token)` either way.

## Invariants that fail silently

- **No row means no `<style>`.** That is the design, not an optimisation: an
  uncustomized app renders `tokens.css` untouched, so `DEFAULT_CORE` and the
  stylesheet can never drift into being two disagreeing copies of one palette.
  bootsy stores a warning in `tokens.css` asking the next reader to keep its two
  copies in sync; that requirement does not exist here. Writing a row of
  defaults on first visit would reintroduce it.
- **`DEFAULT_CORE` reproduces `tokens.css` exactly.** Saving the form untouched
  has to leave the app looking as it does, or the page is a trapdoor. The
  deltas in `derive.ts` are the values that make that true, not round numbers,
  and `derive.test.ts` pins each one to the token it reproduces. Retuning a
  delta means updating that test with a rendered preview in front of you.
- **`parseCore` degrades to null rather than throwing.** A theme is decoration
  and must never take down the layout that renders it; an unreadable row means
  "no customization", not a 500 on every authenticated route.

## Deliberately not themed

Status hues (`--danger`, `--warning`, `--success`, `--info`) — a palette that
can recolor "this failed" can make a failure look like a success. Also
`--row-hover` and the elevation tokens, which are alpha washes over whatever
ground they land on and have no fixed color to override, and `--field` /
`--field-hover`, which are already `color-mix` over `--surface-raised` and
follow it for free.

## Decided, not worth relitigating

- **HSL, and no color library.** bootsy derives in oklch via `culori` and emits
  hex. `tokens.css` opens by claiming "Colors are HSL throughout… One notation
  for every value", and emitting hex would falsify that in the one file that
  makes the claim. The real requirement is lightness arithmetic plus a
  relative-luminance function, which is smaller than the dependency.
  The tradeoff is real and stated in `derive.ts`: HSL lightness is not
  perceptual, so the deltas are tuned for a dark palette.
- **The core is stored, the palette is not.** A change to how a step is computed
  then reaches every existing theme instead of only new ones.
- **One JSONB column, not six.** bootsy used a column per color and needed a
  second migration the first time the core grew by one.
