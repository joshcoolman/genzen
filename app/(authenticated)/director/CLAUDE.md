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
- Keep the two-player boundary behavior. Appending or replacing a clip must
  not reload the currently playing element. Playback remains muted.
- Drafts debounce to the server with a browser backup; cut revisions and draft
  comparisons reject stale writes. Never report a failed save as successful.
