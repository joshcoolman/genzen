# Director

A session is a **name and an ordered list of clip ids** (#662). Nothing else.

- `/director` is the session list; `/director/[id]` is the workspace. The old
  Lab URL redirects here.
- The clips are ordinary `user_images` rows made by `generateVideo` and settled
  by the standard poll -- the same path Video uses. **They are not private to
  Director**: they appear on the Video wall, in Activity, and are trashed from
  there. That trade is what collapsed 10,000 lines into 700.
- Storage is `director_sessions.cut` -- `{ version: 2, clipIds: [...] }` --
  written against `revision`, which rejects a second tab's stale order. The run
  is saved on every change, one write at a time (`use-view`), and a failed save
  is said out loud rather than rolled back.
- Ids are stored unchecked. A clip generated inside the session is in the run
  before its row is visible to the request, and an id that resolves to nothing
  drops out when the session is next opened.
- Deleting a session deletes a row. The clips stay in the library.

## Chat sessions (#670)

A session started as a chat instead of a run: type a question, a character
the model invents answers it in one to three 9:16 clips. A toy, on purpose.

- **The kind is a column.** `director_sessions.chat` is null for a run and
  `{ version: 1, character, turns }` for a chat; nothing turns one into the
  other. `cut.clipIds` still holds every clip in order, so the player, the row
  and Script read a chat exactly as they read a run -- the turns only say
  which clips answer which question.
- **One Claude call per turn** (`src/lib/server/director-chat.server.ts`,
  prompt in `src/lib/prompts/director-chat.md`): Opus at low effort, adaptive
  thinking, structured output, web search capped at two uses. The character
  is invented on the first turn from the question's cue -- a sports question
  summons someone from that world -- and pinned from then on; every clip
  prompt restates the whole description, because each clip is generated on
  its own and nothing else carries the character across them. **Not fast
  mode**: the org's fast-mode limit is zero and a request carrying
  `speed: 'fast'` is refused outright, not slowed down (2026-09-15).
- **Every clip of an answer is submitted at once**, text-to-video at 9:16 on
  H3 Max Turbo, so a three-clip answer waits one clip's time. Seams are hard
  cuts. Continuity between turns is by description, not by frame, so a
  question can be asked while the last answer is still rendering.
- **Five-second bursts, played in order as they land.** The prompt asks for
  one idea per clip at five seconds, up to six; within one answer the
  setting, clothes and framing hold still so it plays as one response, and
  between answers the scene may change as long as it is the same person.
  `run.ts` takes a `ready` predicate, and a chat's is the prefix rule: a clip
  is playable once it and every clip before it in its answer have settled,
  so bursts landing out of order are heard in order. The stage starts on the
  first clip and, when it runs out of ready clips mid-answer, waits on the
  last frame and continues when the next one lands (`starved` in the
  player). It never rejoins clip 1 on its own: the player's
  `loop` prop is off for a chat, so the stage stops on the answer's last
  frame like a person stops talking; a Loop button beside Mute (shown only
  when the caller passes `onLoopChange`) turns the run's behaviour back on.
  The row still shows each clip as it lands, which is how you watch the
  answer being built. While you wait, the panel cycles a word -- musing,
  distilling -- that says the character is working and nothing about what it
  will say.
- **Locked down, on purpose**: all you can do in a chat is chat. No Add
  clips, Add gen, drag, pencil or Remove, no model or duration controls --
  the model, the ratio and the lengths are fixed server-side. Script stays
  because it only reads. The chat box sits under the player, so the stage is
  capped at 45vh there (`stageMax`) to keep the box on screen.
- **A chat opens unnamed.** New chat skips the name dialog and lands on an
  intro; the model returns a `title` with every answer and the first turn's
  is written as the session name (`appendChatTurn`). The heading's pencil
  still renames it after.
- **The conversation is stored, not shown.** The panel is the intro, then a
  question box and a "making the answer" line; the words are behind a
  Transcript button that opens Script's read-only, copyable box under another
  title. The character's description is printed nowhere.
- Missing Anthropic key: the ask fails through `useReportError`, which opens
  the key dialog.

## The workspace

This is Sequence's workspace (#660), moved out of the lab whole -- the two-video
player, Sound, the tile row, Add clips / Add gen, and the pencil (Name +
Regenerate, a middle clip pinned at both ends). `ClipPicker` and `ClipFrames`
moved to `src/components/` with it, because the app may never import from the
lab.

The player is the small column and the run the wide one: rearranging is the
work, watching is how you judge it.

## How the run works

Everything below came from Sequence (#497, #512, #655, #657, #659, #660) and is
stated here because this is where it binds now. The question the workspace
answers: **does the order cut together, and does the next one follow?** Pick
clips or generate them, drag them into order, click one to watch from there.

- **The run generates its own clips, and that is why the question grew** (#660).
  Judging an order meant leaving for Video, pressing Continue on the last clip,
  waiting, coming back and re-picking -- enough friction that the run being
  judged stopped being the thing being worked on. Add gen makes the next clip
  here: the previous clip's last frame in the first slot, removable, a prompt,
  a duration, one button. Prompt and duration open on the previous clip's, to
  be edited rather than retyped.
  - **One model, H3 Max Turbo, and no picker** -- see `[id]/gen.ts` for why,
    including why it is not plain H3: Director's speed came from an endpoint
    hardcoded in its old clip code, which was not in the lineup at all until
    #660. A continuation needs no aspect ratio either: the image endpoint has no
    such parameter and follows the frame, so a generated clip always matches the
    run. The pills appear only with no frame, which is the one case nothing else
    can answer.
  - **Nothing is rewritten before FAL.** No enhance step, no Claude call. The
    words submitted are the words typed, which is what keeps a press cheap
    enough to make casually. Director had an Enhance step and it went with the
    rest (#662).
  - **Regenerate replaces; it never deletes.** The pencil is two tabs, Name and
    Regenerate, and the second refills its form from the clip's own
    `generation_metadata` -- so nothing new is stored to make it possible. The
    clip that drops out of the run is still in Video, untouched. Re-rolls you
    did not keep accumulate there and are cleaned up by hand.
  - **A clip in the middle is pinned at both ends**, so the joins either side
    survive and the prompt is only about what happens in between. The far seam
    is **the clip's own ending frame, not the next clip's beginning** -- the
    same picture whenever the next clip was continued from this one, and the
    only one of the two already in the library, so pinning costs a query rather
    than decoding a second clip. Director answered this identically (#642). The
    last clip of a run gets no ending frame: nothing joins after it. Either
    frame can be dropped, which is how a deliberate change of ending is made.
  - **A clip being made holds its place in the row and cannot be played or
    dragged.** There is nothing behind `/img/[id]` until FAL answers, and a run
    rearranged around a picture nobody has seen is an arrangement judged blind.
    The player is given the finished clips and the row every clip, which is why
    the two are indexed separately (`toPlayableIndex`).
  - **A reference is a frame from an earlier clip, and it switches the model**
    (#665). A run drifts as soon as a clip moves away from what came before it:
    by the third clip the first character and the floor he was on are in
    neither the last frame nor the request, so "cut back to the worker" is a
    description with nothing behind it. No wording fixes that -- the picture
    that would is in an earlier clip. Add ref is two steps in this order:
    **which clip**, drawn as the run's own tiles, then which frames off that
    clip's Grab Frames sheet. You remember the clip he was in, never the frame
    id he is on. - **Frame one still holds the previous clip's ending**, so the shot
    continues from where the run is; the references are what make naming
    something that left it mean anything. They carry identity and look, not
    framing -- "tight shot" stays the prompt's job. - **Kling O3 Pro, because it is the only model taking both.** Its
    `reference-to-video` endpoint accepts `start_image_url` and `image_urls`
    on one request; Seedance 2.5's reference endpoint has no first-frame
    param at all and H3 Max Turbo has no reference endpoint. So the inputs
    choose the model, as they do on Video, and the dialog names it beside the
    price rather than offering a picker: **14c/s against 0.625c/s**, roughly
    $1.12 for an eight second clip against $0.05. Drop every reference and it
    falls back. Four is the app's cap, read off `models.ts`. - **The ratio has to be clamped, and the durations do not.** Kling's
    reference endpoint names three shapes and validates what it is sent,
    while H3 Max Turbo's pills offer 4:3, 3:4 and 21:9 -- so `clampRatio`
    brings the value back to a shape the chosen endpoint accepts. Every
    duration H3 Max Turbo offers is one Kling takes, which is why the pills
    do not move; `gen.test.ts` fails if that stops being true. - **A tile the library already holds is reused, not cut again.** Grab
    frames stamps each still with its clip and second, so a frame picked
    twice is one row -- provenance before bytes, the rule `findClipEndFrame`
    follows for a clip's ending. The tiles are `ClipFrameGrid`, shared with
    Video's Grab frames, which locks an imported tile where this one reuses
    it -- and the reuse counts **every** kind of stamp, not just Grab frames'
    own, because the closing tile is the frame Add gen already cut as a
    continuity frame on any run that appended to this clip. - **The sheet had neither end of the clip on it until this** (#665). Each
    candidate group hands back its centre frame, so it opened a third of an
    interval in and closed an interval short -- and the opening and closing
    frames are exactly the two a reference wants. `clip-frames.server.ts`
    forces the first tile to t=0 and seeks a closing one at `duration -
0.05`; Video's Grab frames gets both for free. - **Not the end-frame slot.** Pinning an appended clip to an earlier frame
    makes the model interpolate _toward_ it -- a dissolve or a slow push,
    not a cut back. A different mechanism answering a different question.
  - **The estimate is printed before the press**, as everywhere else that
    spends.

- **The stage is the run's shape.** It was a fixed 16:9 box, which drew a
  portrait run as a strip down the middle of a letterbox at a third of the
  column's width. `--stage-ratio` comes off the first finished clip; the box
  is the column's width unless that makes it taller than 70vh, then the widest
  box that height allows, centred -- so a 9:16 run stays on screen in the
  sticky column and the clip fills the box with no bars either way.
- **Script is the run's prompts, verbatim, with a blank line between.** No
  numbering, no model, no assumptions about which part of a prompt is the
  line: `script.ts` joins the descriptions and the dialog shows them in one
  read-only box with a copy button. The first cut pulled the quoted spans out
  as dialogue and was wrong about what mattered -- the prompts that make a run
  cut together are massaged by hand, and the music and the general setup are
  in there on purpose. The words exactly as they generated the clips are the
  baseline; dropping the repeated setup or keeping only the quotes verbatim is
  a later pass over this text.
- **Two `<video>` elements ping-ponging, not one swapping its `src`.** The
  visible one plays while the next loads hidden; at `ended` they swap which is on
  top. The join has to be free of a stutter, because the join is the thing being
  judged — one element reloading blanks for a beat at every boundary and the page
  would lie about the answer. The idle one is hidden with `opacity`, never
  `display` or `visibility`, either of which lets a browser stop decoding.
- **The row is the transport, and there is no bar under the player** (#655).
  Clicking a thumbnail plays the run from that clip's first frame — absolute
  where Previous/Next were relative, and aimed at the tile you are already
  looking at. The stage toggles play/pause; the run loops, so Start over is a
  click on tile 1; adding the first clip starts the run. Only Mute is left,
  because it is the one control no thumbnail click can reach. Click and drag
  need no disambiguating — a browser fires no `click` after a completed drag.
- **The run is ids, and everything else is read off the library row as it is
  now** (#659, #662) -- so a clip renamed elsewhere shows its new name, and one
  trashed from Video drops out of the run rather than sitting in it pointing at
  nothing. A restored run tries to autoplay and a browser may refuse -- nobody clicked
  and the sound is on -- so `NotAllowedError` leaves the stage stopped instead
  of showing Pause over a still picture.
- **A pencil on a tile names the clip** (#657), and the name is the clip's own
  `title` -- so a run arranged here shows up on the Video wall as "intro",
  "scene two". A name is a fact about a clip rather than about the arrangement,
  which is why it goes to `updateImageMeta` and not into the session. Written
  optimistically, and the run keeps playing behind the dialog.
- **No scrubber, still.** A `<video>`'s native bar knows only its own clip, so
  it would read 0:00-0:06 of whichever one is showing and reset at every join. A
  scrubber of our own is worse: one that spans clips needs a global timeline,
  and a global timeline is what turns this into an editor.
- **It looks like a timeline and is not one.** Equal-width tiles whatever the
  clip's length; no ruler, no playhead, no trims. The question is arrangement,
  not pacing. Proportional widths are one multiplication away —
  `duration_seconds` is already on the row — and deliberately not taken.
- **A correct order is visible before you press play.** In a Continue chain each
  clip opens on the frame the one before it ended on, so the tiles rhyme; a tile
  that does not resemble its left neighbour's ending is misplaced.
- **Each tile is two frames: what the clip opens on and what it ends on**
  (#512). One frame per clip asked you to hold the previous ending in your head,
  which is the one picture that was never on screen. With both, clip N's ending
  sits directly beside clip N+1's beginning and the cut is a thing you look at
  rather than remember. The gap between tiles is wider than the seam inside one
  on purpose — one is a cut, the other is a clip's own middle skipped, and a row
  where those read the same is a strip of frames with no joins in it.
- **The picker narrows to the run's shape, and only this asks it to.** Clips
  of different aspect ratios cannot cut together at all, so the first clip picked
  sets the shape and the dialog then offers what matches — with the count it hid
  and the way back on screen, because a run whose shape you are still choosing is
  a real state. `matchRatio` is a prop the caller passes; Frames picks one clip
  out of the library and has no run to match.
- **A jump lands on a clip and plays it.** Judging the third join by watching
  from the top is most of a minute spent on two joins already settled. It costs
  the gapless swap — the idle element is holding the clip that follows, so a jump
  anywhere else loads a fresh source and blanks for a beat. That is the right
  trade: a jump is a move _between_ cuts, never one of the cuts being judged. On
  the last clip the idle element holds clip 0, so the loop point — the join you
  see most while arranging — is gapless like the rest.
- **`lab/_components/` is what a second page wanted whole.** The clip picker
  went there when Sequence wanted the dialog Frames had; `clip-frames/` — a
  clip's first and last frame side by side — went there when the picker wanted
  what the run drew. The bar is two pages, and a copy under one page's
  `_components/` is the same thing drifting into two.

## What is gone, and why it is not coming back the same way (#662)

Final Cut, Script, exports, stitching, the private media path
(`director_media` and its routes), the pending/review protocol, Enhance, and the
Lab import. All of it was built for a way of working nobody arrived at, and
Sequence reached the same goal without any of it. Migration `0019` dropped the
tables and `scripts/purge-director.mjs` deleted the content, including the
export copies the old version of this file promised would survive.

If stitching is wanted again it starts from a run of library rows, which is a
better starting point than the one that was deleted.
