import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import after mocks
import * as h3 from 'h3'
import handler from './stripe-webhook.post'
import type { H3Event } from 'h3'
import * as addCreditsModule from '@/features/credits/server/add-credits.server'
import * as stripeServer from '@/lib/server/stripe.server'

// vi.mock is hoisted — all factories must use only vi.fn() inside, no outer refs
vi.mock('h3', () => ({
  defineEventHandler: (fn: (event: unknown) => Promise<unknown>) => fn,
  getHeader: vi.fn().mockReturnValue('sig-123'),
  readRawBody: vi.fn().mockResolvedValue('raw-body'),
  setResponseStatus: vi.fn(),
}))

vi.mock('@/features/credits/server/add-credits.server', () => ({
  addCreditsInternal: vi.fn(),
}))

vi.mock('@/lib/server/stripe.server', () => ({
  getStripe: vi.fn(),
}))
const fakeEvent = {} as H3Event

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_123',
    client_reference_id: 'user-abc',
    payment_status: 'paid',
    metadata: { pack_credits: '200' },
    ...overrides,
  }
}

describe('stripe-webhook handler', () => {
  const mockConstructEvent = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    vi.mocked(stripeServer.getStripe).mockReturnValue({
      webhooks: { constructEvent: mockConstructEvent },
    } as unknown as ReturnType<typeof stripeServer.getStripe>)
    vi.mocked(h3.readRawBody).mockResolvedValue('raw-body')
    vi.mocked(h3.getHeader).mockReturnValue('sig-123')
  })

  it('grants credits and returns OK on valid paid checkout.session.completed', async () => {
    const session = makeSession()
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      id: 'evt_001',
      data: { object: session },
    })
    vi.mocked(addCreditsModule.addCreditsInternal).mockResolvedValue({
      balance: 210,
    })

    const result = await handler(fakeEvent)

    expect(result).toBe('OK')
    expect(addCreditsModule.addCreditsInternal).toHaveBeenCalledOnce()
    expect(addCreditsModule.addCreditsInternal).toHaveBeenCalledWith(
      'user-abc',
      200,
      'pack_purchase',
      'evt_001',
    )
    expect(h3.setResponseStatus).not.toHaveBeenCalled()
  })

  it('returns Unauthorized and sets 401 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Signature mismatch')
    })

    const result = await handler(fakeEvent)

    expect(result).toBe('Unauthorized')
    expect(h3.setResponseStatus).toHaveBeenCalledWith(fakeEvent, 401)
    expect(addCreditsModule.addCreditsInternal).not.toHaveBeenCalled()
  })

  it('returns OK without double-granting on duplicate event (23505)', async () => {
    const session = makeSession()
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      id: 'evt_dup',
      data: { object: session },
    })
    vi.mocked(addCreditsModule.addCreditsInternal).mockRejectedValue({
      code: '23505',
    })

    const result = await handler(fakeEvent)

    expect(result).toBe('OK')
    expect(addCreditsModule.addCreditsInternal).toHaveBeenCalledOnce()
  })

  it('does not grant credits and returns OK when payment_status is not paid', async () => {
    const session = makeSession({ payment_status: 'unpaid' })
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      id: 'evt_002',
      data: { object: session },
    })

    const result = await handler(fakeEvent)

    expect(result).toBe('OK')
    expect(addCreditsModule.addCreditsInternal).not.toHaveBeenCalled()
  })

  it('returns Server misconfigured and sets 500 when STRIPE_WEBHOOK_SECRET is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    const result = await handler(fakeEvent)

    expect(result).toBe('Server misconfigured')
    expect(h3.setResponseStatus).toHaveBeenCalledWith(fakeEvent, 500)
    expect(addCreditsModule.addCreditsInternal).not.toHaveBeenCalled()
  })
})
