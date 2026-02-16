/**
 * FAL AI credit provider implementation
 * Fetches balance from FAL's API
 */

import type { CreditProvider, CreditBalance, UsageMetadata } from './types'

export class FALCreditProvider implements CreditProvider {
  readonly providerName = 'FAL AI'
  private apiKey: string
  private baseUrl = 'https://queue.fal.run'

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.FAL_KEY ?? ''
    if (!this.apiKey) {
      throw new Error('FAL_KEY is required for FALCreditProvider')
    }
  }

  async getBalance(): Promise<CreditBalance> {
    try {
      // Try the account/balance endpoint
      // FAL's API structure: https://fal.ai/docs/api-reference
      const response = await fetch(`${this.baseUrl}/account/balance`, {
        headers: {
          Authorization: `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        // If that doesn't work, try alternative endpoint
        const altResponse = await fetch('https://rest.alpha.fal.ai/balance', {
          headers: {
            Authorization: `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        })

        if (!altResponse.ok) {
          throw new Error(
            `FAL balance API returned ${altResponse.status}: ${await altResponse.text()}`,
          )
        }

        const data = await altResponse.json()
        return this.parseBalanceResponse(data)
      }

      const data = await response.json()
      return this.parseBalanceResponse(data)
    } catch (error) {
      console.error('Failed to fetch FAL balance:', error)
      throw new Error(
        `Failed to get FAL balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  private parseBalanceResponse(data: any): CreditBalance {
    // FAL might return balance in different formats
    // Adjust based on actual API response
    if (typeof data.balance === 'number') {
      return {
        balance: data.balance,
        currency: data.currency ?? 'USD',
        lastUpdated: new Date(),
        metadata: data,
      }
    }

    if (typeof data.credits === 'number') {
      return {
        balance: data.credits,
        currency: 'credits',
        lastUpdated: new Date(),
        metadata: data,
      }
    }

    // If we can't parse it, return the raw data for debugging
    console.warn('Unexpected FAL balance response format:', data)
    return {
      balance: 0,
      currency: 'USD',
      lastUpdated: new Date(),
      metadata: data,
    }
  }

  async trackUsage(metadata: UsageMetadata): Promise<void> {
    // For now, just log usage
    // In production, you might want to store this in Supabase
    console.log('[FAL Usage]', metadata)

    // Future: Store in database for analytics
    // await supabase.from('usage_tracking').insert({
    //   provider: 'fal',
    //   type: metadata.type,
    //   cost: metadata.cost,
    //   user_id: metadata.userId,
    //   details: metadata.details,
    // })
  }
}
