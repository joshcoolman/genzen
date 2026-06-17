import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import after mocks are declared
import * as addCreditsModule from './add-credits.server'
import {
  checkAndDeductCredits,
  refundCredits,
  withCreditRefund,
} from './check-credits.server'
import * as creditsModule from '@/features/credits'

// vi.mock is hoisted — define everything inside the factory
vi.mock('./add-credits.server', () => ({
  addCreditsInternal: vi.fn(),
}))

vi.mock('@/features/credits', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  type CreditsModule = typeof import('@/features/credits')
  const actual = await importOriginal<CreditsModule>()
  return {
    ...actual,
    getCreditRepository: vi.fn(),
  }
})

vi.mock('@/lib/server/auth.server', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-123' }),
}))

function makeMockRepo() {
  return {
    deductCredits: vi.fn(),
    addCredits: vi.fn(),
    getBalance: vi.fn(),
    getTransactions: vi.fn(),
    getUsageStats: vi.fn(),
  }
}

describe('checkAndDeductCredits', () => {
  let mockRepo: ReturnType<typeof makeMockRepo>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo = makeMockRepo()
    vi.mocked(creditsModule.getCreditRepository).mockReturnValue(
      mockRepo as unknown as ReturnType<
        typeof creditsModule.getCreditRepository
      >,
    )
  })

  it('returns allowed:true with balance when deduction succeeds', async () => {
    mockRepo.deductCredits.mockResolvedValue({ success: true, balance: 9 })

    const result = await checkAndDeductCredits(
      { userId: 'user-123' },
      'image_gen',
    )

    expect(result).toEqual({
      allowed: true,
      balance: 9,
      cost: 1,
      userId: 'user-123',
    })
    expect(mockRepo.deductCredits).toHaveBeenCalledWith(
      'user-123',
      1,
      'image_gen',
    )
  })

  it('returns allowed:false when balance is insufficient', async () => {
    mockRepo.deductCredits.mockResolvedValue({ success: false, balance: 0 })

    const result = await checkAndDeductCredits(
      { userId: 'user-123' },
      'image_gen',
    )

    expect(result).toEqual({
      allowed: false,
      balance: 0,
      cost: 1,
      userId: 'user-123',
    })
  })

  it('applies quantity multiplier to cost', async () => {
    mockRepo.deductCredits.mockResolvedValue({ success: true, balance: 90 })

    const result = await checkAndDeductCredits(
      { userId: 'user-123' },
      'video_gen',
      2,
    )

    // video_gen costs 5 per unit, quantity 2 = 10
    expect(result.cost).toBe(10)
    expect(mockRepo.deductCredits).toHaveBeenCalledWith(
      'user-123',
      10,
      'video_gen',
    )
  })
})

describe('withCreditRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns inner function result when it succeeds, without calling addCreditsInternal', async () => {
    const result = await withCreditRefund(
      'user-123',
      1,
      'image_gen',
      async () => 'result',
    )

    expect(result).toBe('result')
    expect(addCreditsModule.addCreditsInternal).not.toHaveBeenCalled()
  })

  it('calls addCreditsInternal with correct args and rethrows when inner fn throws', async () => {
    vi.mocked(addCreditsModule.addCreditsInternal).mockResolvedValue({
      balance: 11,
    })

    await expect(
      withCreditRefund('user-123', 1, 'image_gen', async () => {
        throw new Error('generation failed')
      }),
    ).rejects.toThrow('generation failed')

    expect(addCreditsModule.addCreditsInternal).toHaveBeenCalledOnce()
    expect(addCreditsModule.addCreditsInternal).toHaveBeenCalledWith(
      'user-123',
      1,
      'image_gen',
    )
  })
})

describe('refundCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to addCreditsInternal with correct arguments', async () => {
    vi.mocked(addCreditsModule.addCreditsInternal).mockResolvedValue({
      balance: 15,
    })

    await refundCredits('user-123', 5, 'video_gen')

    expect(addCreditsModule.addCreditsInternal).toHaveBeenCalledOnce()
    expect(addCreditsModule.addCreditsInternal).toHaveBeenCalledWith(
      'user-123',
      5,
      'video_gen',
    )
  })
})
