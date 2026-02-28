import { SupabaseCreditRepository } from './supabase-repository'
import type { CreditRepository } from './types'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'

export type { CreditRepository } from './types'
export { CREDIT_COSTS, CREDIT_PACKS, DOLLARS_PER_CREDIT } from './types'
export type { CreditTransaction, CreditReason, UsageStats } from './types'

export function getCreditRepository(): CreditRepository {
  return new SupabaseCreditRepository(getSupabaseAdmin())
}
