import { describe, expect, it } from 'vitest'
import { DEFAULT_CORE, deriveTheme, themeToCss } from './derive'

describe('deriveTheme', () => {
  /* The property that makes the feature safe to open at all: a user who lands
   * on /account/style, touches nothing and saves must not see the app shift.
   * If these drift, the form has a trapdoor in it. Values are today's
   * `src/styles/tokens.css`. */
  describe('reproduces the hand-authored palette from DEFAULT_CORE', () => {
    const palette = deriveTheme(DEFAULT_CORE)

    it.each([
      ['bg', 'hsl(0 0% 5.1%)'],
      ['surface', 'hsl(180 6.7% 11.8%)'],
      ['text', 'hsl(0 0% 100%)'],
      ['textMuted', 'hsl(0 0% 56.1%)'],
      ['border', 'hsl(0 0% 16.9%)'],
      ['accent', 'hsl(141.9 69.2% 58%)'],
    ] as const)('%s', (key, expected) => {
      expect(palette[key]).toBe(expected)
    })

    it('steps surface-raised to the 13% tokens.css chose', () => {
      expect(palette.surfaceRaised).toBe('hsl(180 6.7% 13%)')
    })

    it('lands accent-hover on the 45.3% tokens.css chose', () => {
      expect(palette.accentHover).toBe('hsl(141.9 69.2% 45.3%)')
    })

    it('picks black for the brand green, as tokens.css hardcodes', () => {
      // "the brand green is light enough that white fails on it"
      expect(palette.accentContrast).toBe('hsl(0 0% 5.1%)')
    })
  })

  /* The one value decided by measurement rather than arithmetic. A hardcoded
   * foreground is readable for exactly one accent; these are the two directions
   * it has to get right. */
  describe('accent-contrast follows the accent', () => {
    it('picks the dark ink under a light accent', () => {
      const palette = deriveTheme({ ...DEFAULT_CORE, accent: '#fef08a' })
      expect(palette.accentContrast).toBe('hsl(0 0% 5.1%)')
    })

    it('picks the light ink under a dark accent', () => {
      const palette = deriveTheme({ ...DEFAULT_CORE, accent: '#1e1b4b' })
      expect(palette.accentContrast).toBe('hsl(0 0% 100%)')
    })
  })

  describe('robustness at the ends of the range', () => {
    it('clamps rather than overflowing past white', () => {
      const palette = deriveTheme({ ...DEFAULT_CORE, surface: '#ffffff' })
      expect(palette.surfaceRaised).toBe('hsl(0 0% 100%)')
    })

    it('clamps rather than underflowing past black', () => {
      const palette = deriveTheme({ ...DEFAULT_CORE, accent: '#000000' })
      expect(palette.accentHover).toBe('hsl(0 0% 0%)')
    })

    it('rejects a color it cannot parse instead of guessing one', () => {
      expect(() =>
        deriveTheme({ ...DEFAULT_CORE, bg: 'rebeccapurple' }),
      ).toThrow(/Invalid color/)
    })
  })
})

describe('themeToCss', () => {
  const css = themeToCss(deriveTheme(DEFAULT_CORE))

  it('emits a :root block that wins on document order alone', () => {
    expect(css.startsWith(':root { ')).toBe(true)
    expect(css).not.toContain('!important')
  })

  it('emits HSL only -- tokens.css claims one notation for every value', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\brgba?\(/)
  })

  /* Overriding a status hue would let a theme make a failure look like a
   * success, and the alpha washes have no fixed color to override. */
  it.each(['--danger', '--warning', '--success', '--info', '--row-hover'])(
    'leaves %s alone',
    (token) => {
      expect(css).not.toContain(token)
    },
  )

  it('leaves --field alone, since color-mix already tracks --surface-raised', () => {
    expect(css).not.toContain('--field')
  })
})
