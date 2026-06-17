import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRpc = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}))

// Import after mock is set up
const { checkRateLimit } = await import('./rate-limit.server')

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  it('Test A — resolves without throwing when RPC returns allowed=true', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    await expect(checkRateLimit('user-123', 'image')).resolves.toBeUndefined()
  })

  it('Test B — throws "Rate limited" when RPC returns allowed=false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    await expect(checkRateLimit('user-123', 'image')).rejects.toThrow(
      /Rate limited/,
    )
  })

  it('Test C — throws "temporarily unavailable" when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'connection timeout' },
    })
    await expect(checkRateLimit('user-123', 'image')).rejects.toThrow(
      /temporarily unavailable/,
    )
  })

  it('Test C (negative) — infra error does not throw "Rate limited"', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'connection timeout' },
    })
    await expect(checkRateLimit('user-123', 'image')).rejects.not.toThrow(
      /Rate limited/,
    )
  })
})
