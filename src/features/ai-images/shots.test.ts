import { describe, expect, it } from 'vitest'
import { buildShotPrompt } from './shots'

/**
 * The short path is now the angle and nothing else (#553). What it must not
 * grow back is a block addressed to a reader that is not there -- the constant
 * block told FAL to inventory the reference and to "describe" the camera
 * position, neither of which an image model can do, and it was two-thirds of
 * every prompt sent.
 */
describe('buildShotPrompt', () => {
  it('is the angle alone when nothing is typed', async () => {
    const prompt = await buildShotPrompt('worms-eye-hero')
    expect(prompt).toContain("Worm's-Eye Hero")
    expect(prompt).not.toMatch(/inventory|describe/i)
  })

  it('appends a typed instruction after the angle', async () => {
    const prompt = await buildShotPrompt(
      'true-overhead',
      '  inside a clean cement warehouse  ',
    )
    expect(prompt.indexOf('True Overhead')).toBeLessThan(
      prompt.indexOf('inside a clean cement warehouse'),
    )
    // Trimmed and last.
    expect(prompt.endsWith('inside a clean cement warehouse')).toBe(true)
  })

  it('treats whitespace as no instruction', async () => {
    const prompt = await buildShotPrompt('dutch-angle', '   \n  ')
    expect(prompt.trim()).toBe(prompt)
    expect(prompt.endsWith('Widest lens in the set.')).toBe(false)
  })
})
