import { createServerFn } from '@tanstack/react-start'
import type { UploadImageInput } from './upload-image-internal.server'

export const uploadImage = createServerFn({ method: 'POST' })
  .inputValidator((data: UploadImageInput) => data)
  .handler(async ({ data }) => {
    const { uploadImageInternal } =
      await import('./upload-image-internal.server')
    return uploadImageInternal(data)
  })
