export type CreditReason =
  | 'image_gen'
  | 'variation'
  | 'edit'
  | 'first_frame'
  | 'last_frame'
  | 'video_gen'
  | 'multishot_gen'
  | 'pack_purchase'
  | 'initial_grant'

export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  reason: CreditReason
  balanceAfter: number
  createdAt: string
}

export interface UsageStats {
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
  ) => Promise<{ balance: number }>
  getTransactions: (
    userId: string,
    limit?: number,
  ) => Promise<Array<CreditTransaction>>
  getUsageStats: (userId: string) => Promise<UsageStats>
}

export const CREDIT_COSTS: Record<string, number> = {
  image_gen: 1,
  variation: 1,
  edit: 1,
  first_frame: 1,
  last_frame: 1,
  video_gen: 5,
  multishot_gen: 5,
}

export const DOLLARS_PER_CREDIT = 0.1

export const CREDIT_PACKS = [
  { credits: 20, price: 2, description: 'Starter' },
  { credits: 40, price: 4, description: 'Creator' },
  { credits: 80, price: 8, description: 'Pro' },
  { credits: 160, price: 16, description: 'Studio' },
]
