import { describe, expect, it } from 'vitest'
import { effectFileBody, effectRegistryEntry, slugify } from './effect-file'
import { composeLightingPrompt } from '#/features/ai-images/lighting'

const effect = {
  id: 'hard-rake-dark-ground',
  name: 'Hard Rake, Dark Ground',
  setup:
    'A two-source setup.\n\n- **Rake:** gelled {RAKE_GEL}, low and behind.',
  gels: [{ token: 'RAKE_GEL', color: "a photographer's red" }],
}

describe('captured effect', () => {
  it('names the file the registry entry imports', () => {
    const entry = effectRegistryEntry(effect)
    expect(entry).toContain(`file: 'src/lib/prompts/lighting/${effect.id}.md'`)
    expect(entry).toContain(`import('./${effect.id}.md')`)
  })

  // A gel phrase is free text and an apostrophe in one is ordinary -- unescaped
  // it produces an entry that will not parse, which is a paste that fails in
  // the editor rather than a throw anyone sees here.
  it('escapes a quote inside a gel', () => {
    expect(effectRegistryEntry(effect)).toContain(
      "RAKE_GEL: 'a photographer\\'s red',",
    )
  })

  it('leaves the file body as the setup alone, so the wrapper is never restated', () => {
    expect(effectFileBody(effect)).toBe(`${effect.setup}\n`)
  })

  // The point of the page: what it hands over must assemble the way the shipped
  // dialog assembles it, tokens and all.
  it('composes into a prompt with every token filled', () => {
    const prompt = composeLightingPrompt(
      effectFileBody(effect),
      Object.fromEntries(effect.gels.map((g) => [g.token, g.color])),
    )
    expect(prompt).toContain("a photographer's red")
    expect(prompt).not.toMatch(/\{[A-Z_]+\}/)
  })

  it('slugs a name into the id the file is written under', () => {
    expect(slugify('Hard Rake, Dark Ground')).toBe('hard-rake-dark-ground')
  })
})
