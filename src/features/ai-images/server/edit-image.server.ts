import { createServerFn } from '@tanstack/react-start'
import type { EditImageInput } from './edit-image-internal.server'

export const editImage = createServerFn({ method: 'POST' })
  .inputValidator((data: EditImageInput) => data)
  .handler(async ({ data }) => {
    const { editImageInternal } = await import('./edit-image-internal.server')
    return editImageInternal(data)
  })
