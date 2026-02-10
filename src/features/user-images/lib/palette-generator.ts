/**
 * Client-Side Palette Generator
 *
 * Extracts colors from images using Canvas API.
 * No edge function needed - runs entirely in the browser.
 */

import type { ColorPalette, ShadeScale } from "../types";

type Vec3 = [number, number, number];

export type PaletteMode = "balanced" | "random";

/**
 * Generate a color palette from an image URL
 * @param imageUrl - URL of the image to extract colors from
 * @param mode - "balanced" for best palette, "random" for more variety
 */
export async function generatePaletteFromImage(
  imageUrl: string,
  mode: PaletteMode = "balanced"
): Promise<ColorPalette> {
  // Load image
  const img = await loadImage(imageUrl);

  // Create canvas, resize, blur, extract pixels
  const pixels = extractPixelsFromImage(img);

  // Cluster colors and snap to real pixels
  const extractedColors = extractColors(pixels, 6, mode === "random");

  // Generate shade scales
  const colors = extractedColors.map((rgb) => generateShadeScale(rgb));

  return {
    colors,
    metadata: {
      extractionMethod: "lab-kmeans",
      version: 3,
    },
  };
}

/**
 * Load an image from URL into an HTMLImageElement
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

/**
 * Extract pixels from image with resize and blur
 */
function extractPixelsFromImage(img: HTMLImageElement): Vec3[] {
  // Create canvas
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  // Resize to max 200x200 for performance
  const maxDim = 200;
  let width = img.width;
  let height = img.height;

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(img, 0, 0, width, height);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert to Vec3 array (skip transparent pixels)
  const pixels: Vec3[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a >= 128) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  return pixels;
}

/**
 * RGB distance squared
 */
function rgbDistanceSq(a: Vec3, b: Vec3): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * RGB to HSL conversion
 * Returns [h, s, l] where h is 0-1, s is 0-1, l is 0-1
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l];
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return [h, s, l];
}

/**
 * Simple k-means clustering
 */
function clusterColors(pixels: Vec3[], k: number, maxIter = 15): Vec3[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return [...pixels];

  // Initialize centroids randomly from actual pixels
  const centroids: Vec3[] = [];
  const used = new Set<number>();
  while (centroids.length < k && centroids.length < pixels.length) {
    const idx = Math.floor(Math.random() * pixels.length);
    if (!used.has(idx)) {
      used.add(idx);
      centroids.push([...pixels[idx]] as Vec3);
    }
  }

  // Iterate
  for (let iter = 0; iter < maxIter; iter++) {
    const clusters: Vec3[][] = centroids.map(() => []);

    // Assign pixels to nearest centroid
    for (const pixel of pixels) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let i = 0; i < centroids.length; i++) {
        const dist = rgbDistanceSq(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      clusters[minIdx].push(pixel);
    }

    // Update centroids to cluster means
    let converged = true;
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length === 0) continue;

      const newR = Math.round(
        clusters[i].reduce((s, p) => s + p[0], 0) / clusters[i].length
      );
      const newG = Math.round(
        clusters[i].reduce((s, p) => s + p[1], 0) / clusters[i].length
      );
      const newB = Math.round(
        clusters[i].reduce((s, p) => s + p[2], 0) / clusters[i].length
      );

      if (
        centroids[i][0] !== newR ||
        centroids[i][1] !== newG ||
        centroids[i][2] !== newB
      ) {
        converged = false;
        centroids[i] = [newR, newG, newB];
      }
    }

    if (converged) break;
  }

  return centroids;
}

/**
 * Snap a color to the nearest actual pixel in the image
 */
