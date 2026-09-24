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

/** `0:07.3` -- tenths, because a trim is judged at that grain. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe - minutes * 60
  const [whole, tenth] = rest.toFixed(1).split('.')
  return `${minutes}:${whole.padStart(2, '0')}.${tenth}`
}
