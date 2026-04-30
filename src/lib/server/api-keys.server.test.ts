import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  API_KEY_PREFIX,
  createApiKey,
  generateRawApiKey,
  hashApiKey,
  revokeApiKey,
  verifyApiKey,
} from './api-keys.server'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Row {
  id: string
  user_id: string
  name: string
  key_hash: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

function makeMockClient(rows: Array<Row> = []) {
  function from(_table: string) {
    type Filter = [string, unknown]
    let mode: 'select' | 'insert' | 'update' | null = null
    let payload: Record<string, unknown> | null = null
    const filters: Array<Filter> = []

    const apply = () =>
      rows.filter((r) =>
        filters.every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
        ),
      )

    const builder: Record<string, unknown> = {
      insert(row: Record<string, unknown>) {
        mode = 'insert'
        payload = row
        return builder
      },
      select() {
        if (mode !== 'insert' && mode !== 'update') mode = 'select'
        return builder
      },
      eq(col: string, val: unknown) {
        filters.push([col, val])
        return builder
      },
      order() {
        return builder
      },
      update(patch: Record<string, unknown>) {
        mode = 'update'
        payload = patch
        return builder
      },
      single() {
        if (mode === 'insert' && payload) {
          const fullRow: Row = {
            id: randomUUID(),
            created_at: new Date().toISOString(),
            last_used_at: null,
            revoked_at: null,
            ...(payload as Partial<Row>),
          } as Row
          rows.push(fullRow)
          return Promise.resolve({ data: fullRow, error: null })
        }
        return Promise.resolve({ data: apply()[0] ?? null, error: null })
      },
      maybeSingle() {
        return Promise.resolve({ data: apply()[0] ?? null, error: null })
      },
      then(
        onFulfilled: (v: { data: unknown; error: null }) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) {
        if (mode === 'update' && payload) {
          for (const r of apply()) Object.assign(r, payload)
          return Promise.resolve({ data: null, error: null }).then(
            onFulfilled,
            onRejected,
          )
        }
        return Promise.resolve({ data: apply(), error: null }).then(
          onFulfilled,
          onRejected,
        )
      },
    }
    return builder
  }

  return { client: { from } as unknown as SupabaseClient, rows }
}

describe('hashApiKey', () => {
  it('produces a deterministic 64-char hex digest', () => {
    const a = hashApiKey('gz_live_test')
    const b = hashApiKey('gz_live_test')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different hashes for different inputs', () => {
    expect(hashApiKey('a')).not.toBe(hashApiKey('b'))
  })
})

describe('generateRawApiKey', () => {
  it('returns a unique key with the gz_live_ prefix', () => {
    const a = generateRawApiKey()
    const b = generateRawApiKey()
    expect(a.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(API_KEY_PREFIX.length + 32)
  })
})

describe('verifyApiKey', () => {
  it('round-trips a created key back to the same user', async () => {
    const { client } = makeMockClient()
    const userId = randomUUID()
    const { rawKey } = await createApiKey({
      userId,
      name: 'test',
      client,
    })
    const result = await verifyApiKey({ rawKey, client })
    expect(result.userId).toBe(userId)
  })

  it('rejects keys with an invalid prefix without hitting the DB', async () => {
    const { client } = makeMockClient()
    await expect(
      verifyApiKey({ rawKey: 'not_a_real_key', client }),
    ).rejects.toThrow(/invalid api key/i)
  })

  it('rejects unknown keys', async () => {
    const { client } = makeMockClient()
    const userId = randomUUID()
    await createApiKey({ userId, name: 'test', client })
    const stranger = generateRawApiKey()
    await expect(verifyApiKey({ rawKey: stranger, client })).rejects.toThrow(
      /invalid api key/i,
    )
  })

  it('rejects revoked keys', async () => {
    const { client } = makeMockClient()
    const userId = randomUUID()
    const { rawKey, row } = await createApiKey({
      userId,
      name: 'test',
      client,
    })
    await revokeApiKey({ userId, id: row.id, client })
    await expect(verifyApiKey({ rawKey, client })).rejects.toThrow(/revoked/i)
  })
})
