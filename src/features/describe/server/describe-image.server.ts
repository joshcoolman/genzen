import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { describeImage as describeImageShared } from '@/lib/server/describe-image.server'

interface DescribeImageInput {
  imageUrl: string
  accessToken: string
}

export const describeImage = createServerFn({ method: 'POST' })
  .inputValidator((data: DescribeImageInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const result = await describeImageShared(data.imageUrl, 'reconstruct')

    return { description: result }
  })
