/**
 * Color Quantization
 *
 * K-means clustering in LAB color space to find dominant colors.
 * Extracts 8 hue-diverse colors for palette generation.
 */

import {
  getLabDistance,
  getVibrancy,
  labToRgb,
  rgbToHsl,
  rgbToLab,
} from './color-utils.ts'
import type { LAB, Vec3 } from './color-utils.ts'

export interface QuantizedColor {
  rgb: Vec3
  population: number
}

export interface ExtractedColor {
  rgb: Vec3
  vibrancy: number
  hue: number // 0-360
  saturation: number // 0-1
}

/**
 * Sample pixels from image data using randomized reservoir sampling
 * Each call produces different samples, creating variation in extracted colors
 *
 * @param imageData - RGBA pixel data
 * @param sampleRate - Controls target sample count (lower = more samples)
 */
export function samplePixels(
  imageData: Uint8ClampedArray,
  sampleRate = 10,
): Array<Vec3> {
  const totalPixels = imageData.length / 4
  const targetSamples = Math.floor(totalPixels / sampleRate)

  // Collect all valid (non-transparent) pixel indices
  const validIndices: Array<number> = []
  for (let i = 0; i < totalPixels; i++) {
    const a = imageData[i * 4 + 3]
    if (a >= 128) {
      validIndices.push(i)
    }
  }

  // Fisher-Yates shuffle to randomize, then take first N
  // This gives us different pixels each time
  for (let i = validIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[validIndices[i], validIndices[j]] = [validIndices[j], validIndices[i]]
  }

  const sampleCount = Math.min(targetSamples, validIndices.length)
  const sampledIndices = validIndices.slice(0, sampleCount)

  // Extract RGB values for sampled pixels
  const pixels: Array<Vec3> = []
  for (const idx of sampledIndices) {
    const base = idx * 4
    pixels.push([imageData[base], imageData[base + 1], imageData[base + 2]])
  }

  return pixels
}

/**
 * Get random initial centroids from LAB points
 * Uses shuffle approach for randomness
 */
function getRandomCentroids(points: Array<LAB>, k: number): Array<LAB> {
  // Get unique points
  const uniquePoints = Array.from(
    new Set(points.map((p) => JSON.stringify(p))),
  ).map((s) => JSON.parse(s) as LAB)

  const numUnique = uniquePoints.length

  // Handle edge case: no unique points
  if (numUnique === 0 && k > 0) {
    return Array(k)
      .fill(null)
      .map((_, index) => ({
        l: (index * 80) / (k - 1) + 10,
        a: 0,
        b: 0,
      }))
  }

  if (numUnique === 0 && k === 0) {
    return []
  }

  let centroidsToReturn: Array<LAB> = []

  if (numUnique < k) {
    // Not enough unique points, duplicate some
    centroidsToReturn = [...uniquePoints]
    for (let i = 0; i < k - numUnique; i++) {
      centroidsToReturn.push(uniquePoints[i % numUnique])
    }
    // Shuffle for randomness
    for (let i = 0; i < 3; i++) {
      centroidsToReturn.sort(() => 0.5 - Math.random())
    }
  } else {
    // Enough points, shuffle and take k
    for (let i = 0; i < 5; i++) {
      uniquePoints.sort(() => 0.5 - Math.random())
    }
    centroidsToReturn = uniquePoints.slice(0, k)
  }

  return centroidsToReturn
}

/**
 * K-means clustering in LAB color space
 *
 * LAB space is perceptually uniform, meaning Euclidean distance
 * in LAB corresponds to perceived color difference.
 */
