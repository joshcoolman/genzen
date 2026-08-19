import { beforeEach, describe, expect, it } from 'vitest'
import { takePanelHandoff, writePanelHandoff } from './panel-handoff'

/**
 * #433. The one-shot semantics are the whole contract, and both ways of
 * getting them wrong are silent: a delivery that is never cleared refills the
 * panel on every visit, and a malformed record that throws takes the Images
 * route down on mount rather than degrading to "nothing was waiting".
 */

// `environment: 'node'`, so there is no store to write to. A Map is the whole
// of what this module uses.
function installStore() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  })
  return store
}

describe('panel handoff', () => {
  let store: Map<string, string>
  beforeEach(() => {
    store = installStore()
  })

  it('is collected once and then gone', () => {
    writePanelHandoff({
      prompts: ['a', 'b'],
      primaryImage: { id: 'img-1', url: '/img/img-1', title: 'cat' },
    })

    const first = takePanelHandoff()
    expect(first?.prompts).toEqual(['a', 'b'])
    expect(first?.primaryImage?.id).toBe('img-1')

    // The second mount -- a reload of Images, or a route that mounts twice --
    // must not re-apply a delivery the user has since edited away.
    expect(takePanelHandoff()).toBeNull()
    expect(store.size).toBe(0)
  })

  it('overwrites rather than queueing', () => {
    writePanelHandoff({ prompts: ['first'] })
    writePanelHandoff({ prompts: ['second'] })
    expect(takePanelHandoff()?.prompts).toEqual(['second'])
  })

  it('returns null for a record it cannot read, and clears it', () => {
    store.set('genzen:panel-handoff', '{not json')
    expect(takePanelHandoff()).toBeNull()
    expect(store.size).toBe(0)
  })
})
