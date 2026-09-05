# Director

- Sessions and their media are Director-owned. Never insert library rows or
  group membership; Images, Video, Activity and shared Trash must not see them.
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