function kMeansCluster(
  pixels: Array<Vec3>,
  numColors = 16,
  maxIterations = 20,
): Array<QuantizedColor> {
  if (pixels.length === 0) return []

  const k = Math.min(numColors, pixels.length)

  // Step 1: Convert all RGB pixels to LAB color space
  const labPixels = pixels.map(rgbToLab)

  // Step 2: Initialize random centroids in LAB space
  let centroids = getRandomCentroids(labPixels, k)

  // Handle edge case: couldn't get enough centroids
  if (centroids.length === 0 && k > 0) {
    centroids = Array(k)
      .fill(null)
      .map((_, index) => ({
        l: (index * 80) / (k - 1) + 10,
        a: 0,
        b: 0,
      }))
  }

  // Pad with defaults if needed
  if (centroids.length < k) {
    const defaultsToPad = Array(k - centroids.length)
      .fill(null)
      .map((_, index) => ({
        l: 50 + index,
        a: 0,
        b: 0,
      }))
    centroids = [...centroids, ...defaultsToPad]
  }

  // Step 3: Iterative K-means refinement
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Initialize empty clusters
    const clusters: Array<Array<LAB>> = centroids.map(() => [])

    // Assign each LAB pixel to nearest centroid (using LAB distance)
    for (const labPixel of labPixels) {
      let minDist = Infinity
      let minIndex = 0

      for (let i = 0; i < centroids.length; i++) {
        const dist = getLabDistance(labPixel, centroids[i])
        if (dist < minDist) {
          minDist = dist
          minIndex = i
        }
      }

      clusters[minIndex].push(labPixel)
    }

    // Calculate new centroids as cluster means in LAB space
    let converged = true
    const newCentroids: Array<LAB> = []

    for (let i = 0; i < centroids.length; i++) {
      const cluster = clusters[i]

      if (cluster.length === 0) {
        // Keep old centroid if cluster is empty
        newCentroids.push(centroids[i])
        continue
      }

      // Calculate mean LAB values
      const sum = cluster.reduce(
        (acc, p) => ({
          l: acc.l + p.l,
          a: acc.a + p.a,
          b: acc.b + p.b,
        }),
        { l: 0, a: 0, b: 0 },
      )

      const newCentroid: LAB = {
        l: sum.l / cluster.length,
        a: sum.a / cluster.length,
        b: sum.b / cluster.length,
      }

      // Check for convergence (centroid barely moved)
      if (getLabDistance(centroids[i], newCentroid) > 0.001) {
        converged = false
      }

      newCentroids.push(newCentroid)
    }

    centroids = newCentroids

    if (converged) break
  }

  // Step 4: Count population of each centroid
  const populations = centroids.map(() => 0)

  for (const labPixel of labPixels) {
    let minDist = Infinity
    let minIndex = 0

    for (let i = 0; i < centroids.length; i++) {
      const dist = getLabDistance(labPixel, centroids[i])
      if (dist < minDist) {
        minDist = dist
        minIndex = i
      }
    }

    populations[minIndex]++
  }

  // Step 5: Convert LAB centroids back to RGB and return sorted by population
  return centroids
    .map((lab, i) => ({
      rgb: labToRgb(lab),
      population: populations[i],
    }))
    .filter((c) => c.population > 0)
    .sort((a, b) => b.population - a.population)
}

/**
 * Calculate hue distance in degrees (0-180, accounting for circular nature)
 */
function getHueDistance(hue1: number, hue2: number): number {
  const diff = Math.abs(hue1 - hue2)
  return Math.min(diff, 360 - diff)
}

/**
 * Filter colors to ensure minimum hue diversity
 * Returns colors with at least minHueDistance degrees apart
 */
function filterByHueDiversity(
  colors: Array<QuantizedColor>,
  minHueDistance: number,
  maxColors: number,
  includeNeutrals = false,
): Array<QuantizedColor> {
  if (colors.length === 0) return []

  const selected: Array<QuantizedColor> = []
  const selectedHues: Array<number> = []

  // Sort by combined vibrancy + population score with jitter for variety
  const jitterAmount = 0.15
  const sorted = [...colors]
    .map((c) => {
      const vibrancy = getVibrancy(c.rgb)
      const jitter = 1 - jitterAmount + Math.random() * jitterAmount * 2
      return {
        ...c,
        score: vibrancy * Math.log(c.population + 1) * jitter,
      }
    })
    .sort((a, b) => b.score - a.score)

  for (const color of sorted) {
    if (selected.length >= maxColors) break

    const [h, s] = rgbToHsl(...color.rgb)
    const hue = h * 360

    // Skip very desaturated colors unless includeNeutrals is true
    if (s < 0.1 && !includeNeutrals) continue

    // Check hue distance from all selected colors
    const isFarEnough = selectedHues.every(
      (existingHue) => getHueDistance(hue, existingHue) >= minHueDistance,
    )

    if (isFarEnough || selected.length === 0) {
      selected.push(color)
      selectedHues.push(hue)
    }
  }

  return selected
}

/**
 * Convert quantized colors to extracted colors with hue/saturation info
 */
