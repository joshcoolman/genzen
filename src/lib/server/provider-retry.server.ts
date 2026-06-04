interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
}

export const PROVIDER_RETRY_CONFIG = {
  google: { maxAttempts: 4, baseDelayMs: 1000 },
} satisfies Record<string, RetryConfig>

type ProviderKey = keyof typeof PROVIDER_RETRY_CONFIG

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as Record<string, unknown>
  if (e.status === 429) return true
  const msg = typeof e.message === 'string' ? e.message : ''
  return msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
}

function backoffMs(attempt: number, baseDelayMs: number): number {
  // Exponential backoff with ±25% jitter to spread simultaneous retries
  const base = baseDelayMs * Math.pow(2, attempt)
  return Math.floor(base * (0.75 + Math.random() * 0.5))
}

export async function withProviderRetry<T>(
  provider: ProviderKey,
  fn: () => Promise<T>,
): Promise<T> {
  const { maxAttempts, baseDelayMs } = PROVIDER_RETRY_CONFIG[provider]

  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isRateLimitError(err) || attempt === maxAttempts - 1) throw err
      const delay = backoffMs(attempt, baseDelayMs)
      console.warn(
        `[provider-retry] ${provider} rate limited, attempt ${attempt + 1}/${maxAttempts}, retrying in ${delay}ms`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
