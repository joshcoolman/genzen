import { describe, expect, it } from 'vitest'
import { decodeFalError } from './decode-fal.server'
import { isRetryable, toWire } from './errors'

// The decoder is the only place the evidence exists. Everything downstream --
// the retry policy, the log, what the client is told -- follows from the tag it
// picks here, so these are the calls that used to be spread over four files.

const withCause = (message: string, code: string) =>
  Object.assign(new Error('fetch failed'), {
    cause: Object.assign(new Error(message), { code }),
  })

describe('decodeFalError', () => {
  it('reads a destroyed HTTP/2 session as transport, not as a failed request', () => {
    const error = decodeFalError(
      withCause('The session has been destroyed', 'ERR_HTTP2_INVALID_SESSION'),
    )
    expect(error._tag).toBe('FalTransport')
    expect(isRetryable(error)).toBe(true)
  })

  it('separates a timeout from the rest of the transport family', () => {
    const error = decodeFalError(
      withCause('Headers Timeout Error', 'UND_ERR_HEADERS_TIMEOUT'),
    )
    expect(error._tag).toBe('FalTimeout')
    expect(isRetryable(error)).toBe(true)
  })

  it('reads a 422 as a content refusal', () => {
    const error = decodeFalError(
      Object.assign(new Error('Unprocessable'), {
        status: 422,
        body: { detail: 'The prompt was rejected by the safety system' },
      }),
    )
    expect(error._tag).toBe('ContentRefused')
    expect(isRetryable(error)).toBe(false)
  })

  it('reads an ordinary 4xx as a refusal that must not be retried', () => {
    const error = decodeFalError(
      Object.assign(new Error('Bad Request'), {
        status: 400,
        body: { detail: [{ msg: 'image_size is not valid' }] },
      }),
    )
    expect(error._tag).toBe('FalRefused')
    expect(error.message).toBe('image_size is not valid')
    expect(isRetryable(error)).toBe(false)
  })

  // Guessing costs a paid request that will fail the same way.
  it('does not retry a failure it cannot place', () => {
    expect(isRetryable(decodeFalError(new Error('something odd')))).toBe(false)
  })
})

describe('toWire', () => {
  it('carries the tag and the verdict, so the client decides neither', () => {
    const wire = toWire(
      decodeFalError(withCause('socket hang up', 'ECONNRESET')),
    )
    expect(wire).toMatchObject({ _tag: 'FalTransport', retryable: true })
  })
})
