/**
 * Tailwind Shade Generation
 *
 * Generates 11-step Tailwind shade scales (50-950) from a base color.
 * Anchors at 500 (input) and 900 (derived dark), interpolates between.
 * Uses LAB color space for perceptually uniform transitions.
 */

import { hexToRgb, labToRgb, rgbToHex, rgbToLab } from './color-utils.ts'
import type { Vec3 } from './color-utils.ts'

export type ShadeKey =
  | 50
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 950

export interface ShadeScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

// Target L* values for anchor points
const L_50 = 97 // Lightest
const L_900 = 17 // Dark anchor
const L_950 = 10 // Darkest

/**
 * Interpolate between two LAB colors
 */
function lerpLab(
  from: { l: number; a: number; b: number },
  to: { l: number; a: number; b: number },
  t: number,
): { l: number; a: number; b: number } {
  return {
    l: from.l + (to.l - from.l) * t,
    a: from.a + (to.a - from.a) * t,
    b: from.b + (to.b - from.b) * t,
  }
}

/**
 * Generate a full Tailwind shade scale from a hex color
 *
 * Approach:
 * 1. 500 = exact input color (no transformation)
 * 2. 900 = derived dark (L* → 17, reduced chroma)
 * 3. 600-800 = interpolate between 500 and 900
 * 4. 50 = derived light (L* → 97, reduced chroma)
 * 5. 100-400 = interpolate between 50 and 500
 * 6. 950 = slightly darker than 900
 */
export function generateShadeScale(hex: string): ShadeScale {
  const rgb = hexToRgb(hex)
  const lab500 = rgbToLab(rgb)

  // Derive 900: dark anchor with reduced chroma
  const lab900 = {
    l: L_900,
    a: lab500.a * 0.75,
    b: lab500.b * 0.75,
  }

  // Derive 50: light anchor with heavily reduced chroma
  const lab50 = {
    l: L_50,
    a: lab500.a * 0.25,
    b: lab500.b * 0.25,
  }

  // Derive 950: darkest, even more reduced chroma
  const lab950 = {
    l: L_950,
    a: lab500.a * 0.6,
    b: lab500.b * 0.6,
  }

  // Build the scale by interpolation
  const scale: Partial<ShadeScale> = {}

  // 500 = exact input
  scale[500] = hex

  // 900 and 950 = derived anchors
  scale[900] = rgbToHex(...labToRgb(lab900))
  scale[950] = rgbToHex(...labToRgb(lab950))

  // 50 = light anchor
  scale[50] = rgbToHex(...labToRgb(lab50))

  // Interpolate 600-800 between 500 and 900
  // 600 is 1/4 of the way, 700 is 2/4, 800 is 3/4
  scale[600] = rgbToHex(...labToRgb(lerpLab(lab500, lab900, 0.25)))
  scale[700] = rgbToHex(...labToRgb(lerpLab(lab500, lab900, 0.5)))
  scale[800] = rgbToHex(...labToRgb(lerpLab(lab500, lab900, 0.75)))

  // Interpolate 100-400 between 50 and 500
  // 100 is 1/5, 200 is 2/5, 300 is 3/5, 400 is 4/5
  scale[100] = rgbToHex(...labToRgb(lerpLab(lab50, lab500, 0.2)))
  scale[200] = rgbToHex(...labToRgb(lerpLab(lab50, lab500, 0.4)))
  scale[300] = rgbToHex(...labToRgb(lerpLab(lab50, lab500, 0.6)))
  scale[400] = rgbToHex(...labToRgb(lerpLab(lab50, lab500, 0.8)))

  return scale as ShadeScale
}

/**
 * Generate shade scale from RGB values
 */
export function generateShadeScaleFromRgb(rgb: Vec3): ShadeScale {
  return generateShadeScale(rgbToHex(...rgb))
}
