import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import AFTER the mocks below are hoisted.
import { fal } from '@fal-ai/client'
import * as falCompletion from './fal-completion.server'
import { sql } from './db.server'

import { checkPendingGenerations } from './check-pending-generations.action'

vi.mock('@fal-ai/client', () => ({
  fal: {
    config: vi.fn(),
    queue: {
      status: vi.fn(),
      result: vi.fn(),
    },
  },
}))

vi.mock('./auth.server', () => ({
  resolveAuth: vi.fn().mockResolvedValue({ userId: 'user-test' }),
}))

// `sql` is a tagged template, so the mock is just a function returning the
// rows the query would have.
vi.mock('./db.server', () => ({ sql: vi.fn() }))

vi.mock('./fal-completion.server', () => ({
  processImageResult: vi.fn(),
  markGenerationFailedWithBlob: vi.fn(),
}))

vi.mock('./fal-error.server', () => ({
  extractFalError: vi.fn().mockReturnValue({
    code: 'unknown',
    message: 'error',
    stage: '',
    fal_request_id: null,
  }),
}))

function mockPendingRows(rows: Array<Record<string, unknown>>) {
  // Cast through a bare mock type: `sql`'s own signature is generic enough that
  // `vi.mocked` on it blows the instantiation depth limit.
  ;(sql as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(rows)
}

function makePendingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-001',
    source: 'ai_images',
    status: 'pending',
    request_id: 'req-abc',
    generation_metadata: { fal_model_id: 'fal-ai/flux' },
    ...overrides,
  }
}

describe('checkPendingGenerations handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(falCompletion.processImageResult).mockResolvedValue(undefined)
    vi.mocked(falCompletion.markGenerationFailedWithBlob).mockResolvedValue(
      undefined,
    )
  })

  it('processes COMPLETED record and returns completed:1, failed:0', async () => {
    const record = makePendingRecord()
    mockPendingRows([record])
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'COMPLETED',
    } as unknown as Awaited<ReturnType<typeof fal.queue.status>>)
    vi.mocked(fal.queue.result).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof fal.queue.result>>,
    )

    const result = (await checkPendingGenerations()) as Record<string, number>

    expect(result.completed).toBe(1)
    expect(result.failed).toBe(0)
    expect(falCompletion.processImageResult).toHaveBeenCalledOnce()
  })

  it('marks FAILED record and returns completed:0, failed:1', async () => {
    const record = makePendingRecord()
    mockPendingRows([record])
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'FAILED',
    } as unknown as Awaited<ReturnType<typeof fal.queue.status>>)
    vi.mocked(fal.queue.result).mockRejectedValue(new Error('fal failed'))

    const result = (await checkPendingGenerations()) as Record<string, number>

    expect(result.completed).toBe(0)
    expect(result.failed).toBe(1)
    expect(falCompletion.markGenerationFailedWithBlob).toHaveBeenCalledOnce()
    expect(falCompletion.processImageResult).not.toHaveBeenCalled()
  })

  it('skips IN_QUEUE record and returns completed:0, failed:0', async () => {
    const record = makePendingRecord()
    mockPendingRows([record])
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'IN_QUEUE',
    } as unknown as Awaited<ReturnType<typeof fal.queue.status>>)

    const result = (await checkPendingGenerations()) as Record<string, number>

    expect(result.completed).toBe(0)
    expect(result.failed).toBe(0)
    expect(falCompletion.processImageResult).not.toHaveBeenCalled()
    expect(falCompletion.markGenerationFailedWithBlob).not.toHaveBeenCalled()
  })

  it('processes second record even when first throws a non-FAL network error', async () => {
    const rec1 = makePendingRecord({ id: 'rec-001', request_id: 'req-001' })
    const rec2 = makePendingRecord({ id: 'rec-002', request_id: 'req-002' })
    mockPendingRows([rec1, rec2])
    vi.mocked(fal.queue.status)
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce({
        status: 'COMPLETED',
      } as unknown as Awaited<ReturnType<typeof fal.queue.status>>)
    vi.mocked(fal.queue.result).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof fal.queue.result>>,
    )

    const result = (await checkPendingGenerations()) as Record<string, number>

    expect(result.completed).toBe(1)
    expect(result.failed).toBe(0)
    expect(falCompletion.processImageResult).toHaveBeenCalledOnce()
  })
})
