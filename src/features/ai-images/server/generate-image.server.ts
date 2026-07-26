'use server'

import type { GenerateImageInput } from './generate-image-internal.server'

export async function generateImage(data: GenerateImageInput) {
  const { generateImageInternal } =
    await import('./generate-image-internal.server')
  return generateImageInternal(data)
}
