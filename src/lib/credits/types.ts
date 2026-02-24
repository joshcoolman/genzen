/**
 * Credit system types and interfaces
 * Clean architecture: provider-agnostic credit management
 */

export interface CreditBalance {
  /** Current credit balance */
  balance: number
  /** Currency or unit (e.g., "USD", "credits") */
  currency: string
  /** Optional: When balance was last updated */
  lastUpdated?: Date
  /** Optional: Provider-specific metadata */
  metadata?: Record<string, unknown>
}

export interface UsageMetadata {
  /** Type of operation (e.g., "image_generation", "prompt_enhancement") */
  type: string
  /** Cost in provider's units */
  cost: number
  /** User who performed the operation */
  userId?: string
  /** Additional context (model, prompt, etc.) */
  details?: Record<string, unknown>
}

/**
 * Abstract credit provider interface
 * Implementations: FAL, GenZen credits, etc.
 */
export interface CreditProvider {
  /** Get current credit balance */
  getBalance: () => Promise<CreditBalance>

  /** Track usage (for analytics/billing) */
  trackUsage: (metadata: UsageMetadata) => Promise<void>

  /** Optional: Get usage history */
  getUsageHistory?: (limit?: number) => Promise<Array<UsageMetadata>>

  /** Provider name for display */
  readonly providerName: string
}
