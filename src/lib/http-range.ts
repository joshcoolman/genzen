/**
 * Parse a single-range `bytes=` header against a known size.
 *
 * Exists because a `<video>` element cannot seek unless the server answers a
 * range request -- without one it streams from byte zero and the scrub bar does
 * nothing (#305). Stills never ask, so this costs them nothing.
 *
 * Deliberately narrow: one range only, which is what every browser sends for
 * media playback. Anything else -- a multipart range, a syntactically odd
 * header, a start past the end -- returns null so the caller serves the whole
 * object. A slower correct answer beats a wrong one.
 */
export function parseRange(
  header: string | null | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!header || size <= 0) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null

  let start: number
  let end: number

  if (rawStart === '') {
    // `bytes=-500` is the *last* 500 bytes, not the first.
    const suffixLength = Number(rawEnd)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Number(rawEnd)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start < 0 || start >= size || end < start) return null

  return { start, end: Math.min(end, size - 1) }
}
