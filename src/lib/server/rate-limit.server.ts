import { createClient } from '@supabase/supabase-js'

const LIMITS = {
  image: { maxRequests: 20, windowSeconds: 60 },
} as const

type LimitType = keyof typeof LIMITS

/**
 * Check rate limit for a user. Throws if rate limited.
 * Uses atomic Postgres RPC with a rolling window stored in user_profiles.
 */
export async function checkRateLimit(
  userId: string,
  type: LimitType,
): Promise<void> {
  const { maxRequests, windowSeconds } = LIMITS[type]

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: allowed, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: userId,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error(
      `[rate-limit] RPC check_rate_limit failed for user=${userId} type=${type}: ${error.message}`,
    )
    throw new Error(
      'Rate limit check temporarily unavailable. Please try again in a moment.',
    )
  }

  if (!allowed) {
    console.warn(
      `[rate-limit] user=${userId} type=${type} rate limited (>${maxRequests} requests in ${windowSeconds}s)`,
    )
    throw new Error(
      `Rate limited: too many ${type} generation requests. Please wait a moment and try again.`,
    )
  }
}
