/**
 * Color Utilities
 *
 * Core color conversion and comparison functions.
 * Extracted from node-vibrant concepts with no dependencies.
 */

export type Vec3 = [number, number, number]

export interface LAB {
  l: number
  a: number
  b: number
}

/**
 * Convert hex color string to RGB tuple
 */
export function hexToRgb(hex: string): Vec3 {
  const normalized = hex.replace(/^#/, '')
  const bigint = parseInt(normalized, 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

/**
 * Convert RGB values to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
  )
}

/**
 * Convert RGB to HSL
 * Returns [h, s, l] all in range 0-1
 */
export function rgbToHsl(r: number, g: number, b: number): Vec3 {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return [0, 0, l] // achromatic
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      break
    case g:
      h = ((b - r) / d + 2) / 6
      break
    default:
      h = ((r - g) / d + 4) / 6
  }

  return [h, s, l]
}

/**
 * Convert HSL to RGB
 * Input: [h, s, l] all in range 0-1
 * Returns: [r, g, b] in range 0-255
 */
export function hslToRgb(h: number, s: number, l: number): Vec3 {
  if (s === 0) {
    const gray = Math.round(l * 255)
    return [gray, gray, gray]
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

/**
 * Convert RGB to CIE L*a*b* color space
 * Used for perceptual color difference calculation
 */
export function rgbToCIELab(r: number, g: number, b: number): Vec3 {
  // First convert to XYZ
  let rr = r / 255
  let gg = g / 255
  let bb = b / 255

  // Apply gamma correction
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92

  rr *= 100
  gg *= 100
  bb *= 100

  // Observer = 2 degrees, Illuminant = D65
  const x = rr * 0.4124 + gg * 0.3576 + bb * 0.1805
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722
  const z = rr * 0.0193 + gg * 0.1192 + bb * 0.9505

  // Reference white D65
  let xx = x / 95.047
  let yy = y / 100.0
  let zz = z / 108.883

  const pivot = (n: number): number =>
    n > 0.008856 ? Math.pow(n, 1 / 3) : 7.787 * n + 16 / 116

  xx = pivot(xx)
  yy = pivot(yy)
  zz = pivot(zz)

  const L = 116 * yy - 16
  const a = 500 * (xx - yy)
  const bStar = 200 * (yy - zz)

  return [L, a, bStar]
}

/**
 * Convert RGB to LAB object format
 * Used for K-means clustering in perceptually uniform space
 */
export function rgbToLab(rgb: Vec3): LAB {
  const [L, a, b] = rgbToCIELab(...rgb)
  return { l: L, a, b }
}

/**
 * Convert LAB to RGB color space
 *
 * Process:
 * 1. Transform LAB to XYZ color space
 * 2. Apply D65 white point
 * 3. Transform XYZ to linear RGB
 * 4. Apply inverse gamma correction (linear RGB → sRGB)
 * 5. Clamp to valid RGB range
 */
export function labToRgb(lab: LAB): Vec3 {
  // Step 1: LAB → XYZ transformation
  let y = (lab.l + 16) / 116
  let x = lab.a / 500 + y
  let z = y - lab.b / 200

  // Reverse the threshold transformation
  x = Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787
  y = Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787
  z = Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787

  // Step 2: Apply D65 white point
  x = x * 0.95047
  y = y * 1.0
  z = z * 1.08883

  // Step 3: XYZ → linear RGB (inverse of RGB → XYZ matrix)
  let red = x * 3.2406 + y * -1.5372 + z * -0.4986
  let green = x * -0.9689 + y * 1.8758 + z * 0.0415
  let blue = x * 0.0557 + y * -0.204 + z * 1.057

  // Step 4: Inverse gamma correction (linear RGB → sRGB)
  red = red > 0.0031308 ? 1.055 * Math.pow(red, 1 / 2.4) - 0.055 : 12.92 * red
  green =
    green > 0.0031308 ? 1.055 * Math.pow(green, 1 / 2.4) - 0.055 : 12.92 * green
  blue =
    blue > 0.0031308 ? 1.055 * Math.pow(blue, 1 / 2.4) - 0.055 : 12.92 * blue

  // Step 5: Clamp to valid RGB range and convert to 0-255
  return [
    Math.max(0, Math.min(255, Math.round(red * 255))),
    Math.max(0, Math.min(255, Math.round(green * 255))),
    Math.max(0, Math.min(255, Math.round(blue * 255))),
  ]
}

/**
 * Calculate Euclidean distance between two colors in LAB space
 *
 * In LAB space, Euclidean distance corresponds to perceptual difference.
 * This makes it ideal for clustering algorithms and color comparison.
 */
export function getLabDistance(lab1: LAB, lab2: LAB): number {
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
      Math.pow(lab1.a - lab2.a, 2) +
      Math.pow(lab1.b - lab2.b, 2),
  )
}

/**
 * Calculate CIE94 color difference between two Lab colors
 * Returns a value where:
 * - < 1: not perceptible by human eyes
 * - 1-2: close observation needed
 * - 2-10: noticeable at a glance
 * - 11-49: colors are more similar than opposite
 * - 100: colors are exactly opposite
 */
export function deltaE94(lab1: Vec3, lab2: Vec3): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2

  const deltaL = L1 - L2
  const deltaA = a1 - a2
  const deltaB = b1 - b2

  const c1 = Math.sqrt(a1 * a1 + b1 * b1)
  const c2 = Math.sqrt(a2 * a2 + b2 * b2)
  const deltaC = c1 - c2

  let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH)

  const kL = 1
  const kC = 1
  const kH = 1
  const k1 = 0.045
  const k2 = 0.015

  const sL = 1
  const sC = 1 + k1 * c1
  const sH = 1 + k2 * c1

  const v1 = deltaL / (kL * sL)
  const v2 = deltaC / (kC * sC)
  const v3 = deltaH / (kH * sH)

  return Math.sqrt(v1 * v1 + v2 * v2 + v3 * v3)
}

/**
 * Check if two colors are perceptually similar
 * threshold ~10 means colors are noticeably different at a glance
 */
export function areColorsSimilar(
  rgb1: Vec3,
  rgb2: Vec3,
  threshold = 10,
): boolean {
  const lab1 = rgbToCIELab(...rgb1)
  const lab2 = rgbToCIELab(...rgb2)
  return deltaE94(lab1, lab2) < threshold
}

/**
 * Calculate vibrancy score for a color
 * High saturation + mid lightness = most vibrant
 * Returns value 0-1
 */
export function getVibrancy(rgb: Vec3): number {
  const [, s, l] = rgbToHsl(...rgb)
  // Penalize colors too dark or too light
  const lightnessFactor = 1 - Math.abs(l - 0.5) * 2
  return s * Math.max(0, lightnessFactor)
}

/**
 * Check if color is too dark or too light to be useful
 */
export function isColorUsable(rgb: Vec3): boolean {
  const [, , l] = rgbToHsl(...rgb)
  return l >= 0.15 && l <= 0.85
}
