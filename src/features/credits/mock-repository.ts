import type {
  CreditReason,
  CreditRepository,
  CreditTransaction,
  UsageStats,
} from './types'

let balance = 47

const transactions: Array<CreditTransaction> = [
  {
    id: 'tx-init',
    userId: 'mock',
    amount: 50,
    reason: 'initial_grant',
    balanceAfter: 50,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'tx-1',
    userId: 'mock',
    amount: -1,
    reason: 'image_gen',
    balanceAfter: 49,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'tx-2',
    userId: 'mock',
    amount: -1,
    reason: 'variation',
    balanceAfter: 48,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'tx-3',
    userId: 'mock',
    amount: -1,
    reason: 'edit',
    balanceAfter: 47,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
]

let txCounter = 4

export class MockCreditRepository implements CreditRepository {
  // eslint-disable-next-line @typescript-eslint/require-await
  async getBalance(): Promise<number> {
    return balance
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async deductCredits(
    amount: number,
    reason: CreditReason,
  ): Promise<{ success: boolean; balance: number }> {
    if (balance < amount) {
      return { success: false, balance }
    }
    balance -= amount
    transactions.push({
      id: `tx-${txCounter++}`,
      userId: 'mock',
      amount: -amount,
      reason,
      balanceAfter: balance,
      createdAt: new Date().toISOString(),
    })
    return { success: true, balance }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async addCredits(
    amount: number,
    reason: CreditReason,
  ): Promise<{ balance: number }> {
    balance += amount
    transactions.push({
      id: `tx-${txCounter++}`,
      userId: 'mock',
      amount,
      reason,
      balanceAfter: balance,
      createdAt: new Date().toISOString(),
    })
    return { balance }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getTransactions(limit = 20): Promise<Array<CreditTransaction>> {
    return [...transactions].reverse().slice(0, limit)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getUsageStats(): Promise<UsageStats> {
    return { thisMonth: 53, dailyAverage: 4 }
  }
}
