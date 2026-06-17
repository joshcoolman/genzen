import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import AFTER mocks — this executes the module and populates captured.handler
import { fal } from '@fal-ai/client'
import * as falCompletion from './fal-completion.server'
import * as supabaseAdmin from './supabase-admin.server'

// Use an object container so the vi.mock factory can assign to it
// (avoids "cannot access before initialization" since we're not READING
// the outer variable inside the factory, just assigning to its property)
const captured = {
  handler: null as null | ((opts: { data: unknown }) => Promise<unknown>),
}

// Mock @tanstack/react-start before it's imported by the source file.
// The factory only writes to captured.handler — no outer var read issue.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (fn: (opts: { data: unknown }) => Promise<unknown>) => {
        captured.handler = fn
        return fn
      },
    }),
  }),
}))

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
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-test' }),
}))

vi.mock('./supabase-admin.server', () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('./fal-completion.server', () => ({
  processImageResult: vi.fn(),
  processVideoResult: vi.fn(),
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

vi.mock('./google-queue.server', () => ({
  dispatchGoogleQueue: vi.fn().mockResolvedValue(0),
}))
await import('./check-pending-generations.server')

function makeMockSupabase(rows: Array<Record<string, unknown>> = []) {
  const rpcFn = vi.fn().mockResolvedValue({ data: null, error: null })
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }),
    rpc: rpcFn,
  }
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

  function getHandler() {
    if (!captured.handler)
      throw new Error(
        'Handler not captured — @tanstack/react-start mock not active',
      )
    return captured.handler
  }

  it('processes COMPLETED record and returns completed:1, failed:0', async () => {
    const record = makePendingRecord()
    const mockSupabase = makeMockSupabase([record])
    vi.mocked(supabaseAdmin.getSupabaseAdmin).mockReturnValue(
      mockSupabase as unknown as ReturnType<
        typeof supabaseAdmin.getSupabaseAdmin
      >,
    )
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'COMPLETED',
    } as unknown as Awaited<ReturnType<typeof fal.queue.status>>)
    vi.mocked(fal.queue.result).mockResolvedValue({
      data: {},
    } as unknown as Awaited<ReturnType<typeof fal.queue.result>>)

    const result = (await getHandler()({
      data: { accessToken: 'tok' },
    })) as Record<string, number>

    expect(result.completed).toBe(1)
    expect(result.failed).toBe(0)
    expect(falCompletion.processImageResult).toHaveBeenCalledOnce()
  })

  it('marks FAILED record and returns completed:0, failed:1', async () => {
    const record = makePendingRecord()
    const mockSupabase = makeMockSupabase([record])
    vi.mocked(supabaseAdmin.getSupabaseAdmin).mockReturnValue(
      mockSupabase as unknown as ReturnType<
        typeof supabaseAdmin.getSupabaseAdmin
      >,
    )
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'FAILED',
    } as unknown as Awaited<ReturnType<typeof fal.queue.status>>)
    vi.mocked(fal.queue.result).mockRejectedValue(new Error('fal failed'))

    const result = (await getHandler()({
      data: { accessToken: 'tok' },
    })) as Record<string, number>

    expect(result.completed).toBe(0)
    expect(result.failed).toBe(1)
    expect(falCompletion.markGenerationFailedWithBlob).toHaveBeenCalledOnce()
    expect(falCompletion.processImageResult).not.toHaveBeenCalled()
  })

  it('skips IN_QUEUE record and returns completed:0, failed:0', async () => {
    const record = makePendingRecord()
    const mockSupabase = makeMockSupabase([record])
    vi.mocked(supabaseAdmin.getSupabaseAdmin).mockReturnValue(
      mockSupabase as unknown as ReturnType<
        typeof supabaseAdmin.getSupabaseAdmin
      >,
    )
    vi.mocked(fal.queue.status).mockResolvedValue({
      status: 'IN_QUEUE',
    } as unknown as Awaited<ReturnType<typeof fal.queue.status>>)

    const result = (await getHandler()({
      data: { accessToken: 'tok' },
    })) as Record<string, number>

    expect(result.completed).toBe(0)
    expect(result.failed).toBe(0)
    expect(falCompletion.processImageResult).not.toHaveBeenCalled()
    expect(falCompletion.markGenerationFailedWithBlob).not.toHaveBeenCalled()
  })

  it('processes second record even when first throws a non-FAL network error', async () => {
    const rec1 = makePendingRecord({ id: 'rec-001', request_id: 'req-001' })
    const rec2 = makePendingRecord({ id: 'rec-002', request_id: 'req-002' })
    const mockSupabase = makeMockSupabase([rec1, rec2])
    vi.mocked(supabaseAdmin.getSupabaseAdmin).mockReturnValue(
      mockSupabase as unknown as ReturnType<
        typeof supabaseAdmin.getSupabaseAdmin
      >,
    )
    vi.mocked(fal.queue.status)
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce({
        status: 'COMPLETED',
      } as unknown as Awaited<ReturnType<typeof fal.queue.status>>)
    vi.mocked(fal.queue.result).mockResolvedValue({
      data: {},
    } as unknown as Awaited<ReturnType<typeof fal.queue.result>>)

    const result = (await getHandler()({
      data: { accessToken: 'tok' },
    })) as Record<string, number>

    expect(result.completed).toBe(1)
    expect(result.failed).toBe(0)
    expect(falCompletion.processImageResult).toHaveBeenCalledOnce()
  })
})
