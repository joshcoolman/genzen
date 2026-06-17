import { describe, expect, it, vi } from 'vitest'
import { SupabaseCreditRepository } from './supabase-repository'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeMockSupabase(rpcResult: unknown) {
  const rpcFn = vi.fn().mockResolvedValue(rpcResult)
  const client = {
    rpc: rpcFn,
  } as unknown as SupabaseClient
  return { client, rpcFn }
}

describe('SupabaseCreditRepository.deductCredits', () => {
  it('returns success:true and balance when RPC reports allowed', async () => {
    const { client } = makeMockSupabase({
      data: [{ success: true, new_balance: 9 }],
      error: null,
    })
    const repo = new SupabaseCreditRepository(client)

    const result = await repo.deductCredits('user-123', 1, 'image_gen')

    expect(result).toEqual({ success: true, balance: 9 })
  })

  it('returns success:false and balance when RPC reports insufficient', async () => {
    const { client } = makeMockSupabase({
      data: [{ success: false, new_balance: 0 }],
      error: null,
    })
    const repo = new SupabaseCreditRepository(client)

    const result = await repo.deductCredits('user-123', 1, 'image_gen')

    expect(result).toEqual({ success: false, balance: 0 })
  })

  it('throws when RPC returns an error', async () => {
    const { client } = makeMockSupabase({
      data: null,
      error: { message: 'rpc error' },
    })
    const repo = new SupabaseCreditRepository(client)

    await expect(
      repo.deductCredits('user-123', 1, 'image_gen'),
    ).rejects.toThrow('rpc error')
  })
})

describe('SupabaseCreditRepository.addCredits', () => {
  it('returns balance when RPC succeeds', async () => {
    const { client } = makeMockSupabase({
      data: 11,
      error: null,
    })
    const repo = new SupabaseCreditRepository(client)

    const result = await repo.addCredits('user-123', 1, 'pack_purchase')

    expect(result).toEqual({ balance: 11 })
  })

  it('passes stripeEventId to RPC when provided', async () => {
    const { client, rpcFn } = makeMockSupabase({
      data: 211,
      error: null,
    })
    const repo = new SupabaseCreditRepository(client)

    await repo.addCredits('user-abc', 200, 'pack_purchase', 'evt_123')

    expect(rpcFn).toHaveBeenCalledWith('add_credits', {
      p_user_id: 'user-abc',
      p_amount: 200,
      p_reason: 'pack_purchase',
      p_stripe_event_id: 'evt_123',
    })
  })

  it('passes null for p_stripe_event_id when not provided', async () => {
    const { client, rpcFn } = makeMockSupabase({
      data: 11,
      error: null,
    })
    const repo = new SupabaseCreditRepository(client)

    await repo.addCredits('user-123', 1, 'initial_grant')

    expect(rpcFn).toHaveBeenCalledWith('add_credits', {
      p_user_id: 'user-123',
      p_amount: 1,
      p_reason: 'initial_grant',
      p_stripe_event_id: null,
    })
  })

  it('throws the raw error (not wrapped) for idempotency code detection', async () => {
    const pgError = { code: '23505', message: 'duplicate key' }
    const { client } = makeMockSupabase({
      data: null,
      error: pgError,
    })
    const repo = new SupabaseCreditRepository(client)

    let thrown: unknown
    try {
      await repo.addCredits('user-123', 200, 'pack_purchase', 'evt_dup')
    } catch (err) {
      thrown = err
    }

    // Should rethrow the raw PostgrestError, not a wrapped Error instance
    expect(thrown).toBe(pgError)
  })
})
