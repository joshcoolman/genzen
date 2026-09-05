# Director

- Generate individual clips only on Send or Redo, through the shared FAL client.
  Playback, polling and restore never submit a new paid request.
- Access is development-only. Signed receipts bind provider request IDs and the
  model to the authenticated user; never accept arbitrary result URLs.
- Continue uses the cut's ending frame, not the player's current position.
  Redo uses the preceding section's ending (or the original opening image) and
  excludes the rejected prompt from context. Replace only after successful save.
- Keep two video elements. Appending or replacing never reloads the active
  element; it finishes before the updated cut takes over at a boundary.
- Playback is always muted. Do not claim audio generation is disabled: the
  clip endpoints expose no audio-off parameter.
- Persist clips, ending frames and the pending receipt atomically. A missing
  receipt after interruption is an uncertain submission, not permission to retry.
  Only one editing tab owns a local cut; drafts and media are account-scoped.
- Preserve legacy recordings on migration. An imported recording is one section,
  not reconstructed provider chunks; it can continue but cannot be redone.
- Clear requires confirmation and an empty-cut tombstone, preventing re-import.
  These browser-local assets are not library masters; do not call download Wrap.
