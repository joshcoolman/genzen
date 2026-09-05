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
- Redo replaces only the latest section, using its original starting point.
  No take history or earlier-section editing. Exports are immutable snapshots.
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
- All finishing assets carry director_media.final_cut_id. Never use those IDs
  as rough-cut or source-export assets. Session/export deletion is guarded while
  a job or worker lease is active; delete bytes before cascading metadata.
