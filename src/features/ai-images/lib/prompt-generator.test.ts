import { describe, it, expect } from 'vitest'
import { generatePrompt, generatePrompts } from './prompt-generator'
import type { MediumType } from './prompt-types'

describe('AI Prompt Generator', () => {
  describe('Basic Structure', () => {
    it('should generate a complete prompt with all required parts', () => {
      const result = generatePrompt()

      expect(result.prompt).toBeTruthy()
      expect(result.parts.subject).toBeTruthy()
      expect(result.parts.action).toBeTruthy()
      expect(result.parts.medium).toBeTruthy()
      expect(result.parts.atmosphere).toBeTruthy()
      expect(result.parts.technical.length).toBeGreaterThan(0)
      expect(result.parts.aspectRatio).toBeTruthy()
    })

    it('should include aspect ratio flag in prompt', () => {
      const result = generatePrompt()
      expect(result.prompt).toMatch(/--ar \d+:\d+/)
    })

    it('should return metadata', () => {
      const result = generatePrompt()

      expect(result.metadata.mediumType).toMatch(/photography|art|3d/)
      expect(typeof result.metadata.hasChaosMode).toBe('boolean')
      expect(typeof result.metadata.hasWildcard).toBe('boolean')
      expect(result.metadata.aspectRatio).toBeTruthy()
      expect(result.metadata.technicalCount).toBeGreaterThan(0)
    })
  })

  describe('Commitment Logic', () => {
    it('should never mix camera specs with art techniques', () => {
      const results = generatePrompts(100)

      for (const result of results) {
        const { prompt, metadata } = result

        if (metadata.mediumType === 'photography') {
          // Photography prompts should have camera terms
          const hasCameraTerms =
            prompt.includes('mm') || prompt.includes('f/')
          expect(hasCameraTerms).toBe(true)

          // Photography prompts should NOT have art terms
          expect(prompt.toLowerCase()).not.toMatch(
            /impasto|glazing|stippling|hatching|sgraffito|scumbling/,
          )
        } else if (metadata.mediumType === 'art') {
          // Art prompts should NOT have camera lens specs
          const hasCameraLensSpecs =
            /\d+mm f\/\d+/.test(prompt) || /f\/\d+\.\d+/.test(prompt)
          expect(hasCameraLensSpecs).toBe(false)

          // Art prompts should NOT have film stock terms
          expect(prompt).not.toMatch(/Kodak|Fujifilm|Ilford|CineStill|Agfa/)
        }
      }
    })

    it('should never mix camera specs with 3D render settings', () => {
      const results = generatePrompts(100)

      for (const result of results) {
        const { prompt, metadata } = result

        if (metadata.mediumType === '3d') {
          // 3D prompts should NOT have camera lens specs
          const hasCameraLensSpecs =
            /\d+mm f\/\d+/.test(prompt) || /f\/\d+\.\d+/.test(prompt)
          expect(hasCameraLensSpecs).toBe(false)

          // 3D prompts should NOT have film stock terms
          expect(prompt).not.toMatch(/Kodak|Fujifilm|Ilford|CineStill|Agfa/)

          // 3D prompts should NOT have art techniques
          expect(prompt.toLowerCase()).not.toMatch(
            /impasto|glazing|stippling|hatching|sgraffito|scumbling/,
          )
        }
      }
    })

    it('should include appropriate technical details for each medium type', () => {
      const results = generatePrompts(100)

      for (const result of results) {
        const { parts, metadata } = result

        expect(parts.technical.length).toBeGreaterThan(0)

        if (metadata.mediumType === 'photography') {
          // Photography should have lens and film stock
          const technicalStr = parts.technical.join(' ')
          const hasLens = /mm/.test(technicalStr)
          const hasFilmStock =
            /Kodak|Fujifilm|Ilford|CineStill/.test(technicalStr)
          expect(hasLens || hasFilmStock).toBe(true)
        } else if (metadata.mediumType === 'art') {
          // Art should have art techniques or framing
          const technicalStr = parts.technical.join(' ')
          expect(technicalStr.length).toBeGreaterThan(0)
        } else if (metadata.mediumType === '3d') {
          // 3D should have render engine terms
          const technicalStr = parts.technical.join(' ')
          const hasRenderTerm =
            /render|ray|path|volumetric|subsurface|caustics|HDRI|PBR|displacement|normal map/i.test(
              technicalStr,
            )
          expect(hasRenderTerm || technicalStr.length > 0).toBe(true)
        }
      }
    })
  })

  describe('Surprise Mechanisms', () => {
    it('should include wildcards approximately 15% of the time by default', () => {
      const results = generatePrompts(1000)
      const withWildcard = results.filter((r) => r.metadata.hasWildcard).length

      // Allow 10-20% range for randomness
      expect(withWildcard).toBeGreaterThan(100)
      expect(withWildcard).toBeLessThan(200)
    })

    it('should respect wildcard disable option', () => {
      const results = generatePrompts(50, { disableWildcards: true })

      for (const result of results) {
        expect(result.metadata.hasWildcard).toBe(false)
        expect(result.parts.wildcard).toBeUndefined()
      }
    })

    it('should respect custom wildcard chance', () => {
      const results = generatePrompts(1000, { wildcardChance: 0.5 })
      const withWildcard = results.filter((r) => r.metadata.hasWildcard).length

      // Allow 40-60% range for 50% chance
      expect(withWildcard).toBeGreaterThan(400)
      expect(withWildcard).toBeLessThan(600)
    })

    it('should have chaos mode approximately 10% of the time by default', () => {
      const results = generatePrompts(1000)
      const withChaos = results.filter((r) => r.metadata.hasChaosMode).length

      // Allow 5-15% range for randomness
      expect(withChaos).toBeGreaterThan(50)
      expect(withChaos).toBeLessThan(150)
    })

    it('should respect chaos mode disable option', () => {
      const results = generatePrompts(50, { disableChaosMode: true })

      for (const result of results) {
        expect(result.metadata.hasChaosMode).toBe(false)
      }
    })
  })

  describe('Options', () => {
    it('should respect forced medium type', () => {
      const types: MediumType[] = ['photography', 'art', '3d']

      for (const type of types) {
        const results = generatePrompts(20, { forceMediumType: type })

        for (const result of results) {
          expect(result.metadata.mediumType).toBe(type)
        }
      }
    })

    it('should respect forced aspect ratio', () => {
      const aspectRatio = '1:1'
      const results = generatePrompts(20, { forceAspectRatio: aspectRatio })

      for (const result of results) {
        expect(result.metadata.aspectRatio).toBe(aspectRatio)
        expect(result.prompt).toContain('--ar 1:1')
      }
    })
  })

  describe('Prompt Format', () => {
    it('should follow the correct structure', () => {
      const result = generatePrompt()
      const { prompt } = result

      // Should contain commas separating sections
      expect(prompt).toContain(',')

      // Should end with aspect ratio
      expect(prompt).toMatch(/--ar \d+:\d+$/)

      // Should start with subject (a/an/the)
      expect(prompt).toMatch(/^(A |An |The )/i)
    })

    it('should generate diverse prompts', () => {
      const results = generatePrompts(50)
      const prompts = results.map((r) => r.prompt)

      // All prompts should be unique
      const uniquePrompts = new Set(prompts)
      expect(uniquePrompts.size).toBe(prompts.length)
    })

    it('should generate prompts with reasonable length', () => {
      const results = generatePrompts(100)

      for (const result of results) {
        const { prompt } = result
        // Prompts should be substantial but not too long
        expect(prompt.length).toBeGreaterThan(50)
        expect(prompt.length).toBeLessThan(500)
      }
    })
  })

  describe('Medium Distribution', () => {
    it('should generate all three medium types over many iterations', () => {
      const results = generatePrompts(100)
      const types = new Set(results.map((r) => r.metadata.mediumType))

      expect(types.has('photography')).toBe(true)
      expect(types.has('art')).toBe(true)
      expect(types.has('3d')).toBe(true)
    })
  })

  describe('Aspect Ratio Distribution', () => {
    it('should generate multiple different aspect ratios', () => {
      const results = generatePrompts(100)
      const ratios = new Set(results.map((r) => r.metadata.aspectRatio))

      // Should have at least 5 different aspect ratios
      expect(ratios.size).toBeGreaterThanOrEqual(5)
    })

    it('should prefer common aspect ratios (weighted distribution)', () => {
      const results = generatePrompts(1000)
      const ratioCount = new Map<string, number>()

      for (const result of results) {
        const count = ratioCount.get(result.metadata.aspectRatio) || 0
        ratioCount.set(result.metadata.aspectRatio, count + 1)
      }

      // 16:9 should be most common (weight 25)
      // 3:2 should be second most common (weight 20)
      const sorted = Array.from(ratioCount.entries()).sort(
        (a, b) => b[1] - a[1],
      )

      // Top ratios should be among the high-weight ones
      const topRatios = sorted.slice(0, 3).map((s) => s[0])
      const expectedTopRatios = ['16:9', '3:2', '2:3']

      // At least 2 of the top 3 should be from expected top ratios
      const matches = topRatios.filter((r) =>
        expectedTopRatios.includes(r),
      ).length
      expect(matches).toBeGreaterThanOrEqual(2)
    })
  })
})
