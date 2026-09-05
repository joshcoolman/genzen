import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
  append: vi.fn(),
  finish: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('#/lib/server/auth.server', () => ({ resolveAuth: mocks.auth }))
vi.mock('../export-jobs.server', () => ({
  createExport: mocks.create,
  appendExport: mocks.append,
  finishExport: mocks.finish,
  removeExport: mocks.remove,
}))
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'development')
  mocks.auth.mockResolvedValue({ userId: 'owner' })
})
afterEach(() => vi.unstubAllEnvs())
const request = (
  operation: string,
  body?: string,
  origin = 'http://localhost:3000',
) =>
  new Request(
    `http://localhost:3000/lab/director/export?operation=${operation}&id=job`,
    {
      method: 'POST',
      headers: { origin },
      body,
    },
  )
describe('export route boundary', () => {
  it('rejects unauthenticated and cross-origin calls', async () => {
    expect(
      (await POST(request('create', '[]', 'https://attacker.test'))).status,
    ).toBe(403)
    mocks.auth.mockRejectedValue(new Error('Unauthorized'))
    expect((await POST(request('create', '[]'))).status).toBe(401)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('returns the MP4 as a private attachment, using server-resolved identity', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mocks.finish.mockResolvedValue(new Uint8Array([1, 2]))
    const response = await POST(request('finish'))
    expect(response.headers.get('content-type')).toBe('video/mp4')
    expect(response.headers.get('content-disposition')).toContain('attachment')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(mocks.finish).toHaveBeenCalledWith('owner', 'job')
  })
  it('bounds request bodies and hides encoder internals on failure', async () => {
    expect((await POST(request('create', 'x'.repeat(16001)))).status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
    mocks.finish.mockRejectedValue(new Error('secret server path'))
    const response = await POST(request('finish'))
    expect(await response.text()).not.toContain('secret')
  })
})
