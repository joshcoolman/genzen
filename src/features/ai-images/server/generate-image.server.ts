import { createServerFn } from '@tanstack/react-start'
import type { GenerateImageInput } from './generate-image-internal.server'

export const generateImage = createServerFn({ method: 'POST' })
  .inputValidator((data: GenerateImageInput) => data)
  .handler(async ({ data }) => {
    const { generateImageInternal } =
      await import('./generate-image-internal.server')
    return generateImageInternal(data)
  })
