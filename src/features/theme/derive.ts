/* Six edited colors -> the palette `tokens.css` declares.
 *
 * Client-safe on purpose: the editing form derives on every keystroke to render
 * a live preview, so nothing in this file may import the server. See CLAUDE.md.
 *
 * **Emits HSL, and takes no color library.** bootsy's equivalent derives in
 * oklch via `culori` and emits hex; copying that here would break the claim
 * `tokens.css` opens with -- "Colors are HSL throughout... One notation for
 * every value" -- in the one file that makes it. What is actually needed is
 * lightness arithmetic plus a relative-luminance function for the accent's
 * foreground pick, which is the ~40 lines below rather than a dependency.
 *
 * The cost of that choice, stated plainly: HSL lightness is not perceptual, so
 * a fixed step means less at the ends of the range than in the middle. The
 * deltas below are tuned against genzen's own palette (a dark app) and are the
 * first thing to retune against a rendered preview if a light core is ever
 * wanted -- not values reasoned about in the abstract.
 */

export interface ThemeCore {
  bg: string
  surface: string
  text: string
  muted: string
  accent: string
  border: string
}

export const THEME_CORE_KEYS = [
  'bg',
  'surface',
  'text',
  'muted',
  'accent',
  'border',
] as const

/* Today's `tokens.css` values, converted to hex because `<input type="color">`
 * speaks hex and this is what the form opens with.
 *
 * These are not decoration. Saving the form untouched has to leave the app
 * looking as it does now, or the feature is not safe to open -- so the deltas
 * further down are the deltas that reproduce today's palette from this core,
 * not round numbers. Verified in derive.test.ts. */
export const DEFAULT_CORE: ThemeCore = {
  bg: '#0d0d0d', // hsl(0 0% 5.1%)
  surface: '#1c2020', // hsl(180 6.7% 11.8%)
  text: '#ffffff',
  muted: '#8f8f8f', // hsl(0 0% 56%)
  accent: '#4ade80', // hsl(141.9 69.2% 58%)
  border: '#2b2b2b', // hsl(0 0% 16.9%)
}

/* The step from --surface to --surface-raised. 1.2 points of lightness, which
 * is what genzen already chose (11.8% -> 13%) rather than a value picked here.
 *
 * It is deliberately small, and tokens.css explains the consequence: a 1.2%
 * step is "effectively invisible" as a hover, which is exactly why --row-hover
 * exists as a separate white wash. Raising this to make hovers work would be
 * fixing the wrong token. */
const RAISED_LIGHTNESS_DELTA = 1.2

/* --accent-hover sits 12.7 points below --accent (58% -> 45.3%). Darker rather
 * than lighter because the accent is already the lightest thing on the page. */
const ACCENT_HOVER_LIGHTNESS_DELTA = 12.7

/* --accent-soft is the selected-row wash and the focus ring's tint: the
 * accent's own hue at a lightness that can sit under text. Derived from the
 * accent's hue rather than a fixed green -- today's value drifted 18 degrees
 * off the accent it is meant to echo, a leftover of the Tailwind palette #229
 * replaced. */
const ACCENT_SOFT_LIGHTNESS = 14.5

export interface ThemePalette {
  bg: string
  surface: string
  surfaceRaised: string
  text: string
  textMuted: string
  border: string
  accent: string
  accentHover: string
  accentContrast: string
  accentSoft: string
}

interface Hsl {
  h: number
  s: number
  l: number
}

interface Rgb {
  r: number
  g: number
  b: number
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value)
}

/** Channels as 0-1. Throws rather than guessing: an unparseable color reaching
 *  the derivation means validation upstream let it through, and a silent
 *  fallback would render a palette nobody chose. */
function hexToRgb(hex: string): Rgb {
  if (!isHexColor(hex)) throw new Error(`Invalid color: ${hex}`)
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  }
}

function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  if (delta === 0) return { h: 0, s: 0, l: l * 100 }

  const s = delta / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4

  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** One decimal, and no trailing `.0` -- so the emitted values read exactly like
 *  the hand-authored ones in tokens.css rather than announcing themselves as
 *  generated. */
