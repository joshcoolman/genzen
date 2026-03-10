import { createServerFn } from '@tanstack/react-start'
import { describeImage } from '@/lib/server/describe-image.server'
import { requireAuth } from '@/lib/server/auth.server'

interface DescribeShotImageInput {
  imageUrl: string
  accessToken: string
}

export const describeShotImage = createServerFn({ method: 'POST' })
  .inputValidator((data: DescribeShotImageInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)
    const description = await describeImage(data.imageUrl, 'reconstruct')
    return { description }
  })
