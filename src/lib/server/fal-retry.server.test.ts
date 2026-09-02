import { describe, expect, it, vi } from 'vitest'
import { isTransientNetworkError, withNetworkRetry } from './fal-retry.server'

/** #556. The failure that started this: a dev server up for eight hours could
 *  not reach FAL at all, while a fresh process on the same machine could. */
function deadSession() {
  return new TypeError('fetch failed', {
    cause: Object.assign(new Error('The session has been destroyed'), {
      code: 'ERR_HTTP2_INVALID_SESSION',
    }),
  })
}

describe('a dead pooled connection is retried, a rejected request is not', () => {
  it('recognises the destroyed HTTP/2 session under "fetch failed"', () => {
    expect(isTransientNetworkError(deadSession())).toBe(true)
  })

  it('recognises a corrupted TLS record (#556, second failure)', () => {
    // The one the first pass missed: the set listed HTTP/2 codes by name, so a
    // TLS alert went out as a failed generation without a retry.
    const tls = new TypeError('fetch failed', {
      cause: Object.assign(
        new Error(
          '80E1FFFB01000000:error:0A0003FC:SSL routines:ssl3_read_bytes:ssl/tls alert bad record mac:ssl/record/rec_layer_s3.c:1590',
        ),
        { code: 'ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC' },
      ),
    })
    expect(isTransientNetworkError(tls)).toBe(true)
  })

  it('covers HTTP/2 codes it was never told about by name', () => {
    const unknown = Object.assign(new Error('stream closed'), {
      code: 'ERR_HTTP2_STREAM_CLOSED_UNEXPECTEDLY',
    })
    expect(isTransientNetworkError(unknown)).toBe(true)
  })

  it('does not treat a FAL rejection as transient', () => {
    const refused = Object.assign(new Error('Unprocessable entity'), {
      status: 422,
    })
    expect(isTransientNetworkError(refused)).toBe(false)
  })

  it('succeeds on the second attempt after a dead session', async () => {
    vi.useFakeTimers()
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(deadSession())
      .mockResolvedValue('https://fal.test/one')

    const result = withNetworkRetry('t', attempt)
    await vi.runAllTimersAsync()
    expect(await result).toBe('https://fal.test/one')
    expect(attempt).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('never retries a request FAL actually answered', async () => {
    const refused = Object.assign(new Error('bad prompt'), { status: 422 })
    const attempt = vi.fn().mockRejectedValue(refused)

    await expect(withNetworkRetry('t', attempt)).rejects.toThrow('bad prompt')
    // Money: a retried 422 is a second charge for a request that fails the
    // same way.
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it('gives up and rethrows when every attempt hits a dead session', async () => {
    vi.useFakeTimers()
    const attempt = vi.fn().mockRejectedValue(deadSession())

    const result = withNetworkRetry('t', attempt).catch((e: Error) => e)
    await vi.runAllTimersAsync()
    expect(await result).toBeInstanceOf(TypeError)
    expect(attempt).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})