function snapToNearestPixel(color: Vec3, pixels: Vec3[]): Vec3 {
  let nearest = pixels[0];
  let minDist = Infinity;

  // Sample for performance
  const step = Math.max(1, Math.floor(pixels.length / 5000));

  for (let i = 0; i < pixels.length; i += step) {
    const dist = rgbDistanceSq(color, pixels[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = pixels[i];
    }
  }

  return nearest;
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Extract 8 diverse colors from pixels
 * @param shuffleFirst - if true, randomize order before diversity filtering
 */
function extractColors(pixels: Vec3[], count: number, shuffleFirst = false): Vec3[] {
  if (pixels.length === 0) {
    // Return neutral grays as fallback
    return Array(count)
      .fill(null)
      .map((_, i) => {
        const v = Math.round(50 + (i * 150) / count);
        return [v, v, v] as Vec3;
      });
  }

  // Filter out very dark pixels
  const colorfulPixels = pixels.filter((p) => {
    const [, , l] = rgbToHsl(...p);
    return l > 0.06;
  });

  const pixelsToCluster = colorfulPixels.length > 100 ? colorfulPixels : pixels;

  // Cluster to find dominant colors (more clusters = more variety to choose from)
  const clusterCenters = clusterColors(pixelsToCluster, count * 5);

  // Snap each cluster center to an actual pixel
  const snappedColors = clusterCenters.map((center) =>
    snapToNearestPixel(center, pixels)
  );

  // Calculate hue and saturation for diversity filtering
  const withHue = snappedColors.map((rgb) => {
    const [h, s] = rgbToHsl(...rgb);
    return { rgb, hue: h * 360, saturation: s };
  });

  // Sort by saturation (more saturated first), or shuffle for random mode
  if (shuffleFirst) {
    shuffle(withHue);
  } else {
    withHue.sort((a, b) => b.saturation - a.saturation);
  }

  // Filter for hue diversity (at least 22 degrees apart for saturated colors)
  // Lower threshold allows adjacent hues like orange/yellow to coexist
  const diverse: Vec3[] = [];
  for (const color of withHue) {
    if (diverse.length >= count) break;

    const isDiverse = diverse.every((existing) => {
      const [eh, es] = rgbToHsl(...existing);
      const existingHue = eh * 360;
      const hueDiff = Math.abs(color.hue - existingHue);
      const minDiff = Math.min(hueDiff, 360 - hueDiff);

      // Both colors are desaturated - check RGB distance instead
      if (color.saturation < 0.15 && es < 0.15) {
        return rgbDistanceSq(color.rgb, existing) > 1500;
      }

      // At least one is saturated - require hue diversity
      return minDiff >= 22;
    });

    if (isDiverse || diverse.length === 0) {
      diverse.push(color.rgb);
    }
  }

  // Fill with remaining colors that are sufficiently different
  for (const color of withHue) {
    if (diverse.length >= count) break;
    const isDifferent = diverse.every((d) => rgbDistanceSq(d, color.rgb) > 1000);
    if (isDifferent) {
      diverse.push(color.rgb);
    }
  }

  // If still short, repeat what we found (never use phantom colors)
  if (diverse.length > 0) {
    let repeatIdx = 0;
    while (diverse.length < count) {
      diverse.push(diverse[repeatIdx % diverse.length]);
      repeatIdx++;
    }
  }

  return diverse.slice(0, count);
}

// --- Shade Scale Generation ---

interface LAB {
  l: number;
  a: number;
  b: number;
}

/**
 * RGB to LAB conversion
 */
function rgbToLab(rgb: Vec3): LAB {
  // RGB to XYZ
  let r = rgb[0] / 255;
  let g = rgb[1] / 255;
  let b = rgb[2] / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * LAB to RGB conversion
 */
function labToRgb(lab: LAB): Vec3 {
  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  const x =
    (fx > 0.206897 ? Math.pow(fx, 3) : (fx - 16 / 116) / 7.787) * 0.95047;
  const y = fy > 0.206897 ? Math.pow(fy, 3) : (fy - 16 / 116) / 7.787;
  const z =
    (fz > 0.206897 ? Math.pow(fz, 3) : (fz - 16 / 116) / 7.787) * 1.08883;

  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(b * 255))),
  ];
}

/**
 * RGB to hex string
 */
function rgbToHex(rgb: Vec3): string {
  return (
    "#" +
    rgb
      .map((c) =>
        Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")
      )
      .join("")
  );
}

