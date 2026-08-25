/**
 * Naming the files inside a downloaded zip (#477).
 *
 * Its own module because the numbering is the part that was wrong and the part
 * nobody sees until the zip is already open in Finder -- so it is worth a test
 * rather than a careful read of a dialog.
 */

/** Anything the OS or a zip entry would read as structure. */
export function sanitizeFileName(name: string): string {
  return name.trim().replace(/[/\\:*?"<>|]/g, '-')
}

/** The stored name keeps the original extension; fall back to png. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot) : '.png'
}

/**
 * `image-01.png` -- one-indexed, and zero-padded to the width of the set.
 *
 * Unpadded numbering sorts `-0, -1, -10, -2` in Finder and in every other
 * lexical sort, so eleven images came out of Trash shuffled. Two digits
 * minimum, because a set of nine that grows is the same set.
 */
export function zipEntryName(
  prefix: string,
  index: number,
  total: number,
  sourceName: string,
): string {
  const width = Math.max(2, String(total).length)
  const n = String(index + 1).padStart(width, '0')
  return `${sanitizeFileName(prefix)}-${n}${extensionOf(sourceName)}`
}
