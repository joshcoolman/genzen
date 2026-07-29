import { describe, expect, it } from 'vitest'
import { recordPromptOrigin } from './prompt-origins'

describe('recordPromptOrigin', () => {
  it('maps the enhanced text back to what was typed', () => {
    const origins = recordPromptOrigin(
      {},
      'a cat, cinematic, 35mm',
      'a cat',
      20,
    )
    expect(origins['a cat, cinematic, 35mm']).toBe('a cat')
  })

  it('keeps the typed text when an enhanced prompt is enhanced again', () => {
    const once = recordPromptOrigin({}, 'enhanced one', 'a cat', 20)
    const twice = recordPromptOrigin(once, 'enhanced two', 'enhanced one', 20)
    // Not 'enhanced one' -- the machine-written pass is derivable, the typed
    // text is not, so the chain must resolve to the original.
    expect(twice['enhanced two']).toBe('a cat')
  })

  it('does not record a pair that changed nothing', () => {
    const origins = { existing: 'kept' }
    expect(recordPromptOrigin(origins, 'same', 'same', 20)).toBe(origins)
    expect(recordPromptOrigin(origins, '  ', 'a cat', 20)).toBe(origins)
  })

  it('caps the map at max entries, keeping the newest', () => {
    let origins = {}
    for (let i = 0; i < 5; i++) {
      origins = recordPromptOrigin(origins, `enhanced ${i}`, `typed ${i}`, 3)
    }
    expect(Object.keys(origins)).toEqual([
      'enhanced 2',
      'enhanced 3',
      'enhanced 4',
    ])
  })
})
