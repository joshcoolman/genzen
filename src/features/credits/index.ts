import { SupabaseCreditRepository } from './supabase-repository'
import type { CreditRepository } from './types'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'

export type { CreditRepository } from './types'
export {
  CREDIT_COSTS,
  CREDIT_REASONS,
  CreditReasonSchema,
  DOLLARS_PER_CREDIT,
  computeGenerationCostCents,
} from './types'
export type {
  CreditReason,
  CreditTransaction,
  DeductionReason,
  UsageStats,
} from './types'

export function getCreditRepository(): CreditRepository {
  return new SupabaseCreditRepository(getSupabaseAdmin())
}
