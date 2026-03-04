// Brainstorm settings
export const BRAINSTORM_DEFAULT_ROWS = 2
export const BRAINSTORM_MAX_ROWS = 6
export const BRAINSTORM_DEFAULT_IMAGES_PER_PROMPT = 1
export const BRAINSTORM_MAX_IMAGES_PER_PROMPT = 2
export const BRAINSTORM_ROW_COUNT_KEY = 'genzen:brainstorm-row-count'
export const BRAINSTORM_IMAGES_PER_PROMPT_KEY =
  'genzen:brainstorm-images-per-prompt'

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

export function detectAspectRatio(width: number, height: number): string {
  const ratio = width / height
  const all = [...LANDSCAPE_RATIOS, ...PORTRAIT_RATIOS].filter(
    (r) => r !== '1:1',
  )
  all.push('1:1')
  let best = '1:1'
  let bestDiff = Infinity
  for (const r of all) {
    const [a, b] = r.split(':').map(Number)
    const diff = Math.abs(ratio - a / b)
    if (diff < bestDiff) {
      bestDiff = diff
      best = r
    }
  }
  return best
}

export const RATIO_TO_SIZE: Record<string, { width: number; height: number }> =
  {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '2:1': { width: 2048, height: 1024 },
    '1:2': { width: 1024, height: 2048 },
    '3:2': { width: 1536, height: 1024 },
    '2:3': { width: 1024, height: 1536 },
    '4:3': { width: 1536, height: 1152 },
    '3:4': { width: 1152, height: 1536 },
    '21:9': { width: 1920, height: 823 },
    '1:1': { width: 1024, height: 1024 },
    '5:4': { width: 1280, height: 1024 },
    '4:5': { width: 1024, height: 1280 },
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
