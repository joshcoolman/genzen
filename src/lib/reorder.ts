/**
 * Move one item to an insertion point in a list (#505).
 *
 * The whole reason this is not two lines inline: **an insertion point is a
 * gap, and gaps past the item's own place shift when it is removed.** Dropping
 * the third card into the gap before index 5 has to land it at index 4, and
 * getting that wrong is a bug that only shows up when you drag rightwards --
 * the drag that goes the other way is correct either way.
 *
 * `at` is an index into the list *as it currently reads*, so a caller can take
 * it straight off a hit test without compensating for anything. Returns a new
 * array; an id the list does not hold, or a move that changes nothing, gives
 * back an equal ordering rather than throwing.
 */
export function moveTo<T>(items: Array<T>, item: T, at: number): Array<T> {
  const from = items.indexOf(item)
  if (from === -1) return [...items]

  const next = [...items]
  next.splice(from, 1)
  // The removal pulled everything after `from` down one, so a gap beyond it is
  // one too high by exactly one.
  const to = Math.max(0, Math.min(next.length, at > from ? at - 1 : at))
  next.splice(to, 0, item)
  return next
}
