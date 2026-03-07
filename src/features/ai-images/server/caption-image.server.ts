import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { describeImage } from '@/lib/server/describe-image.server'

interface CaptionImageInput {
  imageBase64: string
  accessToken: string
}

export const captionImage = createServerFn({ method: 'POST' })
  .inputValidator((data: CaptionImageInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const result = await describeImage(data.imageBase64, 'anchor')

    return { caption: result }
  })
