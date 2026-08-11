# Images

The gallery and the generator: everything you have made or uploaded, and the
panel you make the next one from.

Built to `docs/reference/route-shape.md` (#189). `page.tsx` is a server
component that runs `listGalleryImages()` and hands the rows to `view.tsx` as
`initial`; `use-view.ts` seeds from that and owns every read after it.

## Quirks

- **The highlight is the edit (#205), and the grid is the only place it
  happens.** Clicking a card toggles `selectedImageId` and hands the generator a
  source image. There is no edit mode and no edit route -- the generator already
  resolves the model's image-input endpoint from whether a source is set, so
  "edit" is a detail of building the request. The lightbox used to offer it too,
  under a pencil; #271 removed that rather than have two answers to "how do I
  set a source"
- **The lightbox is a job view, and it lives here (#271).** Image, prompt,
  filmstrip -- nothing else goes in it. It takes the list the grid renders,
  filtered to completed, so the strip and the grid can never disagree (#270).
  It sits in `_components/lightbox/` rather than `src/components/`: this route
  is its only consumer and a job view is not a generic primitive
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
- **Two localStorage namespaces.** `genzen:ai-images-prefs` holds thumb size,
  sort, info and the origin filter as one object; the generator's open and
  pinned flags are two older single-value keys. Every write-through waits on `usePersistedState`'s
  `hydrated` flag, or the fallback lands on top of the stored value on mount
- **A card says when it is on the canvas (#216).** `on_canvas` is derived per
  read with an `exists` over `canvas_images`, never stored -- the boolean column
  of that name drifted from the membership rows that are the truth and went in
  #205. The marker is passive on purpose: trashing an arranged image takes it
  off a surface you are not looking at, and saying so up front prevents the
  surprise rather than interrupting to explain it. It sits bottom-centre because
  this card pins its overlay, so all four corners are permanently occupied, and
  it never hides on hover -- a marker that vanishes as you reach for Delete
  fails at the only moment it matters
- Failed generations delete outright rather than soft-delete, so they never
  reach Trash -- see `src/features/ai-images/CLAUDE.md`

Unpinning the generator used to hide the toolbar's own controls -- `workspace`
stops being pushed, so the row spanned the full page and its right-aligned tools
landed under the floating panel. Fixed with #207: the toolbar reserves the
panel's width (`.inset`) when it is open, unpinned and not mobile. The gallery
below stays full width, which is the point of floating rather than pinning.
