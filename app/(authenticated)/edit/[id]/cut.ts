/**
 * The arithmetic of a cut: where each clip starts on the run's clock, how
 * long the run is, and which clip a moment on that clock falls in.
 *
 * A clip's length on the timeline is `out - in`, so the run's clock is the sum
 * of trimmed lengths and nothing else -- no gaps, no overlaps, no transitions.
 */
export interface Span {
  in: number
  out: number
}

export const lengthOf = (span: Span) => Math.max(0, span.out - span.in)

/** Seconds on the run's clock at which clip `index` begins. */
export function startOf(spans: Array<Span>, index: number): number {
  let seconds = 0
  for (let i = 0; i < index && i < spans.length; i++)
    seconds += lengthOf(spans[i])
  return seconds
}

export function totalSeconds(spans: Array<Span>): number {
  return startOf(spans, spans.length)
}

/**
 * The clip a moment on the run's clock falls in, and how far into that clip's
 * trimmed span it is. Past the end lands on the last clip's last moment; an
 * empty run has nowhere to land.
 */
export function locate(
  spans: Array<Span>,
  seconds: number,
): { index: number; offset: number } | null {
  if (spans.length === 0) return null
  let elapsed = 0
  for (const [index, span] of spans.entries()) {
    const length = lengthOf(span)
    if (seconds < elapsed + length) {
      return { index, offset: Math.max(0, seconds - elapsed) }
    }
    elapsed += length
  }
  const last = spans.length - 1
  return { index: last, offset: lengthOf(spans[last]) }
}

/** The shortest span a split may leave on either side. */
export const MIN_SPLIT = 0.2

/**
 * Cut one span in two at `offset` seconds into it. Null when the cut would
 * leave nothing worth keeping on a side: a split at the very edge is a
 * no-op with a phantom clip, not an edit.
 */
export function splitSpan<T extends Span>(
  span: T,
  offset: number,
): [T, T] | null {
  if (offset < MIN_SPLIT || lengthOf(span) - offset < MIN_SPLIT) return null
  const at = span.in + offset
  return [
    { ...span, out: at },
    { ...span, in: at },
  ]
}

/** `0:07.3` -- tenths, because a trim is judged at that grain. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe - minutes * 60
  const [whole, tenth] = rest.toFixed(1).split('.')
  return `${minutes}:${whole.padStart(2, '0')}.${tenth}`
}

/** A row of the cut the player can hold: a finished clip. A pending one
 *  keeps its place on the strip and is skipped by the stage (#731). */
export interface Row extends Span {
  clip: { status: string }
}

export const isReady = (row: Row) => row.clip.status === 'completed'

/** The cut as the player plays it: the ready rows, in order. */
export function playableOf<T extends Row>(rows: Array<T>): Array<T> {
  return rows.filter(isReady)
}

/** A strip position as a player position, or -1 for a row the player does
 *  not hold. Director's `toPlayableIndex`, for rows with spans. */
export function toPlayableIndex(rows: Array<Row>, rowIndex: number): number {
  const row = rows.at(rowIndex)
  if (!row || rowIndex < 0 || !isReady(row)) return -1
  let index = -1
  for (let i = 0; i <= rowIndex; i++) if (isReady(rows[i])) index++
  return index
}

/** And back, so the strip can light the tile the player is on. */
export function toRowIndex(
  rows: Array<Row>,
  playableIndex: number | null,
): number | null {
  if (playableIndex === null || playableIndex < 0) return null
  let seen = -1
  for (const [i, row] of rows.entries()) {
    if (isReady(row) && ++seen === playableIndex) return i
  }
  return null
}
