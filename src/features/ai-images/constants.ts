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
