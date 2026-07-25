import { beforeAll, describe, expect, it } from 'vitest'
import {
  createSessionValue,
  verifySessionFromCookieHeader,
  verifySessionValue,
} from './session'

const USER_ID = 'a1111111-1111-1111-1111-111111111111'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = 'test-secret'
})

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  )
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('session', () => {
  it('verifies a freshly created value and returns its userId', async () => {
    const value = await createSessionValue(USER_ID)
    expect(await verifySessionValue(value)).toEqual({
      userId: USER_ID,
      issuedAtMs: expect.any(Number),
    })
  })

  it('rejects a tampered signature', async () => {
    const value = await createSessionValue(USER_ID)
    const [userId, issuedAt, signature] = value.split('.')
    const flipped = signature.at(-1) === '0' ? '1' : '0'
    const tampered = `${userId}.${issuedAt}.${signature.slice(0, -1)}${flipped}`
    expect(await verifySessionValue(tampered)).toBeNull()
  })

  // The one that matters: swapping in someone else's id must not be accepted
  // just because the signature is well-formed.
  it('rejects a tampered userId even with the original signature', async () => {
    const value = await createSessionValue(USER_ID)
    const [, issuedAt, signature] = value.split('.')
    const tampered = `b2222222-2222-2222-2222-222222222222.${issuedAt}.${signature}`
    expect(await verifySessionValue(tampered)).toBeNull()
  })

  it('rejects an expired timestamp even with a valid signature', async () => {
    const expiredIssuedAt = Date.now() - 31 * 24 * 60 * 60 * 1000
    const signature = await hmacHex(
      `${USER_ID}.${expiredIssuedAt}`,
      'test-secret',
    )
    expect(
      await verifySessionValue(`${USER_ID}.${expiredIssuedAt}.${signature}`),
    ).toBeNull()
  })

  it('rejects malformed input without throwing', async () => {
    expect(await verifySessionValue(undefined)).toBeNull()
    expect(await verifySessionValue('')).toBeNull()
    expect(await verifySessionValue('not-a-valid-value')).toBeNull()
  })

  describe('from a Cookie header', () => {
    it('finds the session among other cookies', async () => {
      const value = await createSessionValue(USER_ID)
      const header = `theme=dark; genzen_session=${value}; other=1`
      expect(await verifySessionFromCookieHeader(header)).toEqual({
        userId: USER_ID,
        issuedAtMs: expect.any(Number),
      })
    })

    it('returns null when the cookie is absent or the header is empty', async () => {
      expect(await verifySessionFromCookieHeader('theme=dark')).toBeNull()
      expect(await verifySessionFromCookieHeader('')).toBeNull()
      expect(await verifySessionFromCookieHeader(null)).toBeNull()
    })

    // A cookie whose name merely ends in the session name must not match.
    it('does not match a differently-named cookie with a shared suffix', async () => {
      const value = await createSessionValue(USER_ID)
      expect(
        await verifySessionFromCookieHeader(`not_genzen_session=${value}`),
      ).toBeNull()
    })
  })
})
