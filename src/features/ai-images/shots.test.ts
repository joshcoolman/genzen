import { describe, expect, it } from 'vitest'
import { buildShotPrompt } from './shots'

/**
 * The order of these three blocks is the precedence rule (#553), and nothing
 * about a wrong order looks wrong -- it comes back as a picture that quietly
 * ignored what was typed, or moved the camera to satisfy it.
 */
describe('buildShotPrompt', () => {
  it('is the freeze then the angle, and nothing else, with no instructions', async () => {
    const prompt = await buildShotPrompt('worms-eye-hero')
    expect(prompt).toContain('Inventory everything visible')
    expect(prompt).toContain("Worm's-Eye Hero")
    // The no-nudge path has to stay byte-identical to the sixteen prompts that
    // were proven by hand, so the ranking block must not appear.
    expect(prompt).not.toContain('Additional instructions')
  })

  it('ranks a typed instruction above the freeze and below the camera', async () => {
    const prompt = await buildShotPrompt(
      'true-overhead',
      '  inside a clean cement warehouse  ',
    )
    expect(prompt).toContain('Additional instructions')
    expect(prompt.indexOf('True Overhead')).toBeLessThan(
      prompt.indexOf('Additional instructions'),
    )
    // Trimmed and last: everything before it exists to rank it.
    expect(prompt.endsWith('inside a clean cement warehouse')).toBe(true)
  })

  it('treats whitespace as no instruction', async () => {
    const prompt = await buildShotPrompt('dutch-angle', '   \n  ')
    expect(prompt).not.toContain('Additional instructions')
  })
})
