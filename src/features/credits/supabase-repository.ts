import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreditReason,
  CreditRepository,
  CreditTransaction,
  UsageStats,
} from './types'

export class SupabaseCreditRepository implements CreditRepository {
  constructor(private supabase: SupabaseClient) {}

  async getBalance(userId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('get_credit_balance', {
      p_user_id: userId,
    })

    if (error) throw new Error(`Failed to get balance: ${error.message}`)
    return data as number
  }

  async deductCredits(
    userId: string,
    amount: number,
    reason: CreditReason,
  ): Promise<{ success: boolean; balance: number }> {
    const { data, error } = await this.supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
    })

    if (error) throw new Error(`Failed to deduct credits: ${error.message}`)

    const row = data[0]
    return { success: row.success, balance: row.new_balance }
  }

  async addCredits(
    userId: string,
    amount: number,
    reason: CreditReason,
    stripeEventId?: string,
  ): Promise<{ balance: number }> {
    const { data, error } = await this.supabase.rpc('add_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_stripe_event_id: stripeEventId ?? null,
    })

    if (error) {
      // Rethrow PostgrestError directly so callers can detect unique-violation
      // (code '23505') for stripe_event_id idempotency.
      throw error
    }
    return { balance: data as number }
  }

  async getTransactions(
    userId: string,
    limit = 20,
  ): Promise<Array<CreditTransaction>> {
    const { data, error } = await this.supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to get transactions: ${error.message}`)

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      reason: row.reason as CreditReason,
      balanceAfter: row.balance_after,
      createdAt: row.created_at,
    }))
  }

  async getUsageStats(userId: string): Promise<UsageStats> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const { data, error } = await this.supabase
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('user_id', userId)
      .lt('amount', 0)
      .gte('created_at', startOfMonth.toISOString())

    if (error) throw new Error(`Failed to get usage stats: ${error.message}`)

    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    )
    const totalSpent = data.reduce((sum, row) => sum + Math.abs(row.amount), 0)
    const todaySpent = data
      .filter((row) => new Date(row.created_at) >= startOfDay)
      .reduce((sum, row) => sum + Math.abs(row.amount), 0)
    const dayOfMonth = now.getDate()
    const dailyAverage =
      dayOfMonth > 0 ? Math.round(totalSpent / dayOfMonth) : 0

    return { today: todaySpent, thisMonth: totalSpent, dailyAverage }
  }
}
