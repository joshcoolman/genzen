import { describe, expect, it } from 'vitest'
import { sameOrigin } from './request-origin'

describe('Director request origin', () => {
  const proxied = (origin: string, extra = {}) =>
    new Request('http://0.0.0.0:3000/director/export', {
      headers: {
        origin,
        host: 'genzen-production.up.railway.app',
        'x-forwarded-host': 'genzen-production.up.railway.app',
        'x-forwarded-proto': 'https',
        ...extra,
      },
    })
  it('accepts the public HTTPS origin behind the listening socket', () => {
    expect(
      sameOrigin(proxied('https://genzen-production.up.railway.app')),
    ).toBe(true)
  })
  it('rejects foreign, missing, opaque and ambiguous origins', () => {
    for (const origin of [
      'https://attacker.test',
      '',
      'null',
      'http://genzen-production.up.railway.app',
    ])
      expect(sameOrigin(proxied(origin))).toBe(false)
    expect(
      sameOrigin(
        proxied('https://genzen-production.up.railway.app', {
          'x-forwarded-host': 'genzen-production.up.railway.app, attacker.test',
        }),
      ),
    ).toBe(false)
  })
  it('accepts direct local requests with their port', () => {
    expect(
      sameOrigin(
        new Request('http://localhost:3000/director/media', {
          headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
        }),
      ),
    ).toBe(true)
  })
})
