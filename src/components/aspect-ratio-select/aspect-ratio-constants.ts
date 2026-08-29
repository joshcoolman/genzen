export const LANDSCAPE_RATIOS = ['16:9', '2:1', '3:2', '4:3', '21:9', '1:1']
export const PORTRAIT_RATIOS = ['9:16', '1:2', '2:3', '3:4', '1:1']

export const FLIP_MAP: Record<string, string> = {
  '16:9': '9:16',
  '2:1': '1:2',
  '3:2': '2:3',
  '4:3': '3:4',
  '21:9': '9:16',
  '9:16': '16:9',
  '1:2': '2:1',
  '2:3': '3:2',
  '3:4': '4:3',
  '1:1': '1:1',
}

export function getRatioOptions(orientation: 'landscape' | 'portrait') {
  return orientation === 'landscape' ? LANDSCAPE_RATIOS : PORTRAIT_RATIOS
}

export function flipOrientation(
  orientation: 'landscape' | 'portrait',
  aspectRatio: string,
): { orientation: 'landscape' | 'portrait'; aspectRatio: string } {
  const next = orientation === 'landscape' ? 'portrait' : 'landscape'
  return {
    orientation: next,
    aspectRatio:
      FLIP_MAP[aspectRatio] ?? (next === 'landscape' ? '16:9' : '9:16'),
  }
}

/**
 * Every ratio the app offers, in reading order, with its group heading.
 *
 * The picker's list and Outpaint's grid are the same catalogue seen two ways,
 * so it lives here rather than inside either of them -- a ratio added for one
 * surface and missing from the other is the drift this prevents.
 */
export const ALL_RATIOS: Array<{
  label: string
  w: number
  h: number
  group: 'Landscape' | 'Square' | 'Portrait'
}> = [
  { label: '16:9', w: 16, h: 9, group: 'Landscape' },
  { label: '2:1', w: 2, h: 1, group: 'Landscape' },
  { label: '3:2', w: 3, h: 2, group: 'Landscape' },
  { label: '4:3', w: 4, h: 3, group: 'Landscape' },
  { label: '21:9', w: 21, h: 9, group: 'Landscape' },
  { label: '5:4', w: 5, h: 4, group: 'Landscape' },
  { label: '1:1', w: 1, h: 1, group: 'Square' },
  { label: '4:5', w: 4, h: 5, group: 'Portrait' },
  { label: '3:4', w: 3, h: 4, group: 'Portrait' },
  { label: '2:3', w: 2, h: 3, group: 'Portrait' },
  { label: '9:16', w: 9, h: 16, group: 'Portrait' },
  { label: '1:2', w: 1, h: 2, group: 'Portrait' },
]

/**
 * Which catalogue ratio a picture already is, or null if it is none of them.
 *
 * Outpaint greys out the shape you have, so this has to be forgiving: a 400px
 * thumbnail of a 1920x1080 still measures 400x225, which is 1.7778 either way,
 * but a 1536x1024 "16:9" generation is really 3:2 and must not be reported as
 * 16:9. Two percent is wide enough for rounding and narrow enough to keep 3:2
 * (1.5) and 16:9 (1.78) apart.
 */
export function matchRatio(width: number, height: number): string | null {
  if (!width || !height) return null
  const value = width / height
  let best: { label: string; error: number } | null = null
  for (const r of ALL_RATIOS) {
    const error = Math.abs(r.w / r.h - value) / value
    if (!best || error < best.error) best = { label: r.label, error }
  }
  return best && best.error <= 0.02 ? best.label : null
}
