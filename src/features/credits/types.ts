import { z } from 'zod'

export const CREDIT_REASONS = [
  'image_gen',
  'variation',
  'edit',
  'first_frame',
  'last_frame',
  'video_gen',
  'multishot_gen',
  'pack_purchase',
  'initial_grant',
] as const

export const CreditReasonSchema = z.enum(CREDIT_REASONS)

export type CreditReason = (typeof CREDIT_REASONS)[number]

export type DeductionReason = Extract<
  CreditReason,
  | 'image_gen'
  | 'variation'
  | 'edit'
  | 'first_frame'
  | 'last_frame'
  | 'video_gen'
  | 'multishot_gen'
>

export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  reason: CreditReason
  balanceAfter: number
  createdAt: string
}

export interface UsageStats {
  today: number
  thisMonth: number
  dailyAverage: number
}

export interface CreditRepository {
  getBalance: (userId: string) => Promise<number>
  deductCredits: (
    userId: string,
    amount: number,
    reason: CreditReason,
  ) => Promise<{ success: boolean; balance: number }>
  addCredits: (
    userId: string,
    amount: number,
    reason: CreditReason,
    stripeEventId?: string,
  ) => Promise<{ balance: number }>
  getTransactions: (
    userId: string,
    limit?: number,
  ) => Promise<Array<CreditTransaction>>
  getUsageStats: (userId: string) => Promise<UsageStats>
}

export const CREDIT_COSTS: Record<DeductionReason, number> = {
  image_gen: 1,
  variation: 1,
  edit: 1,
  first_frame: 1,
  last_frame: 1,
  video_gen: 5,
  multishot_gen: 5,
}

export const DOLLARS_PER_CREDIT = 0.1

export function computeGenerationCostCents(
  generationType: string,
): number | null {
  const credits = (CREDIT_COSTS as Record<string, number | undefined>)[
    generationType
  ]
  if (credits == null) return null
  return Math.round(credits * DOLLARS_PER_CREDIT * 100)
}

export const CREDIT_PACKS = [
  { credits: 200, price: 20, description: 'Starter' },
  { credits: 400, price: 40, description: 'Creator' },
  { credits: 600, price: 60, description: 'Pro' },
  { credits: 800, price: 80, description: 'Studio' },
]
