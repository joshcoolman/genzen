import type { LibraryIndexRow } from '#/features/user-images/server/library-index.action'

export type OverlayFilter = 'all' | 'generations' | 'uploads'

/**
 * The overlay's whole search (#213): a substring, in the browser, over rows
 * already in hand. There is no query, no debounce and no index -- typing costs
 * nothing because nothing happens off-machine.
 *
 * Pure and separate from the hook because it carries the one rule that is easy
 * to get quietly wrong: an upload has no prompt, and matching only prompts
 * would make every uploaded image unfindable in the one surface whose job is
 * to hold everything.
 */
export function filterLibrary(
  rows: Array<LibraryIndexRow>,
  query: string,
  filter: OverlayFilter,
): Array<LibraryIndexRow> {
  const needle = query.trim().toLowerCase()

  return rows.filter((row) => {
    // `origin` is the surface a thing was made on (#207), and `upload` is the
    // only non-generated one -- so "generations" is everything else, and stays
    // correct if a fourth origin ever appears.
    if (filter === 'uploads' && row.origin !== 'upload') return false
    if (filter === 'generations' && row.origin === 'upload') return false
    if (!needle) return true

    return (
      row.prompt?.toLowerCase().includes(needle) ||
      row.title.toLowerCase().includes(needle)
    )
  })
}
