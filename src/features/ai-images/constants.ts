import { LANDSCAPE_RATIOS, PORTRAIT_RATIOS } from '#/components'

export {
  LANDSCAPE_RATIOS,
  PORTRAIT_RATIOS,
  FLIP_MAP,
  getRatioOptions,
  flipOrientation,
} from '#/components'

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

/**
 * How many pictures one run of variation prompts may be about (#436).
 *
 * A coverage number, not a model fact: broad enough that most image models
 * holding references can take the set, and the action that reads it writes
 * text rather than generating, so no model's real limit is under test.
 *
 * Here rather than beside that action because a `'use server'` module may
 * export nothing but async functions, and the page picking the images needs
 * the same number.
 */
export const MAX_VARIATION_IMAGES = 4
