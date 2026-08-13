# Images

The gallery and the generator: everything you have made or uploaded, and the
panel you make the next one from.

Built to `docs/reference/route-shape.md` (#189). `page.tsx` is a server
component that runs `listGalleryImages()` and hands the rows to `view.tsx` as
`initial`; `use-view.ts` seeds from that and owns every read after it.

## Quirks

- **The card has two icons, and a click opens the in-place preview.** `...` and
  Delete on the image, the model in its bottom-right corner; the whole prompt
  under it, being its own copy button. The model sat at the top of the caption
  until it read as a title for the prompt -- it names what made the picture, so
  it lives on the picture. The click opened the lightbox until the preview
  took it -- see the Experiment bullet below. The expand icon went (the click
  does that), the
  select circle went (select mode does), and the source highlight went -- the
  grid used to point the generator at an image on click, which is a hidden
  piece of state for the most obvious gesture on the page. **The prompt clamps
  to three lines and does not expand**: three is enough to recognise a prompt,
  the click copies all of it regardless, and Activity shows it entire.
  Unclamped (#284) a long prompt gave its card twice the height of its
  neighbours for text nobody read past line three. Hiding the caption entirely
  is still the info toggle's job
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
  Not buttons, deliberately: **Cmd-click a card adds that image to the set,
  Cmd-click its prompt loads that text** -- and nothing else in the panel
  moves. One image modifier, not two: Cmd-click used to replace slot 0 and
  Cmd-Shift-click push onto the rest, which distinguished nothing once the
  source slot was gone and made the wrong one the default -- clicking three
  cards left one image. The push goes on the _front_ and evicts the last
  (`pushRef` in
  `src/features/ai-images/ref-images.ts`, which is unit-tested), the opposite
  end from `addRefImages`: the gesture means "use this one", so a full set has
  to make room rather than refuse. Only the eviction toasts -- gaining an image
  is its own feedback, losing one is not. At capacity 1 every click evicts,
  which is correct, and is why a single-image model hides a wrong binding here.
  **Neither shortcut names itself any more, and the card says nothing on
  hover.** They used to: "Add" over the image while Cmd was held, "Load Prompt"
  in place of the prompt's "Copy". Both went -- a two-word hover is the wrong
  surface for teaching a gesture, and it charged every ordinary hover for a
  feature most of them will not use. The gestures still work; explaining them
  is **#289**'s job, in a surface that can carry the explanation. Until it
  lands they are undiscoverable by design, which is a decision and not an
  oversight. `CopyText`'s `silent` prop is what turns the hint off; the
  "Copied" tick survives it, because it reports rather than instructs. Both
  open the panel, because a power move whose
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
- **A click opens the preview, and the lightbox moved out.** The click used to
  open the lightbox here, and it felt disorienting for a reason that took a
  while to name: an overlay that covers everything costs nothing while
  _browsing_ and buries your work while _working_. So browsing got its own
  route, `/explore`, and the lightbox went with it. What the click does here is
  `_components/experiment/` -- the grid area, and only the grid area, becomes
  one large image. Toolbar stays, no scrim, no animation. The outer quarters of
  the panel step (a chevron appears only once the pointer is in one), the middle
  half closes, arrow keys page, Escape leaves. It covers the grid rather than
  replacing it, so scroll position survives, and it is positioned by a
  `ResizeObserver` rather than CSS because the sidebar and the dock both move
  its edges
- **The lightbox is a job view, and Explore owns it now (#271).** Image, prompt,
  filmstrip -- nothing else goes in it. It takes the list the grid renders,
  filtered to completed, so the strip and the grid can never disagree (#270).
  It still sits in `_components/lightbox/` and `/explore` imports it from here;
  that is a borrowed dependency, not a home. Two consumers means it has earned
  `src/components/`, and the move is deliberately not done yet -- see
  `app/(authenticated)/explore/CLAUDE.md`. `onOpen` is still threaded from
  `use-view` down to the card as the unwired seam. **A click
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
- **`on_canvas` is still derived, and no longer shown.** It comes per read from
  an `exists` over `canvas_images`, never stored -- the boolean column of that
  name drifted from the membership rows that are the truth and went in #205.
  The card carried an "On canvas" marker for it (#216, so trashing an arranged
  image was not a surprise); the marker went, on the grounds that the card is
  crowded and the warning was not paying for its space. The read is left in
  place because it is a cheap subquery and the fact is still true -- the seam
  to show it again, here or in Trash's link badge, is `SavedAiImage.on_canvas`
- **A group is this view with a filter, and that is the whole constraint
  (#319).** `?group=<id>` -- same `view.tsx`, same toolbar, same cards. Not a
  route segment and not a component of its own, because #204's grouping died
  from exactly one small permission: that the group view could look different.
  A second panel followed, then a second selection state, then two sidebars.
  The test for anything proposed here: **does it only make sense inside a
  group?** Then it is the same mistake -- editing, comparing and promoting a
  hero image belong to images, not to groups. Two mechanisms only: membership
  (`user_images.group_id`, exclusive) and an active scope (the filter, plus
  `groupId` on every generation submitted while one is open). Top level shows
  **group cards in place of their members** -- if members also appeared loose
  the wall would be as tall as before, which is the entire payoff. Exclusive
  membership is a column rather than a join table for that reason: two groups
  would make an image vanish from top level twice. **There is no origin
  filtering inside a group** -- the group is already the scope. Groups do not
  nest. `_actions/groups.action.ts` owns the writes, `_hooks/use-groups.ts`
  re-reads after each one rather than patching four derived fields locally
- **The group card never asks for a cover, and Add to group is never a
  submenu.** Both are the same lesson: the previous grouping was abandoned
  because creating one was a chore. Creation asks for a name and nothing else;
  the cover is the newest member, frozen, overridable from an image's own `...`
  and falling back to the newest remaining member when it is trashed. `Add to
group` opens a dialog because a flyout of names commits you to picking one at
  the moment you are most likely to notice the group you wanted does not exist
  -- the dialog has a Cancel and offers `New group...` in the same list, and
  skips straight to naming when there are no groups yet. The card carries no
  "Group" label: the swatch strip reads as texture at a glance, a label is text
  to parse
- **Trashing clears `group_id`, on all three soft-delete paths.** Restore has
  one destination, always. Restoring into a remembered group sounds tidier and
  fails worse -- the image is not where you look for it and nothing on screen
  says why, so it reads as a failed restore. Consequence: a trashed image is
  already not a member, so no group read filters `deleted_at`. The group card's
  own delete icon asks first and then trashes the members, which is safe to
  offer only because Trash is the way back; `Ungroup` is the twin that keeps
  every picture -- named that rather than "Dissolve", which sounds like the
  images go with it
- Failed generations delete outright rather than soft-delete, so they never
  reach Trash -- see `src/features/ai-images/CLAUDE.md`

**The generator does not float.** It is open, pushing the gallery over, or it
is closed. Unpinning bought the gallery back 20rem while covering the right-hand
column of thumbnails with the panel, so the images it revealed were the ones it
hid -- and it cost a dismiss layer plus `.inset` padding on the toolbar, which
existed only so the tools were not underneath it (#207). The X is the way to get
the space back.
