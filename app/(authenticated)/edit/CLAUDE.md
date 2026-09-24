# Edit

An edit is a **name and an ordered list of trimmed clips** (#726): the clips
are Video wall rows, each with an in and an out point in seconds, and the run
plays them back to back in the browser without rendering anything. Export cuts
the same list into one mp4 on the Video wall.

- `/edit` is the list; `/edit/[id]` is the workspace. Both copied from
  Director's list and heading, which is the route to read first.
- Storage is `edits.cut` -- `{ version: 1, clips: [{ id, in, out }] }` --
  written against `revision`, one write at a time, a failed save said out loud
  rather than rolled back (`use-view`). Ids are stored unchecked and one that
  resolves to nothing drops out on the next open. One clip may be in the cut
  twice; the position is the identity.
- **Its own table, not a Director session kind.** Director is isolated (#679):
  its clips are born in a session, hidden from the wall, and trashed with it.
  An edit owns nothing -- deleting one deletes a row -- and picks from the wall.
  Director-born clips are therefore not pickable here.
- Only finished clips are offered: `page.tsx` filters `listVideos()` to
  `completed`, since a pending row has nothing behind `/img/[id]` to trim.

## This is the timeline Director's row is not

Director's CLAUDE.md declines a ruler, a playhead, proportional widths and
trims because "a global timeline is what turns this into an editor". This
route is that editor, so it takes all four, and Director stays as it is.

- **`cut.ts` is the clock.** A clip's length on the run is `out - in`; the run
  is the sum; `locate` maps a moment on the run to a clip and an offset. The
  playhead, the ruler and a scrub all go through it, and it is tested.
- **The player is Director's, plus in and out** (`cut-player/`). Same two
  `<video>` elements ping-ponging so a join costs nothing. Two additions:
  each element carries a pending seek applied on `loadedmetadata`, because a
  `currentTime` set before metadata is ignored -- the idle element is loaded,
  seeked to its `in` and left there; and the swap fires from
  `requestVideoFrameCallback` when the clip passes `out`, not from `ended`.
  `timeupdate` runs about four times a second and would overshoot a trim by
  up to a quarter second. `ended` stays as the fallback for a file shorter
  than its row says. The same callback reports the run's clock.
- **`duration_seconds` is what was asked for; the file's length is learned.**
  The player reports `loadedmetadata` durations for whichever clip an element
  holds, active or idle, and the out handle stops there. Until it is known the
  requested length is the guess, floored at the current out point.
- **Trims commit on release, and the frame follows.** A tile's two ends are
  `<video>` elements seeked by media fragment to `in` and `out - 0.05`, the way
  `MediaBox` paints a first frame. They update when the handle is let go; the
  readout on the handle says the seconds while it moves. Seeking on every
  pointer move would fetch a range per pixel.
- **The in handle keeps the tile's right edge still.** A flex tile shrinks
  from the right, so trimming the head looked like the tail moving. A margin
  the width of the trim holds the tile until release, then the run closes up.
- **The handles are `draggable` and cancel their own `dragstart`.** A
  pointerdown on a draggable tile's child starts the tile's drag; making the
  handle itself draggable means the handle's dragstart is the one that fires,
  and `preventDefault` there stops the tile lifting under a trim.
- **Reordering is Director's row, copied**: native drag and drop, a slot that
  opens in the gaps sized to the lifted tile, moved on `dragenter`. Copied
  rather than shared because the tile is a different thing here -- sized by
  time, with handles -- and a shared component would be two components with
  a flag.
- **Short tiles show frames and no words** (a container query under 180px).
  The pictures are what a cut is judged by; the title attribute keeps the
  facts.
- **Space plays and pauses, Left and Right step a frame while paused (five
  with Shift), S splits the clip under the playhead (`splitSpan` in
  `cut.ts`; the button shows only while paused, since that is the one state
  in which the playhead is a frame), Delete and Backspace remove the
  highlighted clip, and a tile click is a move, not a play button** -- the stage stays playing
  or paused as it was and lands on the clip. Window keydown like Video's
  Escape, skipped over fields, buttons and the open picker. The stage is a
  `<button>`, so Space with it focused is its own press and the listener
  leaves it alone. A frame's length is learned from the gap between two
  presented frames' media times while a clip plays -- a `<video>` does not
  say its rate and the lineup mixes 24, 25 and 30 -- and is 1/30 until then.
  Steps run on the run's clock, so a step back from a clip's first frame
  lands on the previous clip's last.
- 40px per second, fixed. A zoom is one variable away and not taken until a
  cut is long enough to want it.

## Frames (#729)

F, or Save frame, saves the frame on the stage to the library: the visible
`<video>` through `captureFrame` (canvas, exact at a paused position; a
playing stage is paused first), then `saveFileToLibrary` and a `scrub`
stamp, the path Director's Add gen takes. **The edit owns one image group,
named after it**, made on the first press and kept as `edits.group_id`. The
strip under the timeline and the group's view on Images both draw the
group's live rows, so a trash on either side is one write to one row and
there is nothing to keep in step. Renaming the edit renames the group, one
way. Deleting the edit leaves the group: stills outlive the cut.

**Generate frame (#733) makes a new still from some of the strip's.** A
click on a strip frame toggles it into a selection (ring plus tick); with
one or more selected the button appears with the count and opens a dialog:
the selection as references, a prompt, a ratio read off the run's first clip
(the nearest name in `RATIO_TO_SIZE`, changeable) and any image model with a
`withImages` endpoint -- one that cannot hold the selection is greyed, not
hidden. It is `generateImage` with `origin = 'edit'` and the frames group as
`groupId`, so the row is an ordinary member of the group with nothing marking
it. Generate closes the dialog on the press; the row is reserved before FAL
is contacted and a placeholder holds its place on the strip until the poll
settles it. The strip's rows carry `status` for that reason, and `use-view`
takes the server's rows whenever they change, keeping any this render has
not fetched yet; a failed row is said once and dropped.

## Continue (#731)

Always called Continue, whatever it fills. It acts on the highlighted clip
while paused: the first frame is that clip at its `out`, the last is the next
ready clip at its `in` -- so on the last clip it is a plain continuation and
the ending slot is empty. Both frames are read off detached `<video>`s at
the kept seconds (`captureFrameAt`) and saved into the frames group, since
they are the frames the join is judged on; an untrimmed ending reuses the
stored end frame (`findClipEndFrame`, #542). The dialog is Director's gen
form cut to this: models that take a last frame, a length, a resolution where
offered, a prompt that may be blank when both frames are set -- the fallback
line is `src/lib/prompts/edit-continue.md`, sent by `continue.action.ts`.

**Either slot can take a frame off the strip instead** (#733): the picker
under the slots lists the group's finished stills, and a pick swaps the
derived frame for one of them. That is how a frame generated here is used
here -- an ending made from the cut becomes the frame the next clip is
pinned to -- and why the ending slot is always drawn, empty when nothing
follows.

**Rerun is the same dialog loaded as the highlighted clip was made** --
frames, prompt, length, resolution and model off `generation_metadata`
(the model by its stored label; the slug is not on the row). Only a clip
made from a first frame; the new take replaces the row and the old clip
goes to Trash, as Director's re-roll does.

**Generate closes the dialog on the press.** The row is reserved before FAL
is contacted, so the id is back in about a second and a placeholder the
length asked for takes its place after the highlighted clip. From there it is
Director's mechanism: `useGenerationPoll` on the oldest pending row,
`router.refresh()`, a reconcile that swaps the server's row in by id, a
failed row leaving with a toast.

**Two clocks, because a pending row holds width the stage skips.** The
player is given `playable` -- the ready rows -- and reports an index into it
plus an offset; `time` (the readout, the keys, Split) runs over those, and
`stripSeconds` (the playhead) over every row through `toRowIndex`. A tile
click maps back through `toPlayableIndex`; a ruler press on a pending row
lands on the next ready one. All in `cut.ts`, tested.

## Export

`_lib/export.server.ts` downloads each source once, runs
`stitchTimeline` from `src/lib/server/` -- built for the old Director (#515),
unused since #662, and exactly this: per-clip in and out, one canvas, one
encode, hard cuts -- and stores the result as an ordinary `user_images` video
row with `origin = 'edit'`, the edit's name as its title, and
`generation_metadata.duration_seconds` from the stitch. It is on the Video
wall and in Trash like any clip. No Activity entry: nothing was generated and
nothing was paid for. The action is awaited in place; the button says
"Exporting..." for the seconds to minutes it takes.
