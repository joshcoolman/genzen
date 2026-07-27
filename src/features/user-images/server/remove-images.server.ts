'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { createImageStorage } from '#/lib/image-storage'

interface RemoveImagesInput {
  storagePaths: Array<string>
}

export async function removeImages(data: RemoveImagesInput) {
  const { userId } = await resolveAuth()

  // Verify all paths belong to this user
  for (const path of data.storagePaths) {
    if (!path.startsWith(`${userId}/`)) {
      throw new Error('Storage paths must be scoped to the authenticated user')
    }
  }

  if (data.storagePaths.length === 0) return
  const storage = createImageStorage()
  await storage.remove(data.storagePaths)
}
