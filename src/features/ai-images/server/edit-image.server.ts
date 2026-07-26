'use server'

import type { EditImageInput } from './edit-image-internal.server'

export async function editImage(data: EditImageInput) {
  const { editImageInternal } = await import('./edit-image-internal.server')
  return editImageInternal(data)
}
