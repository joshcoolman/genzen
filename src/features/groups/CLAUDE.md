# Groups

A named, flat set of library rows. Membership is `user_images.group_id` --
exclusive, so a surface's top-level grid can **replace** a group's members with
its card (#319).

Promoted here from `app/(authenticated)/images/_actions/` in #517, when Video
became the second consumer. Almost nothing had to change to make that true: a
clip is a `user_images` row, so it already carried `group_id`, and not one of
the ten writes had ever filtered on `source`.

## Quirks

- **`kind` keeps two namespaces disjoint** (`'image'` / `'video'`, #517). Each
  surface reads its own, a clip cannot join an image group, and a still cannot
  join a video one. The alternative -- one pool with mixed members -- breaks
  the rule above: a mixed group would appear on both routes, each drawing only
  the half it can render, and filing a clip into an image group would take it
  off /video's top level with nothing on screen saying where it went. "Where is
  this thing" would stop having an answer, which is the question exclusive
  membership exists to keep answerable.
- **Members are matched to the group's kind by filtering the update, not by
  refusing the call.** A request naming a clip and a still files the half that
  belongs and leaves the other where it was. Nothing errors and nothing lands
  in a group that cannot draw it. `memberOf()` is the predicate; `groups.action.test.ts`
  is the proof, and its first test is the whole safety claim of the design.
- **A kind is only ever passed where one is being _created_.** The list read
  and `createImageGroup` take it; every other write names a group id, and a
  group already knows what it holds. A kind from the browser on those would be
  a second opinion for the server to disagree with.
- **The scope of a read is `{ kind }` or `{ only }`, never both.** A write names
  the exact rows it touched -- already the kind their group is -- so filtering
  those by kind could only add a way for a write to return nothing. A union
  rather than two nullable parameters, so passing both is not a state that
  exists.
- **Every write returns what it changed** (#331). A group write moves a cover, a
  count, a preview strip and a position in the grid at once; the rows are
  already in hand on the server, so the write says what happened and the client
  patches both lists from it rather than buying a second round trip.
- **A generation's group is checked at birth against the kind, in
  `create-pending-generation.server.ts`.** It derives the kind from `source`
  rather than taking one, so every caller gets it without knowing about this.
  A group that does not resolve files the row at top level rather than failing
  the generation: a wrong group is worth losing, a picture is not.
- **`listImageGroupNames` in `user-images` is a different read on purpose** --
  names only, for `ExistingImagePicker`, and image groups only, since no clip
  is ever in one.
- **The hand-set order is images-only, and it is two facts (#505).**
  `user_images.group_position` (ascending, **nulls last**) is the arrangement;
  `image_groups.manual_order` is whether it is in effect. Kept apart so
  switching back to chronological is not destructive -- the positions survive,
  and the toggle is free in both directions. Nulls last is load-bearing rather
  than incidental: it means nothing has to write a position when a row joins a
  group, on any of the three paths that put one there, and a new arrival simply
  sorts to the end. `reorderGroupImages` takes the whole ordered list and
  numbers it with `unnest ... with ordinality`, scoped to that group's members,
  so an id from elsewhere writes nothing. Deliberately **not** `sort_order`:
  that is the library's order and drives where the group card sits at top level
  (#324), so an arrangement written into it would shuffle the card every time
  the inside of the group changed. Video has no arrangement -- nothing renders
  a reorder gesture there -- but the columns and the writes are kind-agnostic
  like everything else here
- **Headless, like every feature.** The cards are the routes': `GroupCard` on
  Images, `VideoGroupCard` on Video. They are siblings rather than one
  component with a switch (#446) -- the dropdowns differ, and copying is
  cheaper than a prop that turns half of one off.
