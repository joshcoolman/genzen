import { beforeEach, describe, expect, it, vi } from 'vitest'

const buildReferenceSheet = vi.fn()

vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: () => Promise.resolve({ userId: 'user-1' }),
}))
vi.mock('#/lib/server/reference-sheet.server', () => ({
  buildReferenceSheet: (...args: Array<unknown>) =>
    buildReferenceSheet(...args),
  referenceSheetFileName: () => 'reference-sheet-2cells-2048x1536.png',
}))

const { POST } = await import('./route')

const ID_A = '11111111-1111-1111-1111-111111111111'
const ID_B = '22222222-2222-2222-2222-222222222222'

function post(body: unknown) {
  return new Request('http://localhost/api/reference-sheet', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/reference-sheet', () => {
  beforeEach(() => {
    buildReferenceSheet.mockReset()
    buildReferenceSheet.mockResolvedValue({
      png: Buffer.from([1, 2, 3]),
      cells: 2,
      width: 2048,
      height: 1536,
    })
  })

  it('returns the sheet as a png, named by the server', async () => {
    const response = await POST(post({ ids: [ID_A, ID_B] }))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('content-disposition')).toContain(
      'reference-sheet-2cells-2048x1536.png',
    )
    expect(await response.arrayBuffer()).toHaveProperty('byteLength', 3)
  })

  it('passes the ids through in the order they were sent', async () => {
    await POST(post({ ids: [ID_B, ID_A] }))
    expect(buildReferenceSheet).toHaveBeenCalledWith('user-1', [ID_B, ID_A])
  })

  // Every one of these composites nothing: the ids reach a `user_id`-filtered
  // query, so the shape is all this layer has to judge.
  it.each([
    ['no ids', { ids: [] }],
    ['not an array', { ids: ID_A }],
    ['not uuids', { ids: ['../../etc/passwd'] }],
    ['nothing at all', {}],
    ['not json', 'wat'],
  ])('refuses %s', async (_label, body) => {
    const response = await POST(post(body))
    expect(response.status).toBe(400)
    expect(buildReferenceSheet).not.toHaveBeenCalled()
  })

  it('passes a build failure back as a sentence', async () => {
    buildReferenceSheet.mockRejectedValue(new Error('Too much image'))
    const response = await POST(post({ ids: [ID_A] }))
    expect(response.status).toBe(422)
    expect(await response.text()).toBe('Too much image')
  })
})
