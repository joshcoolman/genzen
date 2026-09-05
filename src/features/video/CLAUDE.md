The video lineup: three FAL models, their endpoints, and what each endpoint
takes, plus pulling a still frame out of a clip. Headless -- no `.tsx` here.

`models.ts` was `app/(authenticated)/video/models.ts` until #398, which is when
it earned a second consumer: Activity has to name and filter the clips it can
finally see. Its own doc predicted the promotion. **The route is still where
video is built** -- `app/(authenticated)/video/CLAUDE.md` holds every decision
about the form, the picker and the card; this folder holds only the catalog.

## Key Files

- `server/director-exports.server.ts` -- publishes saved Director rough exports
  as independently owned Video assets, also consumed by Director saves. Opening
  Video/Frames backfills missing publications. A publication tombstone prevents
  resurrection after Video deletion; originals and copies have independent names
  and deletion lifecycles. `origin = director` excludes copies from generation
  Activity and account spend counts. Working/Final Cut assets never publish.
- `models.ts` -- `VIDEO_MODELS`, `endpointFor`, `aspectRatiosFor`,
  `estimateCostCents`, and the row-facing helpers below
- `models.test.ts` -- pins every endpoint id and param name against FAL's
  OpenAPI spec, which was read by hand. A wrong id fails at FAL, not here
- `frame-capture.ts` -- `captureFrame` (a mounted player's current frame) and
  `captureLastFrame` (a clip's end, from its URL). Browser-only, because the
  frame being asked for is the one on screen. Since #499 the server can decode
  video, which makes `captureLastFrame`'s imprecision a choice rather than a
  limit -- see the note below
- `clip-facts.ts` -- `aspectRatio`, `aspectLabel`, `sameAspect` and `clipFacts`:
  what a clip says about itself, and whether two of them are the same shape. It
  takes a structural `ClipShape`, not the route's `VideoRecord`, because nothing
  here may import from `app/`
- `server/stamp-frame.action.ts` -- writes `frame_source` into the frame's
  `generation_metadata`, so a still knows which clip it was cut from, and
  whether it is that clip's end (`kind: 'end'`) or a position someone scrubbed
  to (`kind: 'scrub'`)
- `server/find-clip-end-frame.action.ts` -- reads it back: the library row
  already holding a clip's end frame, so Continue reuses one instead of
  extracting a second identical PNG (#542). Provenance rather than
  `file_hash`, which no query has ever used and which browser PNG encoding
  makes unreliable across machines

**`clip-facts.ts` arrived the same way**: it was `lab/_components/clip-facts.ts`,
shared between the lab's picker and its run, until the Video card wanted a
clip's shape on it. A route reaching into `lab/` for that would run the
dependency backwards.

**Frame capture arrived the same way `models.ts` did** (#494): it lived in
`lab/frames/use-view.ts` until Video's Continue wanted it, and a mechanism two
surfaces share cannot sit under `lab/` -- the app may never import from the lab.

**`captureLastFrame` lands _near_ the end, not provably on the last sample.**
Seeking to exactly `duration` decodes nothing, so it seeks 0.05s short, and a
browser may still snap to the nearest keyframe. For continuing a sequence that
is the same frame to the eye; anything needing the exact final sample needs
something else.

## Quirks

- **A mode is an endpoint, and an endpoint is a descriptor rather than an id**
  (#385). The models disagree about more than their names -- Flux 3 puts
  first+last frame on a separate endpoint that calls the first frame
  `start_image_url`, H3's image endpoint has no `aspect_ratio` at all. Each
  endpoint carries `firstFrameParam`, `acceptsEndImage` and its own
  `aspectRatios`, and the submit builds its input from that.
- **An empty `aspectRatios` means there is no control**, not that no ratio
  works.
- **One model is two or three endpoint ids in the data.** A row's
  `generation_metadata.model` is the endpoint it was submitted to, so anything
  reasoning about rows by model expands through `videoEndpointIds`.
  `videoModelNameFor` names a row from it and returns **undefined** rather than
  the raw id, so a caller can fall back to the image lineup instead of being
  handed a string that looks like an answer.
- **`videoFilterOptions` ids are prefixed `video:`** (#398). Activity's model
  filter is one row per model, matching the picker, but the column holds
  endpoints -- so an option carries the slug and the query expands it with
  `expandVideoFilterId`. The prefix exists because the same array holds raw
  image endpoint ids alongside these.
- **A row's name is still read from the row, not from here.** The submit writes
  `model_label` and `processVideoResult` spends it. Now that this module is
  importable from `.server.ts` that is no longer forced, but it is still right:
  the label is pinned at submit time, so cutting a model from the lineup does
  not rename the clips it made.
