# Images

The gallery and the generator: everything you have made or uploaded, and the
panel you make the next one from.

Built to `docs/reference/route-shape.md` (#189). `page.tsx` is a server
component that runs `listGalleryImages()` and hands the rows to `view.tsx` as
`initial`; `use-view.ts` seeds from that and owns every read after it.

## Quirks

- **The card has two icons, and a click opens the lightbox (#284).** `...` and
  Delete on the image; the model name and the whole prompt under it, the prompt
  being its own copy button. The expand icon went (the click does that), the
  select circle went (select mode does), and the source highlight went -- the
  grid used to point the generator at an image on click, which is a hidden
  piece of state for the most obvious gesture on the page. The prompt is deliberately
  not clamped: uneven card heights are the known cost, being tried before a
  clamp is reached for again
- **There is no source image; there is one set (#297).** The panel holds an
  ordered set of zero to N **Reference images**, filled from the library and
  from nowhere else. Index 0 is the only asymmetry left: the aspect ratio is
  derived from it, and it is submitted first. **Upload happens in exactly one
  place, the toolbar's Upload icon**, and picking from the library in exactly
  one, the widget. The panel's own upload used to take a single file and
  silently make it the source, so "put these in my library" also repointed the
  generator with nothing saying so. The cost is that upload-and-immediately-use
  is two gestures now; `reveal()` widens the scope to wherever the file landed,
  so the second is a click rather than a hunt
- **The cap is the minimum across the selected models**, never the first one's.
  `buildFalInput` drops everything past index 0 for a model whose schema takes
  `image_url` rather than `image_urls`, so a mixed selection used to send the
  small model one image with no warning. Narrowing the selection **visibly
  trims the set** rather than truncating it at submit
- **The grid never marks the set, and reaches it only through modifiers (#284).**
  Not buttons, deliberately: **Cmd-click a card puts that image in slot 0,
  Cmd-Shift-click pushes it onto the set, Cmd-click its prompt loads that
  text** -- each replacing exactly one thing and leaving everything else in the
  panel alone. The push goes on the _front_ and evicts the last (`pushRef` in
  `src/features/ai-images/ref-images.ts`, which is unit-tested), the opposite
  end from `addRefImages`: the gesture means "use this one", so a full set has
  to make room rather than refuse. Only the eviction toasts -- gaining an image
  is its own feedback, losing one is not. The prompt's hover label says "Copy",
  and "Load Prompt" **while Cmd is actually held** -- the shortcut announces
  itself to someone reaching for it and charges nobody else for the privilege.
  The key listener is bound only while that one card is hovered, because a grid
  holds dozens. The two image gestures stay unhinted, waiting on a surface that
  can explain them (#289). Both open the panel, because a power move whose
  whole effect is inside a closed panel has no feedback -- which was #284's
  reason for refusing a card button in the first place. There is no edit
  mode and no edit route -- the generator resolves the model's image-input
  endpoint from whether the set is empty, so "edit" is a detail of building the
  request. The lightbox used to offer a source pencil too; #271 removed it
  rather than have two answers to "how do I put an image in"
- **Selection is a mode, not a circle per card (#284).** The toolbar toggle
  turns the whole card into one target. The reason is target size: the use that
  justifies selection is bulk, and per-card circles make clearing twelve of
  sixteen twelve precise clicks on a small corner. The cost is modality, paid
  for by a toggle that reads as on and by Escape always leaving -- but never
  automatically after a batch action, because "delete three, then select four
  more" is a real pattern and auto-exit silently changes what the next click
  does. Selecting attaches nothing to the next generation; it used to feed
  `setAutoRefImageIds`, so looking through images changed what the next prompt
  was built from with nothing in the panel saying so
- **The lightbox is a job view, and it lives here (#271).** Image, prompt,
  filmstrip -- nothing else goes in it. It takes the list the grid renders,
  filtered to completed, so the strip and the grid can never disagree (#270).
  It sits in `_components/lightbox/` rather than `src/components/`: this route
  is its only consumer and a job view is not a generic primitive. **A click
  anywhere that is not a control closes it** -- the image, the scrim, the empty
  space beside the prompt. Only the filmstrip and the two buttons stop the
  click, because the way this gets used is look, page a few, copy, get back to
  the grid, and a lightbox you have to aim at to leave taxes every one of those
- **`initial` is a seed, not the source of truth.** `use-gallery.ts` owns the
  list after the first paint, and its 5s FAL poll is the only signal that
  anything changed -- nothing pushes (#174)
- **A paste previews, the file picker does not.** A paste is one image the user
  has in mind, so it gets a blob preview immediately; the picker takes many at
  once and previews would land in upload order, so the cards would appear to
  shuffle. Both paths are `ingest()` in `_hooks/use-uploads.ts`
- **The gallery is scoped, and scoping is not finding (#207).** Pills filter by
  `origin`: Generations (made here) / Uploads / Canvas / All, defaulting to
  Generations because this is where you generate. Filtering is client-side --
  the route already holds every row. Making something widens the scope to where
  it landed (`reveal()` in `use-view.ts`), or the card you just created would be
  invisible in the view you made it in. Finding things is the Cmd-F overlay
  (#213), which shipped with its own All / Generations / Uploads filter; if
  these pills go untouched now, deleting them is the right outcome
- **A pasted image can be a reference rather than an upload (#213).**
  `_hooks/use-paste-reference.ts` claims the clipboard first, in the capture
  phase, when it holds one of our record ids — the image joins the generator's
  reference strip with no upload and no new row. It refuses out loud when the
  selected model takes no references, because `addRefImages` caps silently at
  `maxRefImages` and a paste that reports success and adds nothing is worse
  than one that says no. Bytes from outside still go to `use-uploads.ts`
- **Two localStorage namespaces.** `genzen:ai-images-prefs` holds sort, info
  and the origin filter as one object -- `read()` picks fields out rather than
  spreading, and `usePrefs` rewrites the key on mount, so `thumbSize` (dropped
  in #284 along with the size switcher, since large was the only size ever
  used) does not live on as a setting that appears to exist; the generator's
  open flag is an older single-value key, and its `pinned` twin is now dead
  storage that nothing reads. Every write-through waits on `usePersistedState`'s
  `hydrated` flag, or the fallback lands on top of the stored value on mount
- **A card says when it is on the canvas (#216).** `on_canvas` is derived per
  read with an `exists` over `canvas_images`, never stored -- the boolean column
  of that name drifted from the membership rows that are the truth and went in
  #205. The marker is passive on purpose: trashing an arranged image takes it
  off a surface you are not looking at, and saying so up front prevents the
  surprise rather than interrupting to explain it. It sits bottom-centre because
  this card pins its overlay, so all four corners are permanently occupied, and
  it never hides on hover -- a marker that vanishes as you reach for Delete
  fails at the only moment it matters. Two of those corners have since emptied
  (#284), but a marker is not an action and does not want one
- Failed generations delete outright rather than soft-delete, so they never
  reach Trash -- see `src/features/ai-images/CLAUDE.md`

**The generator does not float.** It is open, pushing the gallery over, or it
is closed. Unpinning bought the gallery back 20rem while covering the right-hand
column of thumbnails with the panel, so the images it revealed were the ones it
hid -- and it cost a dismiss layer plus `.inset` padding on the toolbar, which
existed only so the tools were not underneath it (#207). The X is the way to get
the space back.
