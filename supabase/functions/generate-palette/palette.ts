/**
 * Palette Builder
 *
 * Builds color palettes with Tailwind shade scales.
 * 8 hue-diverse colors, each with 11 shades.
 */

import { generateShadeScaleFromRgb } from './shades.ts'
import type { ShadeScale } from './shades.ts'
import type { ExtractedColor } from './quantize.ts'

export interface PaletteExport {
  colors: Array<ShadeScale>
  metadata: {
    extractionMethod: 'lab-kmeans'
    version: 3
  }
}

/**
 * Build a complete palette export from extracted colors
 */
export function buildPalette(
  extractedColors: Array<ExtractedColor>,
): PaletteExport {
  // Generate shade scales for each extracted color
  const colors = extractedColors.map((c) => generateShadeScaleFromRgb(c.rgb))

  return {
    colors,
    metadata: {
      extractionMethod: 'lab-kmeans',
      version: 3,
    },
  }
}