function toExtractedColors(
  colors: Array<QuantizedColor>,
): Array<ExtractedColor> {
  return colors.map((c) => {
    const [h, s] = rgbToHsl(...c.rgb)
    return {
      rgb: c.rgb,
      vibrancy: getVibrancy(c.rgb),
      hue: h * 360,
      saturation: s,
    }
  })
}

/**
 * Extract 8 hue-diverse colors from an image
 *
 * Variation is introduced through:
 * - Randomized pixel sampling (different input to K-means)
 * - Randomized hue distance threshold (25-40 deg)
 * - Jittered scoring in diversity filter
 *
 * Process:
 * 1. K-means clustering to find 20+ dominant colors
 * 2. Filter by hue diversity (~30° minimum separation)
 * 3. Pick top 8 by combined vibrancy + population score
 */
export function extractColors(
  pixels: Array<Vec3>,
  count = 8,
): Array<ExtractedColor> {
  // Default fallback colors (well-distributed hues)
  const defaultColors: Array<ExtractedColor> = [
    { rgb: [59, 130, 246], vibrancy: 0.8, hue: 217, saturation: 0.91 }, // Blue
    { rgb: [34, 197, 94], vibrancy: 0.7, hue: 142, saturation: 0.71 }, // Green
    { rgb: [249, 115, 22], vibrancy: 0.75, hue: 25, saturation: 0.95 }, // Orange
    { rgb: [168, 85, 247], vibrancy: 0.8, hue: 271, saturation: 0.91 }, // Purple
    { rgb: [236, 72, 153], vibrancy: 0.75, hue: 330, saturation: 0.81 }, // Pink
    { rgb: [14, 165, 233], vibrancy: 0.7, hue: 199, saturation: 0.89 }, // Cyan
    { rgb: [234, 179, 8], vibrancy: 0.8, hue: 45, saturation: 0.97 }, // Yellow
    { rgb: [100, 116, 139], vibrancy: 0.1, hue: 215, saturation: 0.16 }, // Neutral
  ]

  if (pixels.length === 0) {
    return defaultColors.slice(0, count)
  }

  // Step 1: K-means clustering to get more clusters for better hue variety
  const quantized = kMeansCluster(pixels, 24, 20)

  // Step 2: Filter by hue diversity
  // Randomize threshold (25-40 deg) for variation - targeting ~30° (360/8=45 ideal)
  const minHueDistance = 25 + Math.random() * 15
  const diverse = filterByHueDiversity(
    quantized,
    minHueDistance,
    count + 4,
    true,
  )

  // Step 3: Convert to extracted colors
  const extracted = toExtractedColors(diverse)

  // Ensure we have exactly the requested count
  const result = extracted.slice(0, count)

  // Fill with defaults if needed
  let defaultIdx = 0
  while (result.length < count && defaultIdx < defaultColors.length) {
    // Check if default color hue is far enough from existing
    const defColor = defaultColors[defaultIdx]
    const isFarEnough = result.every(
      (c) => getHueDistance(c.hue, defColor.hue) >= 20,
    )
    if (isFarEnough) {
      result.push(defColor)
    }
    defaultIdx++
  }

  // Final fallback - just add defaults if still short
  while (result.length < count) {
    result.push(defaultColors[result.length % defaultColors.length])
  }

  return result
}

/**
 * Extract colors by randomly sampling regions of the image
 *
 * Scattershot approach: pick random rectangular regions,
 * find the dominant color in each region. Less smart, more fun.
 */
