import { resolveAuth } from '@/lib/server/auth.server'
import { createImageStorage } from '@/lib/image-storage'

function validateImageBuffer(buffer: Buffer): string {
  if (buffer.length > 50 * 1024 * 1024) throw new Error('File too large')
  const magic = buffer.subarray(0, 4)
  if (magic[0] === 0xff && magic[1] === 0xd8) return 'image/jpeg'
  if (
    magic[0] === 0x89 &&
    magic[1] === 0x50 &&
    magic[2] === 0x4e &&
    magic[3] === 0x47
  )
    return 'image/png'
  if (
    magic[0] === 0x52 &&
    magic[1] === 0x49 &&
    magic[2] === 0x46 &&
    magic[3] === 0x46
  )
    return 'image/webp'
  if (magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46)
    return 'image/gif'
  throw new Error('Invalid file type')
}

export interface UploadImageInput {
  userId?: string
  storagePath: string
  base64Data: string
  contentType: string
}

/**
 * Plain async implementation. See generateImageInternal docstring for
 * why this is split out from the createServerFn wrapper.
 */
export async function uploadImageInternal(
  data: UploadImageInput,
): Promise<{ storagePath: string }> {
  const { userId } = await resolveAuth()

  // Verify the storage path belongs to this user
  if (!data.storagePath.startsWith(`${userId}/`)) {
    throw new Error('Storage path must be scoped to the authenticated user')
  }

  const buffer = Buffer.from(data.base64Data, 'base64')
  const detectedType = validateImageBuffer(buffer)
  const storage = createImageStorage()

  await storage.upload(data.storagePath, buffer, {
    contentType: detectedType,
  })

  return { storagePath: data.storagePath }
}
