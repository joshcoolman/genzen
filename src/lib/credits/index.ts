/**
 * Credit system - Clean architecture for provider-agnostic credit management
 *
 * Current: FAL AI credits
 * Future: GenZen credits, BYOK (Bring Your Own Key)
 */

export type { CreditProvider, CreditBalance, UsageMetadata } from './types'
export { FALCreditProvider } from './fal-provider.server'
export { getCreditBalance } from './get-balance.server'
