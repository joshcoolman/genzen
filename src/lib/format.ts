export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * A cost, in cents, as dollars.
 *
 * **One formatter, because there were five** (#416) — in Activity's row, its
 * detail panel, the account stats, the activity preview and the video lineup —
 * and two had already drifted. The preview had lost the `=== 0` guard, so a
 * genuinely free row read `$0.0000`; video's `formatCost` was a flat
 * `toFixed(2)`, which renders any sub-cent figure as `$0.00`. That is the exact
 * bug #400 fixed in the arithmetic, reintroduced at the last step.
 *
 * The precision ladder is the point. A compute-priced run is worth $0.0004 and
 * two decimals erase it; a $4.50 clip does not want four. So: four decimals
 * below a cent, three below a dollar, two above.
 *
 * `estimate` prefixes `~`. Every figure genzen derives itself is marked, and
 * essentially every one of them is — FAL's image results carry no cost field.
 */
export function formatCents(
  cents: number | null | undefined,
  opts: { estimate?: boolean } = {},
): string {
  if (cents == null) return '—'
  const prefix = opts.estimate ? '~' : ''
  const dollars = cents / 100
  if (dollars === 0) return `${prefix}$0.00`
  if (dollars < 0.01) return `${prefix}$${dollars.toFixed(4)}`
  if (dollars < 1) return `${prefix}$${dollars.toFixed(3)}`
  return `${prefix}$${dollars.toFixed(2)}`
}
