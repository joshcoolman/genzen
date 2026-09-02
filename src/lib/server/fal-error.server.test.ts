import { describe, expect, it } from 'vitest'
import { describeThrown, extractFalError } from './fal-error.server'

/**
 * #556. Three generations failed with `generation_error` set to the two words
 * "fetch failed" and nothing else, which is what Node reports for every
 * network failure there is -- DNS, TLS, a reset socket, a timeout. The reason
 * was on `cause` the whole time.
 */
describe('a network failure says what actually happened', () => {
  it('follows the cause Node hides behind "fetch failed"', () => {
    const err = new TypeError('fetch failed', {
      cause: Object.assign(new Error('read ECONNRESET'), {
        code: 'ECONNRESET',
      }),
    })

    expect(describeThrown(err)).toBe(
      'fetch failed: read ECONNRESET (ECONNRESET)',
    )
    expect(extractFalError(err).message).toContain('ECONNRESET')
    expect(extractFalError(err).code).toBe('ECONNRESET')
  })

  it('is unchanged for an error with nothing underneath it', () => {
    expect(describeThrown(new Error('plain'))).toBe('plain')
  })

  it('stops rather than walking a chain forever', () => {
    const looping = new Error('a')
    Object.assign(looping, { cause: looping })
    expect(describeThrown(looping)).toBe('a')
  })
})