function round(value: number): number {
  return Math.round(value * 10) / 10
}

function formatHsl({ h, s, l }: Hsl): string {
  return `hsl(${round(h)} ${round(s)}% ${round(l)}%)`
}

/** Shifts lightness by `delta` points, clamped. Negative moves toward black. */
function shiftLightness(color: Hsl, delta: number): Hsl {
  return { ...color, l: clamp(color.l + delta, 0, 100) }
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const channel = (value: number): number =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/**
 * Six colors in, ten out.
 *
 * `--accent-contrast` is the only value here decided by measurement rather than
 * arithmetic: whichever of the two inks the user already chose reads better on
 * their accent wins. tokens.css hardcodes black today and says why -- "the
 * brand green is light enough that white fails on it" -- which is a fact about
 * that particular green, not about accents. Pick a navy accent and the same
 * hardcoded black becomes unreadable, so the choice has to follow the color.
 */
export function deriveTheme(core: ThemeCore): ThemePalette {
  const surface = hexToHsl(core.surface)
  const accent = hexToHsl(core.accent)

  return {
    bg: formatHsl(hexToHsl(core.bg)),
    surface: formatHsl(surface),
    surfaceRaised: formatHsl(shiftLightness(surface, RAISED_LIGHTNESS_DELTA)),
    text: formatHsl(hexToHsl(core.text)),
    textMuted: formatHsl(hexToHsl(core.muted)),
    border: formatHsl(hexToHsl(core.border)),
    accent: formatHsl(accent),
    accentHover: formatHsl(
      shiftLightness(accent, -ACCENT_HOVER_LIGHTNESS_DELTA),
    ),
    accentContrast:
      contrastRatio(core.text, core.accent) >=
      contrastRatio(core.bg, core.accent)
        ? formatHsl(hexToHsl(core.text))
        : formatHsl(hexToHsl(core.bg)),
    accentSoft: formatHsl({ ...accent, l: ACCENT_SOFT_LIGHTNESS }),
  }
}

const TOKEN_NAMES: Record<keyof ThemePalette, string> = {
  bg: '--bg',
  surface: '--surface',
  surfaceRaised: '--surface-raised',
  text: '--text',
  textMuted: '--text-muted',
  border: '--border',
  accent: '--accent',
  accentHover: '--accent-hover',
  accentContrast: '--accent-contrast',
  accentSoft: '--accent-soft',
}

/* Ten tokens, out of the twenty-one colors tokens.css declares. What is left
 * out is left out on purpose:
 *
 *   --field / --field-hover  already `color-mix(... var(--surface-raised) ...)`,
 *                            so they follow the redefined step for free
 *   --row-hover              a white alpha wash that lifts whatever ground it
 *                            lands on by a fixed amount; it has no fixed color
 *                            to override
 *   --danger/--warning/      status hues. Red has to stay red -- a palette that
 *   --success/--info         can recolor "this failed" is a palette that can
 *                            make a failure look like a success
 *   --shadow-*, --scrim,     black alphas and a black mat; they are about depth
 *   --slot-empty,            rather than hue, and tint with the ground already
 *   --image-backing
 */
export function paletteToCss(palette: ThemePalette): string {
  return (Object.keys(TOKEN_NAMES) as Array<keyof ThemePalette>)
    .map((key) => `${TOKEN_NAMES[key]}: ${palette[key]};`)
    .join(' ')
}

/**
 * A `<style>`-ready override block.
 *
 * `:root` rather than anything more specific: it matches what tokens.css
 * declares, so this wins on document order alone. Nothing here is `!important`
 * and nothing sets an inline style on `<html>` -- both would take the palette
 * out of reach of a component that legitimately wants to override a token in
 * its own subtree.
 *
 * Genzen is dark-only, so this is one block. bootsy emits two (`:root` for
 * light, `[data-theme='dark']` for dark) because it has a mode toggle.
 */
export function themeToCss(palette: ThemePalette): string {
  return `:root { ${paletteToCss(palette)} }`
}
