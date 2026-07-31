import { describe, expect, it } from 'vitest'
import { isLocalEndpoint, resolveStorageEndpoint } from './image-storage'

// The endpoint fork, which is the one branch in the storage layer a deployment
// would hit differently from local dev. Cloudflare is a convenience path here,
// not where genzen runs -- it runs nowhere; MinIO in Docker is the only
// environment it has had (#228).
describe('resolveStorageEndpoint', () => {
  it('derives the Cloudflare R2 endpoint when R2_ENDPOINT is unset', () => {
    expect(resolveStorageEndpoint(undefined, 'abc123')).toBe(
      'https://abc123.r2.cloudflarestorage.com',
    )
  })

  it('prefers an explicit endpoint over the account id', () => {
    expect(resolveStorageEndpoint('http://localhost:9010', 'abc123')).toBe(
      'http://localhost:9010',
    )
  })

  it('strips a trailing slash', () => {
    expect(resolveStorageEndpoint('http://localhost:9010/')).toBe(
      'http://localhost:9010',
    )
  })

  it('is undefined when neither is configured', () => {
    expect(resolveStorageEndpoint(undefined, undefined)).toBeUndefined()
  })
})

// forcePathStyle is driven off this: MinIO serves one host, so virtual-hosted
// addressing (bucket.localhost:9010) has nothing to resolve to.
describe('isLocalEndpoint', () => {
  it.each([
    'http://localhost:9010',
    'http://127.0.0.1:9010',
    'http://minio:9000',
  ])('is true for %s', (endpoint) => {
    expect(isLocalEndpoint(endpoint)).toBe(true)
  })

  it('is false for a hosted provider', () => {
    expect(isLocalEndpoint('https://abc123.r2.cloudflarestorage.com')).toBe(
      false,
    )
  })

  it('is false for a malformed endpoint', () => {
    expect(isLocalEndpoint('not-a-url')).toBe(false)
  })
})