export function extractColorsRandom(
  pixels: Array<Vec3>,
  imageWidth: number,
  count = 8,
): Array<ExtractedColor> {
  const defaultColors: Array<ExtractedColor> = [
    { rgb: [59, 130, 246], vibrancy: 0.8, hue: 217, saturation: 0.91 },
    { rgb: [34, 197, 94], vibrancy: 0.7, hue: 142, saturation: 0.71 },
    { rgb: [249, 115, 22], vibrancy: 0.75, hue: 25, saturation: 0.95 },
    { rgb: [168, 85, 247], vibrancy: 0.8, hue: 271, saturation: 0.91 },
    { rgb: [236, 72, 153], vibrancy: 0.75, hue: 330, saturation: 0.81 },
    { rgb: [14, 165, 233], vibrancy: 0.7, hue: 199, saturation: 0.89 },
    { rgb: [234, 179, 8], vibrancy: 0.8, hue: 45, saturation: 0.97 },
    { rgb: [100, 116, 139], vibrancy: 0.1, hue: 215, saturation: 0.16 },
  ]

  if (pixels.length === 0 || imageWidth <= 0) {
    return defaultColors.slice(0, count)
  }

  const imageHeight = Math.floor(pixels.length / imageWidth)
  const result: Array<ExtractedColor> = []

  // Region size: ~10x10 pixels (adjustable based on image size)
  const regionSize = Math.max(
    5,
    Math.min(20, Math.floor(Math.min(imageWidth, imageHeight) / 10)),
  )

  for (let i = 0; i < count * 3 && result.length < count; i++) {
    // Pick random position for region center
    const centerX = Math.floor(Math.random() * imageWidth)
    const centerY = Math.floor(Math.random() * imageHeight)

    // Gather pixels from the region
    const regionPixels: Array<Vec3> = []
    const halfSize = Math.floor(regionSize / 2)

    for (let dy = -halfSize; dy <= halfSize; dy++) {
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        const x = centerX + dx
        const y = centerY + dy

        if (x >= 0 && x < imageWidth && y >= 0 && y < imageHeight) {
          const idx = y * imageWidth + x
          if (idx < pixels.length) {
            regionPixels.push(pixels[idx])
          }
        }
      }
    }

    if (regionPixels.length < 5) continue

    // Find dominant color in this region using simple averaging
    // (faster than k-means for small region)
    const avgR = Math.round(
      regionPixels.reduce((s, p) => s + p[0], 0) / regionPixels.length,
    )
    const avgG = Math.round(
      regionPixels.reduce((s, p) => s + p[1], 0) / regionPixels.length,
    )
    const avgB = Math.round(
      regionPixels.reduce((s, p) => s + p[2], 0) / regionPixels.length,
    )

    const rgb: Vec3 = [avgR, avgG, avgB]
    const [h, s] = rgbToHsl(...rgb)
    const vibrancy = getVibrancy(rgb)

    // Skip if too similar to existing colors (min 15° hue distance)
    const hue = h * 360
    const isFarEnough = result.every(
      (c) => getHueDistance(c.hue, hue) >= 15 || s < 0.1,
    )

    if (isFarEnough || result.length === 0) {
      result.push({ rgb, vibrancy, hue, saturation: s })
    }
  }

  // Fill with defaults if needed
  while (result.length < count) {
    result.push(defaultColors[result.length % defaultColors.length])
  }

  return result
}

/**
 * Get RGB distance squared (for finding nearest colors)
 */
function getRgbDistanceSq(a: Vec3, b: Vec3): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

/**
 * Find the actual pixel in the image nearest to a given color
 */
function snapToNearestPixel(color: Vec3, pixels: Array<Vec3>): Vec3 {
  let nearest = pixels[0]
  let minDist = Infinity

  // Sample pixels for performance (check every 10th pixel)
  const step = Math.max(1, Math.floor(pixels.length / 5000))

  for (let i = 0; i < pixels.length; i += step) {
    const dist = getRgbDistanceSq(color, pixels[i])
    if (dist < minDist) {
      minDist = dist
      nearest = pixels[i]
    }
  }

  return nearest
}

/**
 * Simple k-means clustering on RGB values
 * Returns cluster centers
 */
function clusterColors(
  pixels: Array<Vec3>,
  k: number,
  maxIter = 15,
): Array<Vec3> {
  if (pixels.length === 0) return []
  if (pixels.length <= k) return [...pixels]

  // Initialize centroids randomly from actual pixels
  const centroids: Array<Vec3> = []
  const used = new Set<number>()
  while (centroids.length < k && centroids.length < pixels.length) {
    const idx = Math.floor(Math.random() * pixels.length)
    if (!used.has(idx)) {
      used.add(idx)
      centroids.push([...pixels[idx]] as Vec3)
    }
  }

  // Iterate
  for (let iter = 0; iter < maxIter; iter++) {
    // Assign pixels to nearest centroid
    const clusters: Array<Array<Vec3>> = centroids.map(() => [])

    for (const pixel of pixels) {
      let minDist = Infinity
      let minIdx = 0
      for (let i = 0; i < centroids.length; i++) {
        const dist = getRgbDistanceSq(pixel, centroids[i])
        if (dist < minDist) {
          minDist = dist
          minIdx = i
        }
      }
      clusters[minIdx].push(pixel)
    }

    // Update centroids to cluster means
    let converged = true
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length === 0) continue

      const newR = Math.round(
        clusters[i].reduce((s, p) => s + p[0], 0) / clusters[i].length,
      )
      const newG = Math.round(
        clusters[i].reduce((s, p) => s + p[1], 0) / clusters[i].length,
      )
      const newB = Math.round(
        clusters[i].reduce((s, p) => s + p[2], 0) / clusters[i].length,
      )

      if (
        centroids[i][0] !== newR ||
        centroids[i][1] !== newG ||
        centroids[i][2] !== newB
      ) {
        converged = false
        centroids[i] = [newR, newG, newB]
      }
    }

    if (converged) break
  }

  return centroids
}

