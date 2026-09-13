# Director

- Working clips and Final Cut assets are Director-owned and private. Saved rough
  exports also publish an independent Video copy through video/server/director-exports.server.
  Video copies use normal Trash, and survive deletion of the Director original;
  deleting a Video copy neither deletes nor republishes its source. No groups
  are created. Images and Activity must not see these export copies.
- Use the existing private bucket and database. Every operation resolves auth
  on the server and filters by user_id. A media ID is not authorization.
- Save required media before publishing a cut. Revisions reject stale edits.
  Keep pending submission intent before spending and its receipt before returning.
  An uncertain submission must never automatically submit again.
- Any section can be regenerated (#643), not just the latest: pause on it and
  Edit. A replacement rolls back to that section's original starting frame and
  its preceding directions, and a **middle** section is also pinned at its far
  seam -- `end_image_url` is the replaced clip's own ending frame, which is the
  frame the next section opened from, so the join survives. The last section
  has no such frame and is free to end anywhere. Both H3 Max endpoints accept
  `end_image_url` (checked against fal's schema, 2026-09-13).
- Enhance (#643) rewrites one section's direction in the dialog, and only
  there: `_lib/enhance.server.ts` sends Claude the same two boundary frames,
  the duration and the prior directions, and returns `{ direction, fit }` --
  `fit` is one sentence when the events need more seconds than the section
  has, and empty otherwise. It writes into the box, never into a generation:
  nothing is spent and Cancel throws it away. It needs ANTHROPIC_API_KEY and
  fails loudly without one, which is the usual local state. Instructions live
  in `prompts/director-enhance.md` and must not contradict
  `director-clips.md`, which is what the generation itself is told.
- Regenerate re-rolls a section as it stands -- same direction, its own length
  snapped to an offered value -- with no dialog. It is the same paid request
  as an edit, and lands in the same review.
- There is no take history and no undo: the old clip is gone the moment a
  replacement lands. The new one loops on its own until Approve, which lets
  playback run on into the next section; Edit reopens the dialog and spends
  again. `pending.replace` is the section index; `pending.redo` is its old
  boolean spelling, kept only so a request saved before #643 still lands in
  the right place. Exports are immutable snapshots.
- Session deletion owns all its media. Keep the session record until bucket
  cleanup succeeds so deletion can be retried.
- Import preserves browser-local source data. Server-saved sessions in local
  development and Railway belong to their respective database/bucket.
- `/director` is the session list; `/director/[id]` is the workspace. The old
  Lab URL redirects here. Cards borrow Video's visual pattern, not grouping.
- Empty sessions start with Set the scene, not an empty player or section list.
  Reveal the full workspace after the first saved clip. Use persisted clip count
  for this decision so existing sessions do not flash the opening view while
  media hydrates. First-request errors and recovery remain visible.
- The workspace is two columns: the player left, the chat column right, which
  is the wider of the two because creating and navigating is the work. That
  column fills the viewport -- sections scroll, the bare setting dropdowns and
  the direction box sit at its bottom. Clicking a section jumps there and
  pauses; clicking the current one toggles play/pause without restarting it,
  and the current section is highlighted without scrolling the list.
- Keep the two-player boundary behavior. Appending or replacing a clip must
  not reload the currently playing element. Playback remains muted.
- Drafts debounce to the server with a browser backup; cut revisions and draft
  comparisons reject stale writes. Never report a failed save as successful.
- Session/Exports tabs are route-owned, not Video groups. Saving stores the
  finished silent MP4, thumbnail and selected source metadata; only its name
  can change. A save ID is idempotent, including after a lost response.
- Export saves reuse the rendered browser Blob after storage failure. Uploads
  are chunked, temporary and single-replica; completed exports survive restarts.
  Delete output files before their metadata so failed cleanup remains retryable.
- Final Cut belongs to one immutable export, never to the current session cut.
  Analyze only that export's sampled frames and accepted source directions.
  Each click creates an independent version; never replace the rough export.
- The finishing pipeline is Claude vision planning and H3 Max reference-to-video,
  assembled silently with native FFmpeg. Do not submit effects or music requests;
  strip native H3 audio too. Completed outputs remain unchanged. Legacy audio
  receipts remain recorded but do not block or participate in silent finishing.
  Keep instructions in prompts/\*.md. Anthropic uses jsonTool structured output;
  native output_format rejects our array bounds. Validate the plan before video
  spending: at most 12 shots and the source duration rounded up to 5s, capped at
  120s. Rough exports over 180s or 50 sections are rejected before any AI request.
  The planner selects strong scenes and preserves the core story and ending;
  it need not reproduce every section. Timing is enforced internally: shorten
  overlong shots in five-second steps, retaining selected coverage. One bounded
  planning correction may repair structural mistakes before any video spending.
- Final Cut runs in Next after(), with a 90s database lease renewed every 20s.
  Leaving the page does not stop it. Returning to Exports recovers queued or
  expired running jobs after a process restart; there is no separate worker.
  A run pauses after 45 minutes; Resume reuses saved receipts and assets.
- Save paid intent before submitting, use submitFalOnce (the SDK retries POST),
  then save the receipt. Uncertain planning or provider submission never retries
  automatically. A definite planning HTTP rejection can be resumed. Stop prevents
  later steps, but accepted provider work may still bill. No automatic rerolls.
- Script (#634) is a Final Cut job that stops at text: the same row, runner,
  lease and one-at-a-time rule, with `work.scriptOnly`. After the plan it
  writes one H3 multi-shot prompt per shot (`final-script.server.ts`,
  `prompts/director-script.md`), each given the previous section's text and
  the next section's direction, checkpointed per section so Resume carries
  on. `final-script.ts` holds the timing check: a section whose shot
  timestamps do not sum to its duration is repaired once, then fails loudly.
  It never uploads references or submits to FAL, needs no FAL key, and
  finishes with no output. The Exports tab lists sections with per-section
  and whole-script copy; running one is a paste into Video.
- Generate Final Cut video (#640) renders a finished Script: a new job with
  `work.fromScript`, plan and script copied in, no planning. Section 1 is
  H3 Max Turbo text-to-video at 480P; every later section is image-to-video
  from the previous clip's end frame (`FinalStep.endFrameId`), which is what
  makes the joins seamless and why it is sequential. Each clip is ingested
  as it lands and checkpointed; the request input is saved before the first
  submit so Resume replays it. Clips are stitched with their native sound
  through the lab editor's stitcher (`assembleScriptCut`), unlike the
  reference render. The dialog quotes cost and minutes before creating the
  job; a toast says when it is ready. Rate and per-section time are in
  `final-script.ts`.
- All finishing assets carry director_media.final_cut_id. Never use those IDs
  as rough-cut or source-export assets. Session/export deletion is guarded while
  a job or worker lease is active; delete bytes before cascading metadata.
