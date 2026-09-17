# Director

A session is a **name and an ordered list of clip ids** (#662), and since #690
the reference sheets extracted from them, and since #695 the storyboard planned
from those. Nothing else -- and "nothing else" was literally true until
References below; the run is still the whole of the work area.

- `/director` is the session list; `/director/[id]` is the workspace. The old
  Lab URL redirects here.
- The clips are ordinary `user_images` rows made by `generateVideo` and settled
  by the standard poll -- the same path Video uses. That trade is what
  collapsed 10,000 lines into 700, and it still holds: no private table, no
  private routes. **But Director is isolated** (#679): every clip in a session
  was born there, stamped `origin = 'director'` at birth, and shown nowhere
  but its session -- `listVideos('director')` here, `listVideos()` on the
  Video wall, and no listing of both. Activity still logs them, since it is
  the cost record. A Director-born clip lives and dies with its session:
  removing it from the run trashes it, a re-roll trashes the take it
  replaced, and deleting the session trashes every clip it made. Trash
  restores any of them. The guard is the origin, not the id, so a session
  from before isolation that still holds a Video clip leaves it alone.
- Storage is `director_sessions.cut` -- `{ version: 2, clipIds: [...] }` --
  written against `revision`, which rejects a second tab's stale order. The run
  is saved on every change, one write at a time (`use-view`), and a failed save
  is said out loud rather than rolled back.
- Ids are stored unchecked. A clip generated inside the session is in the run
  before its row is visible to the request, and an id that resolves to nothing
  drops out when the session is next opened.
- Deleting a session trashes everything it made -- clips, sheets and the
  stills behind them -- then deletes the row.

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
  summons someone from that world -- and pinned from then on. **The anchors
  are prepended in code, not written by the model**: the character once per
  session, the scene once per answer, and each clip is only its action and
  line (`composeClipPrompt`). The first cut had the model restate the
  description in every clip prompt, which held the picture still and made a
  turn take fifteen seconds instead of eight. **Not fast
  mode**: the org's fast-mode limit is zero and a request carrying
  `speed: 'fast'` is refused outright, not slowed down (2026-09-15).
- **Every clip of an answer is submitted at once**, text-to-video at 9:16 on
  H3 Max Turbo, so a three-clip answer waits one clip's time. **One seed per
  session** (#687), chosen on the first turn, stored in `chat.seed` and sent
  with every burst: same noise plus near-identical prompts is the endpoint's
  one non-wording lever for a steady picture, and possibly a steady voice --
  whether the audio shares the seed is undocumented, and a session is the
  test. Seams are hard
  cuts. Continuity between turns is by description, not by frame, so a
  question can be asked while the last answer is still rendering.
- **Short bursts, played in order as they land.** The answer is written as
  speech first and cut at sentence ends, up to six bursts; **each burst's
  duration is set in code from its word count** (`durationForWords`, just
  under three words a second at the character's own pace -- the model marks
  the answer normal or quick from the voice it wrote; there is no slow,
  because a burst that drags is as wrong as one that garbles), never by the
  model -- when the model chose,
  it dealt the lineup's durations out in order and a seventeen-word line
  stretched over fifteen seconds came back as language-shaped noise; within one answer the
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
- **Locked down, mostly**: no Add gen, drag or pencil, no model or duration
  controls -- the model, the ratio and the lengths are fixed server-side.
  Script stays because it only reads. Two per-burst repairs came back in
  #688, once the bursts proved to stand on their own: **Remove** drops a
  burst from the run and its turn and trashes it (the line stays in the
  transcript -- cutting a garbled clip does not unsay it), and **Rerun**
  makes the same burst again in place on a fresh seed for that clip only,
  since the same words on the session's seed would be the same clip. The chat box sits under the player, so the stage is
  capped at 45vh there (`stageMax`) to keep the box on screen.
- **A chat opens unnamed.** New chat skips the name dialog and lands on an
  intro; the model returns a `title` with every answer and the first turn's
  is written as the session name (`appendChatTurn`). The heading's pencil
  still renames it after.
- **Questions queue and the box never locks.** `ask` appends; a drain in
  `use-view` sends them one at a time, in order, because each turn reads
  the transcript the last one wrote and the run is the conversation. The
  panel lists what is waiting. An answer landing while the previous one is
  still being said is not jumped to: it is the next clip, and the stage
  continues into it (`isPlaying` on the player handle).
- **The conversation is stored, not shown.** The panel is the intro, then a
  question box and a musing line; the words are behind the row's Script
  button, which in a chat opens the questions and answers rather than the
  clip prompts -- those are anchors plus an action, assembled in code. The
  character's description is printed nowhere.
- Missing Anthropic key: the ask fails through `useReportError`, which opens
  the key dialog.

## References (#690)

A session is a container for more than one kind of asset. Beside the work area
sit two tabs, **Characters** and **Locations**, holding 16:9 reference sheets
extracted from the session's own clips -- one per primary character or key
object, one per distinct place. Same tabs in a chat and in a run.

- **Isolated exactly as the clips are.** Every sheet and every still is born
  `origin = 'director'`, listed nowhere but its session, and trashed when the
  session is deleted -- `trashSessionClips` does all three, guarded on the
  origin rather than the ids. The two library listings outside Director,
  `listGalleryImages` and `listImages`, exclude the origin; without that a
  sheet would arrive on the Images wall and in every reference picker the
  moment it landed, which is the leak #679 closed for video.
- **Storage is `director_sessions.refs`** -- `{ version: 1, characters: [ids],
locations: [ids], frames: [ids] }`. The column is `refs` and not
  `references` because that word is reserved in Postgres. Ids of library rows,
  like `cut`: a sheet's name and whether it has finished are read off the row
  as it is now, and an id that resolves to nothing drops off the tab.
- **Everything is additive; the collection is pruned by deleting.** Extract
  adds a set, New from this adds one sheet beside the one it came from, and
  Delete is the only thing that removes. **The word is never "regenerate"** --
  nothing here replaces anything, which is why a second Extract is not a
  mistake.
- **Three steps to a sheet** (`_lib/references.server.ts`): three stills out of
  each finished clip at 20/50/80% -- not the ends, because a clip's first
  frame is usually the previous clip's ending and would be counted twice --
  then **one vision call** over them, scoped to the kind, that names the
  elements and picks the two or three stills showing each best; then one image
  generation per element with those stills as `referenceImageIds`. The model
  answers with frame _numbers_, never ids: an id is 36 characters of nothing
  for a model to hold and one wrong character is somebody else's row.
- **The stills are library rows, because `generateImageInternal` takes
  references as ids and not bytes.** They are written here rather than through
  `saveFileToLibrary` -- that path writes `origin = 'upload'`, since a paste
  authors nothing, and these are authored by Director. Stamped `frame_source`
  in the same insert, which is what lets a second extraction reuse them
  instead of decoding an identical PNG: provenance before bytes, the rule
  `findClipEndFrame` follows.
- **A sheet prompt must anchor the medium, or the model changes it** (#694).
  The first character sheet came back as a flat vector illustration off
  photoreal clips -- and the references had been sent, the endpoint was
  `/edit`, the identity transferred perfectly. The prompt threw the medium
  away on its own: "character reference sheet" is animation jargon for a model
  sheet, "drawn from the reference images" says draw, "flat lighting" says flat
  shading, and "not a shot from the film" disowns photography outright. Four
  pulls toward illustration and nothing anchoring the source. Every one of the
  three image prompts now states the rule outright -- match the references in
  medium and rendering, photographic stays photographic -- and none of them
  says "drawn". Worth re-reading before editing any of them: it cost a whole
  extraction to find.
- **Four frames per sheet, picked for coverage rather than quality** (#694).
  A sheet shows an element from several sides and can only use what the stills
  contain, so four near-identical close-ups say less than a face, a full figure
  and a different angle. The inventory instruction asks for that spread
  explicitly; before it, three frames of the same front-on framing left the
  model inventing the profile and the back view.
- **Locked down.** Nano Banana 2 alone for the extraction; a derive offers
  those three models that take references as a multi-select, where every one
  ticked is one generation. No aspect, no resolution, no enhance, no reference
  roles. 16:9 always -- an opinionated workflow sets a standard it can pivot
  from later, and a 9:16 chat shows too little of a location to judge one.
- **A tab replaces the work area's body rather than hiding it.** A hidden
  `<video>` keeps playing, and a stage talking over the tab you are reading is
  the wrong answer.
- **A sheet is drawn as an Images card, on the shared parts of one.**
  `ImageGrid` at the same size, `Thumbnail`, and `CardCaption` under it holding
  the prompt the sheet was drawn from -- so the two walls have the same
  columns, the same clamp and the same copy button. Not `ImageCard` itself:
  that is Images' own, thick with groups, select mode, the sweep and
  drag-to-group, and a tab with none of those would set twenty props to leave
  nineteen unused. **The tile is square and the sheet letterboxes in it**, as a
  wide picture does on Images. A 16:9 frame was built first -- every sheet is
  16:9, so a square one spends a quarter of the grid on nothing -- and was
  wrong beside the real wall: the letterboxed tile _is_ what the grid looks
  like, and a second grid with its own tile shape reads as a different app.
  Reading the detail is the lightbox's job. Two things do differ
  (`_components/sheet-card/`): there is **no hiding**, because this collection
  is pruned by deleting and the corner is the plain Trash; and **New from this
  is one click** in the top-left corner where Images keeps its `...`, being the
  tab's whole reason for existing.
- **Script is the run's dialogue, and only that** (#690). A third tab beside
  Work, for a chat session alone: the lines the character says, numbered by
  position in the run, and nothing else. **It reads the clips, not the
  transcript** -- a turn's stored `line` is the whole answer as written, while
  the run is what survived being pared down, so a burst removed in the work
  area drops out here and renumbers the rest. The extraction is `dialogueOf`
  in `[id]/script.ts`, matching the `Speaking to camera:` marker that
  `composeClipPrompt` ends every chat prompt with -- reading back a structure
  the app wrote, which is why it is safe here and was **not** safe in
  `scriptOf`, whose first cut pulled quoted spans out of hand-typed run
  prompts and was wrong about which parts mattered. A clip with no line to
  find keeps its number and says so, rather than vanishing and renumbering
  around a cut that did not happen.
  **The line and its duration, and nothing else, because those are what
  survive a re-run.** The test for anything proposed here is whether it holds
  when the character and the place are swapped: the dialogue does, and the
  seconds do -- they are the brief a re-run has to hit. The per-clip action
  does not (it is written around this bear's claws and backpack), and neither
  does the scene (a forest clearing is this bear's world, not the next
  character's). Both are in the prompts, cleanly separable, and deliberately
  left out. Neither is stored either -- they exist only inside the composed
  prompt -- so adding them would mean deriving the scene by common prefix
  within a turn, or storing both from then on.
  **The duration is a measurement, not a recommendation.** It is what the clip
  was generated at, and a session made before #685 carries numbers the model
  chose rather than derived -- so it says what the film is, never what these
  words should run to. #693 is the related gap.
- **Clicking a sheet opens the shared lightbox.** At grid size a turnaround
  sheet cannot be judged, which is the one thing it exists for. Director keeps
  its own cursor over the open tab's finished sheets rather than reusing
  `useImageViewer` -- see the note in `images/CLAUDE.md`: the shell is shared,
  the cursor never is. Delete from inside it moves the cursor before the row
  goes, so a pass over an extraction is a run of single presses.
- The assets are props and never state: every change ends in `router.refresh()`
  and the page re-reads the rows, which is also how a pending sheet turns into
  a picture (`use-references.ts`, on the standard poll).
- **Not `/api/reference-sheet`.** That route composites selected library images
  into one JPEG to download (#476) and shares nothing with this but a word.

## Storyboard (#695)

A fourth tab, and the first one that is neither the run nor a collection: **one
row per numbered script line**, each drawn as the frame that section opens on
and the frame it ends on, with no video generated at all. It exists because video is the
most expensive way to find out whether the sheets and the script add up to a
story -- twelve images at 8c against $38.64 for one Kling O3 Pro pass over a
276-second script, and 8c to re-roll a frame against $1.12 for the clip.

- **Success is a judgement, not a check.** If the rows read top to bottom as a
  story that is visually interesting and coherent, it worked. Deliberately not
  "the frames match the script" or "continuity is preserved" -- those are things
  you would measure, and this is a question you answer by looking. Worth knowing
  before anything here grows a validation step.
- **It appears only with a script, a character sheet and a location sheet.**
  All three are its inputs, so before them there is nothing to build from.
- **A scene is a numbered line, and nothing works out where scenes begin.** A
  line is what becomes a video section of its own stated length, so the script's
  numbering is the board's -- the same number the Script tab prints, never
  renumbered. The first cut had a model group lines into scenes of its own
  finding; that is guessing at something the script already says.
- **The model describes the frames, which is the part nothing stores.** One
  call (`_lib/storyboard.server.ts`, prompt in
  `src/lib/prompts/director-storyboard.md`) takes the whole script and the
  sheets and answers with one entry per line: its location and its two frame
  descriptions. The whole script goes in for each line's frames because the cut
  between two scenes and the drift of shot sizes down the film are what is being
  judged, and neither is visible from one line. **Numbers in, numbers out** --
  a line is a number and a sheet is a number, the inventory's rule; a line the
  model skipped simply has no frames and drops out, which reads as a board
  shorter than the script rather than as a silent renumbering.
- **The seconds are the size of the change between a pair.** Five seconds is a
  breath -- a hand rises, a head turns; twelve is a move across the room. The
  duration is on the row for that reason, and the instruction says it outright:
  without it a 5s pair and a 12s pair come back looking the same, which is the
  one thing that makes a per-line board pointless.
- **Two stages, because the second frame cannot be submitted with the first.**
  The closing frame is generated _from_ the opening one, and a reference is
  bytes out of the bucket -- there is nothing behind a pending row to upload.
  So Create storyboard submits every opening at once and the page drains the
  closings one at a time as the openings land (`scenesToClose`,
  `use-storyboard`). **The sheets ride along with both frames**: the closing one
  leads with its own opening frame and carries the same character and location
  sheets behind it (`closingReferenceIds`), because a face drawn from a copy of
  a copy drifts, and every frame of every scene should see what it is supposed
  to be of. The drain keeps a ref of what it has already asked for:
  the closing id is not on the board until the action returns and the poll
  refreshes underneath it, so without the guard a settled opening is submitted
  again, which is a second 8c frame for nothing.
- **The frames do not chain between scenes yet.** The eventual idea is a match
  cut -- scene N+1's opening derived from scene N's closing with the
  environment swapped and the character held -- which is `New from this` applied
  down a chain, and serial. Judge the cuts first; chain them once there is
  something to judge.
- **Replace, not add -- the one place this differs from the reference tabs.**
  Those are collections pruned by deleting; a storyboard is an ordered thing,
  and two plans of the same script side by side is not a storyboard. Create
  storyboard replaces the board and trashes the frames the old one made, and
  **Rerun with guidance** replaces one scene's pair and trashes it. Same
  Trash-not-delete rule a re-rolled clip follows.
- **Storage is `director_sessions.board`** -- `{ version: 1, scenes: [...] }`,
  beside `cut`, `chat` and `refs`. **The plan is stored where nothing else here
  is**: every other asset is ids because the facts are on the library row, and a
  scene's lines, its place and the two prompts are on no row anywhere. The
  frames themselves stay ids.
- **The row is large, and the two gaps are different sizes.** A pair's frames
  sit tight together and the rows sit far apart, because one is a section's own
  ends and the other is a cut -- the run's tile row learned that first (#512).
  `ClipFrames` is the visual precedent but takes a clip and squares both halves;
  these are two arbitrary rows at 16:9.
- **Nano Banana 2 for everything the board draws**, 16:9, no aspect and no
  resolution -- the sheets' lock-down, for the same reason: a sequence is judged
  as a sequence, so every frame in it has to be the same kind of picture. A
  rerun may pick one of the three reference-taking models, single choice rather
  than the derive's multi-select, because there is only ever one frame in this
  position.
- **Nothing downstream is wired to it.** No video, no stitching, no export. The
  shape is worth having because Kling O3 Pro's `reference-to-video` takes
  `start_image_url` _and_ `image_urls` on one request (#665), so an approved
  opening frame can later be the clip's literal first frame -- which makes the
  storyboard the spec rather than a preview. That is the next issue.

## The workspace

This is Sequence's workspace (#660), moved out of the lab whole -- the two-video
player, Sound, the tile row, Add gen, and the pencil (Name + Regenerate, a
middle clip pinned at both ends). `ClipPicker` and `ClipFrames` moved to
`src/components/` with it, because the app may never import from the lab.
**Add clips went in #679**: picking a clip off the Video wall was a holdover
from Sequence that was never used once the run could generate its own, and a
session whose clips can come from two places has two rules for what removing
one means. Frames still uses the picker; Director does not.

The player is the small column and the run the wide one: rearranging is the
work, watching is how you judge it.

## How the run works

Everything below came from Sequence (#497, #512, #655, #657, #659, #660) and is
stated here because this is where it binds now. The question the workspace
answers: **does the order cut together, and does the next one follow?**
Generate clips, drag them into order, click one to watch from there.

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
  - **Regenerate replaces, and trashes the take it replaced** (#679). The
    pencil is two tabs, Name and Regenerate, and the second refills its form
    from the clip's own `generation_metadata` -- so nothing new is stored to
    make it possible. Until isolation the old take stayed in Video to be
    cleaned up by hand; nothing shows it now, so it goes to Trash, where a
    re-roll you regret is one restore away.
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
- **The run's shape is set by its first clip.** Clips of different aspect
  ratios cannot cut together, and with every clip born here a continuation
  follows the frame it was given, so the shape holds on its own. The picker's
  `matchRatio` prop was Director's ask (#512) and has no caller now that
  Add clips is gone; Frames picks one clip and has no run to match.
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
