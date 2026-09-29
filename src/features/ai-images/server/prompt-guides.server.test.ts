import { describe, expect, it } from 'vitest'
import { declaredGuidePaths, promptGuideFor } from './prompt-guides.server'
import { IMAGE_MODELS } from '#/features/ai-images/models'

/**
 * #463. A model declares its guide as a path string, which nothing type-checks
 * against the map that imports it. Two ways that breaks quietly:
 *
 * - A path with no import throws at enhance time, on that model only, in
 *   production. Caught here instead.
 * - A typo'd path is indistinguishable at a glance from a model that simply has
 *   no guide, and a model with no guide is a legitimate state -- so the failure
 *   looks exactly like working.
 */
describe('per-model prompt guides', () => {
  it('imports every guide the lineup declares', () => {
    for (const slug of IMAGE_MODELS.filter((m) => m.promptGuide).map(
      (m) => m.slug,
    )) {
      expect(() => promptGuideFor(slug)).not.toThrow()
      expect(promptGuideFor(slug)).toBeTruthy()
    }
  })

  it('points every declared path at a .md under src/lib/prompts', () => {
    for (const path of declaredGuidePaths()) {
      expect(path).toMatch(/^src\/lib\/prompts\/[\w-]+\.md$/)
    }
  })

  it('returns null for a model with no guide, rather than throwing', () => {
    const unguided = IMAGE_MODELS.find((m) => !m.promptGuide)
    expect(unguided).toBeDefined()
    expect(promptGuideFor(unguided?.slug)).toBeNull()
    expect(promptGuideFor(undefined)).toBeNull()
  })
})
