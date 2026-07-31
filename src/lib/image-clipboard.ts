/**
 * Copying an image inside genzen (#213).
 *
 * The clipboard carries the **record id**, not the bytes. Both paste handlers
 * in the app already accept image bytes and turn them into a new upload -- so
 * bytes on the clipboard would mean copying an image you already own in order
 * to own a second copy of it, and the next search would find both. An id
 * resolves to the row that is already there: no upload, no new row, nothing to
 * dedupe.
 *
 * It rides on the real OS clipboard rather than a module variable so that it
 * invalidates the way a clipboard does -- copy anything else, anywhere, and the
 * marker is gone. A module variable would still be holding an image half an
 * hour after you copied a paragraph.
 *
 * The cost, and it is the whole cost: this pastes inside genzen and nowhere
 * else. Pasting into another app yields the marker text.
 */

const PREFIX = 'genzen:image:'

/** Put a reference to a library row on the clipboard. */
export async function copyImageRef(id: string): Promise<void> {
  await navigator.clipboard.writeText(`${PREFIX}${id}`)
}

/**
 * The id in a pasted string, or null if it is not one of ours.
 *
 * Takes the text rather than reading the clipboard, because a paste handler
 * already has it and `navigator.clipboard.readText()` would prompt.
 */
export function readImageRef(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith(PREFIX)) return null
  const id = trimmed.slice(PREFIX.length)
  return id.length > 0 ? id : null
}
