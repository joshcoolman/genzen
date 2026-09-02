# Hitting an exact colour or an exact string

Two techniques for when the picture has to match a _specification_, not just a
vibe: a precise colour (a brand hex), and rendered text (a real string of
letters the model must spell). Both are cases where "describe what you want" is
not enough — you have a target the output is right or wrong against.

The general enhancement craft lives in `prompt-enhancement-strategies.md`; this
is the precision-control supplement. Sourced from Black Forest Labs' FLUX
guides, but the mechanics hold across the lineup's better text/colour models.

## Hex colours

The image models read hex codes (`#RRGGBB`) inline. This is how you pin a brand
colour or an exact palette instead of hoping "corporate blue" lands.

**Always pair the hex with its plain-English name.** The name is not decoration —
it's a second signal that disambiguates the code:

    Good:  a #1DA1F2 (twitter blue) phone case on a #14171A (near black) surface
    Bad:   a #1DA1F2 phone case on a #14171A surface

**Bind each colour to a specific object.** Loose colours bleed onto the wrong
thing. Say which object gets which colour, and use spatial words when two of the
same object exist ("the _left_ chair in #…").

**Keep the palette to 3–5 colours.** More than that and the model starts mixing
them. For a defined scheme, state it as a small named palette up front:

    Palette: #2ECC71 (emerald), #3498DB (sky blue), #F1C40F (sunflower), #FFFFFF (white)

**Gradients** take a start and end colour: _"gradient from #FF6B6B (coral) at the
horizon to #87CEEB (sky blue) at the top."_

When a colour still comes out wrong: add the name if it's missing, name the
exact object, cut the total number of colours, or emphasise with _"maintaining
exact colour #XXXXXX."_ Colours also shift under coloured light — pin the
lighting neutral if the hex has to stay true.

## Rendered text

Getting the model to spell a specific string is its own discipline. The rules,
in rough order of leverage:

1. **Quote the exact string.** `a poster reading "FRESH BREAD"`, never
   `a poster reading FRESH BREAD`. genzen's `enhance-prompt.md` already does this;
   the rest of this list is what it doesn't yet say.
2. **Front-load it.** Text described early in the prompt renders more reliably
   than text mentioned at the end. _"A sign reading 'OPEN' in a window…"_ beats
   _"A window with a sign that says 'OPEN'."_
3. **Keep it short.** One to four words is the reliable zone. Long strings
   misspell — the failure rate climbs with length, and common words beat coined
   ones.
4. **Name the font family, not "a nice font."** "bold geometric sans-serif,"
   "elegant cursive script," "classic serif," "monospace terminal," "distressed
   vintage display." Vague font requests get vague fonts.
5. **State size hierarchy and placement** when there's more than one string:
   _"large headline 'SUMMER FEST' above smaller 'JULY 15–17', both centred."_

Text can carry effects (neon, metallic/3D, embossed, outline, gradient fill —
gradient text combines with the hex rule above), but effects are secondary to
getting the spelling right; add them once the string lands.

When text misspells or won't appear: shorten it, put it in quotes, front-load
it, raise the contrast against its background, and reduce the rest of the
prompt's complexity so the model has attention to spare for the letters.

## How this maps to genzen / opportunities

- **Model choice decides whether text is even possible.** The lineup is split:
  z-image turbo renders English _and_ Chinese accurately (its
  [`guide-z-image-turbo.md`](../../src/lib/prompts/guide-z-image-turbo.md) says
  so), FLUX.2 is strong on typography, and others are weak or (on the video
  side) cannot render readable text at all. A title-card or signage request
  routed to a weak-text model fails for a reason the user can't see — the picker
  `description` or the enhancer could steer text-heavy briefs toward the models
  that can spell.
- **`enhance-prompt.md` has the quote rule but not the rest.**
  [`enhance-prompt.md`](../../src/lib/prompts/enhance-prompt.md) already tells
  the model to quote in-image text. Front-loading, the 1–4-word reliability
  zone, and naming a font family are the additions that would raise text hit-rate
  — small edits to an instruction that already exists.
- **Hex prompting ties directly to the theme feature.** genzen's
  [`theme`](../../src/features/theme/CLAUDE.md) already holds six user-chosen
  colours as the app's palette. Those are hex codes the user has already picked —
  a "generate in my palette" affordance could inject them into the prompt using
  exactly the pair-with-a-name, bind-to-an-object rules above, turning an
  existing setting into a generation control.
- **Both are precision knobs, and belong wherever brand/spec work is surfaced.**
  If genzen ever grows a "match this brand" or "exact colours" mode, these two
  techniques are its prompt-side implementation.
  </content>