/**
 * Interpolate between two LAB colors
 */
function lerpLab(from: LAB, to: LAB, t: number): LAB {
  return {
    l: from.l + (to.l - from.l) * t,
    a: from.a + (to.a - from.a) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

/**
 * HSL to RGB conversion
 * Takes h (0-1), s (0-1), l (0-1), returns [r, g, b] (0-255)
 */
export function hslToRgb(h: number, s: number, l: number): Vec3 {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
  ];
}

/**
 * Hex to RGB conversion
 */
export function hexToRgb(hex: string): Vec3 {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [128, 128, 128];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

/**
 * Get the hue (0-360) from a hex color
 */
export function getHueFromHex(hex: string): number {
  const rgb = hexToRgb(hex);
  const [h] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return h * 360;
}

/**
 * Get the saturation (0-100) from a hex color
 */
export function getSaturationFromHex(hex: string): number {
  const rgb = hexToRgb(hex);
  const [, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return s * 100;
}

/**
 * Get the lightness (0-100) from a hex color
 */
export function getLightnessFromHex(hex: string): number {
  const rgb = hexToRgb(hex);
  const [, , l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return l * 100;
}

/**
 * Adjust HSL values of a hex color and regenerate the shade scale
 * @param baseHex - The 500 shade hex color
 * @param targetHue - The target hue (0-360)
 * @param targetSaturation - Optional target saturation (0-100)
 * @param targetLightness - Optional target lightness (0-100)
 * @returns A new ShadeScale with adjusted color
 */
export function shiftHueAndRegenerateScale(
  baseHex: string,
  targetHue: number,
  targetSaturation?: number,
  targetLightness?: number
): ShadeScale {
  const rgb = hexToRgb(baseHex);
  const [, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  // Normalize targetHue to 0-1 range
  const normalizedHue = ((targetHue % 360) + 360) % 360 / 360;

  // Use provided values or keep original
  const normalizedSat = targetSaturation !== undefined
    ? Math.max(0, Math.min(100, targetSaturation)) / 100
    : s;

  const normalizedLight = targetLightness !== undefined
    ? Math.max(0, Math.min(100, targetLightness)) / 100
    : l;

  // Convert back to RGB with new HSL values
  const newRgb = hslToRgb(normalizedHue, normalizedSat, normalizedLight);

  // Generate new shade scale
  return generateShadeScale(newRgb);
}

/**
 * Generate Tailwind shade scale from a base color
 * Anchors at 500 (input) and 900 (derived dark), interpolates between
 */
export function generateShadeScale(rgb: Vec3): ShadeScale {
  const lab500 = rgbToLab(rgb);

  // Target L* values
  const L_50 = 97;
  const L_900 = 17;
  const L_950 = 10;

  // Derive anchors
  const lab900: LAB = { l: L_900, a: lab500.a * 0.75, b: lab500.b * 0.75 };
  const lab50: LAB = { l: L_50, a: lab500.a * 0.25, b: lab500.b * 0.25 };
  const lab950: LAB = { l: L_950, a: lab500.a * 0.6, b: lab500.b * 0.6 };

  return {
    50: rgbToHex(labToRgb(lab50)),
    100: rgbToHex(labToRgb(lerpLab(lab50, lab500, 0.2))),
    200: rgbToHex(labToRgb(lerpLab(lab50, lab500, 0.4))),
    300: rgbToHex(labToRgb(lerpLab(lab50, lab500, 0.6))),
    400: rgbToHex(labToRgb(lerpLab(lab50, lab500, 0.8))),
    500: rgbToHex(rgb),
    600: rgbToHex(labToRgb(lerpLab(lab500, lab900, 0.25))),
    700: rgbToHex(labToRgb(lerpLab(lab500, lab900, 0.5))),
    800: rgbToHex(labToRgb(lerpLab(lab500, lab900, 0.75))),
    900: rgbToHex(labToRgb(lab900)),
    950: rgbToHex(labToRgb(lab950)),
  };
}
