'use server'

import type { UploadImageInput } from './upload-image-internal.server'

export async function uploadImage(data: UploadImageInput) {
  const { uploadImageInternal } = await import('./upload-image-internal.server')
  return uploadImageInternal(data)
}
