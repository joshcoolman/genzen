# Images

The gallery and the generator: everything you have made or uploaded, and the
panel you make the next one from.

Built to `docs/reference/route-shape.md` (#189). `page.tsx` is a server
component that runs `listGalleryImages()` and hands the rows to `view.tsx` as
`initial`; `use-view.ts` seeds from that and owns every read after it.

## Quirks

- **The highlight is the edit (#205).** Clicking a card toggles
  `selectedImageId` and hands the generator a source image. There is no edit
  mode and no edit route -- the generator already resolves the model's
  image-input endpoint from whether a source is set, so "edit" is a detail of
  building the request
- **`initial` is a seed, not the source of truth.** `use-gallery.ts` owns the
  list after the first paint, and its 5s FAL poll is the only signal that
  anything changed -- nothing pushes (#174)
- **A paste previews, the file picker does not.** A paste is one image the user
  has in mind, so it gets a blob preview immediately; the picker takes many at
  once and previews would land in upload order, so the cards would appear to
  shuffle. Both paths are `ingest()` in `_hooks/use-uploads.ts`
- **Two localStorage namespaces.** `genzen:ai-images-prefs` holds thumb size,
  sort and info as one object; the generator's open and pinned flags are two
  older single-value keys. Every write-through waits on `usePersistedState`'s
  `hydrated` flag, or the fallback lands on top of the stored value on mount
- Failed generations delete outright rather than soft-delete, so they never
  reach Trash -- see `src/features/ai-images/CLAUDE.md`

## Known defect

Unpinning the generator hides the toolbar's own controls. `workspace` stops
being pushed, so the toolbar spans the full page and its right-aligned tools
end up under the floating panel. Predates #189 -- the same condition and the
same CSS -- and is untouched by it.
