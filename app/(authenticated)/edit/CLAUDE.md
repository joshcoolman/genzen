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
- 40px per second, fixed. A zoom is one variable away and not taken until a
  cut is long enough to want it.

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