/**
 * Extract colors by clustering actual image colors, then snapping to real pixels
 * Ensures every extracted color actually exists in the image
 */
export function extractColorsQuadrant(
  pixels: Array<Vec3>,
  _imageWidth: number,
  count = 8,
): Array<ExtractedColor> {
  const defaultColors: Array<ExtractedColor> = [
    { rgb: [59, 130, 246], vibrancy: 0.8, hue: 217, saturation: 0.91 },
    { rgb: [34, 197, 94], vibrancy: 0.7, hue: 142, saturation: 0.71 },
    { rgb: [249, 115, 22], vibrancy: 0.75, hue: 25, saturation: 0.95 },
    { rgb: [168, 85, 247], vibrancy: 0.8, hue: 271, saturation: 0.91 },
    { rgb: [236, 72, 153], vibrancy: 0.75, hue: 330, saturation: 0.81 },
    { rgb: [14, 165, 233], vibrancy: 0.7, hue: 199, saturation: 0.89 },
    { rgb: [234, 179, 8], vibrancy: 0.8, hue: 45, saturation: 0.97 },
    { rgb: [100, 116, 139], vibrancy: 0.1, hue: 215, saturation: 0.16 },
  ]

  if (pixels.length === 0) {
    return defaultColors.slice(0, count)
  }

  // Filter out very dark pixels (< 15 lightness) to avoid black dominating
  const colorfulPixels = pixels.filter((p) => {
    const [, , l] = rgbToHsl(...p)
    return l > 0.06 // ~15/255
  })

  // If too few colorful pixels, use all pixels
  const pixelsToCluster = colorfulPixels.length > 100 ? colorfulPixels : pixels

  // Cluster to find dominant colors (cluster more than needed for variety)
  const clusterCenters = clusterColors(pixelsToCluster, count + 4)

  // Snap each cluster center to an actual pixel in the image
  const snappedColors = clusterCenters.map((center) =>
    snapToNearestPixel(center, pixels),
  )

  // Convert to ExtractedColor and sort by vibrancy
  const extracted: Array<ExtractedColor> = snappedColors.map((rgb) => {
    const [h, s] = rgbToHsl(...rgb)
    return {
      rgb,
      vibrancy: getVibrancy(rgb),
      hue: h * 360,
      saturation: s,
    }
  })

  // Sort by vibrancy (most vibrant first), with some randomness
  extracted.sort(
    (a, b) =>
      b.vibrancy + Math.random() * 0.1 - (a.vibrancy + Math.random() * 0.1),
  )

  // Filter for hue diversity (at least 20° apart)
  const diverse: Array<ExtractedColor> = []
  for (const color of extracted) {
    if (diverse.length >= count) break

    const isDiverse = diverse.every((existing) => {
      const hueDiff = Math.abs(color.hue - existing.hue)
      const minDiff = Math.min(hueDiff, 360 - hueDiff)
      return (
        minDiff >= 20 || color.saturation < 0.1 || existing.saturation < 0.1
      )
    })

    if (isDiverse || diverse.length === 0) {
      diverse.push(color)
    }
  }

  // Fill with remaining extracted colors if needed (skip diversity check)
  for (const color of extracted) {
    if (diverse.length >= count) break
    if (!diverse.includes(color)) {
      diverse.push(color)
    }
  }

  // If still short, repeat what we found (never use defaults)
  // This ensures every color actually exists in the image
  if (diverse.length > 0) {
    let repeatIdx = 0
    while (diverse.length < count) {
      diverse.push(diverse[repeatIdx % diverse.length])
      repeatIdx++
    }
  }

  return diverse.slice(0, count)
}

// Legacy export for backward compatibility
export const quantize = kMeansCluster
