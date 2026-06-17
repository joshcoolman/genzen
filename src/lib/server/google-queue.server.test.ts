import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dispatchGoogleQueue } from './google-queue.server'
import { refundCredits } from '@/features/credits/server/check-credits.server'
import { generateWithGoogle } from '@/lib/server/google-imagen.server'

vi.mock('@/features/credits/server/check-credits.server', () => ({
  refundCredits: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/server/google-imagen.server', () => ({
  generateWithGoogle: vi.fn(),
  editWithGoogle: vi.fn(),
}))

vi.mock('@/lib/server/generate-thumbnail.server', () => ({
  generateThumbnailInBackground: vi.fn(),
}))

vi.mock('@/lib/image-storage', () => ({
  createImageStorage: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/lib/server/provider-retry.server', () => ({
  withProviderRetry: vi.fn((_provider: string, fn: () => unknown) => fn()),
}))

vi.mock('@/features/ai-images/models', () => ({
  getModelName: vi.fn(() => 'Test Model'),
}))

function makeMockSupabase(
  records: Array<{
    id: string
    user_id: string
    generation_metadata: Record<string, unknown>
  }>,
  updateError: { message: string } | null = null,
) {
  const updates: Array<{
    payload: Record<string, unknown>
    filters: Array<[string, unknown]>
  }> = []

  function from(_table: string) {
    type Filter = [string, unknown]
    const filters: Array<Filter> = []
    let updatePayload: Record<string, unknown> | null = null

    const builder: Record<string, unknown> = {
      update(patch: Record<string, unknown>) {
        updatePayload = patch
        return builder
      },
      eq(col: string, val: unknown) {
        filters.push([col, val])
        return builder
      },
      then(
        onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) {
        if (updatePayload) {
          updates.push({ payload: updatePayload, filters })
          return Promise.resolve({ data: null, error: updateError }).then(
            onFulfilled,
            onRejected,
          )
        }
        return Promise.resolve({ data: null, error: null }).then(
          onFulfilled,
          onRejected,
        )
      },
    }
    return builder
  }

  function rpc(_name: string, _args: unknown) {
    return Promise.resolve({ data: records, error: null })
  }

  return { supabase: { from, rpc } as unknown, updates }
}

describe('dispatchGoogleQueue — credit refund on failure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls refundCredits with (userId, 1, "image_gen") when Google generation throws', async () => {
    const record = {
      id: 'rec-1',
      user_id: 'user-abc',
      generation_metadata: { prompt: 'a cat', model: 'google/imagen' },
    }

    vi.mocked(generateWithGoogle).mockRejectedValueOnce(
      new Error('Google API error'),
    )

    const { supabase, updates } = makeMockSupabase([record])
    await dispatchGoogleQueue(supabase)

    expect(refundCredits).toHaveBeenCalledOnce()
    expect(refundCredits).toHaveBeenCalledWith('user-abc', 1, 'image_gen')

    const failUpdate = updates.find((u) => u.payload.status === 'failed')
    expect(failUpdate).toBeDefined()
    expect(failUpdate!.payload.generation_error).toBe('Google API error')
  })

  it('does NOT call refundCredits when Google generation succeeds', async () => {
    const record = {
      id: 'rec-2',
      user_id: 'user-def',
      generation_metadata: { prompt: 'a dog', model: 'google/imagen' },
    }

    vi.mocked(generateWithGoogle).mockResolvedValueOnce({
      imageBase64: Buffer.from('fake-image').toString('base64'),
    })

    const { supabase, updates } = makeMockSupabase([record])
    await dispatchGoogleQueue(supabase)

    expect(refundCredits).not.toHaveBeenCalled()

    const completedUpdate = updates.find(
      (u) => u.payload.status === 'completed',
    )
    expect(completedUpdate).toBeDefined()
  })

  it('logs refund error and still updates status to failed when refundCredits throws', async () => {
    const record = {
      id: 'rec-3',
      user_id: 'user-ghi',
      generation_metadata: { prompt: 'a bird', model: 'google/imagen' },
    }

    vi.mocked(generateWithGoogle).mockRejectedValueOnce(
      new Error('Google API error'),
    )
    vi.mocked(refundCredits).mockRejectedValueOnce(new Error('DB unavailable'))

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const { supabase, updates } = makeMockSupabase([record])
    await dispatchGoogleQueue(supabase)

    // refund was attempted
    expect(refundCredits).toHaveBeenCalledOnce()

    // refund error was logged
    const refundLog = consoleSpy.mock.calls.find((args) =>
      String(args[0]).includes('refund failed'),
    )
    expect(refundLog).toBeDefined()

    // status update still happened
    const failUpdate = updates.find((u) => u.payload.status === 'failed')
    expect(failUpdate).toBeDefined()

    consoleSpy.mockRestore()
  })
})
