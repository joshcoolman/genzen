import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { addCreditsInternal } from './add-credits.server'
import { requireAuth } from '@/lib/server/auth.server'
import { CREDIT_PACKS } from '@/features/credits'

const PurchaseCreditsSchema = z.object({
  accessToken: z.string().min(1),
  packCredits: z.number().int().positive(),
})

export const purchaseCredits = createServerFn({ method: 'POST' })
  .inputValidator((data: z.infer<typeof PurchaseCreditsSchema>) =>
    PurchaseCreditsSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const pack = CREDIT_PACKS.find((p) => p.credits === data.packCredits)
    if (!pack) {
      throw new Error('Invalid credit pack')
    }

    const user = await requireAuth(data.accessToken)
    return addCreditsInternal(user.id, pack.credits, 'pack_purchase')
  })
