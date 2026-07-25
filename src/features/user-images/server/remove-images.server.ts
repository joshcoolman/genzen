import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { createImageStorage } from '@/lib/image-storage'

interface RemoveImagesInput {
  accessToken: string
  storagePaths: Array<string>
}

export const removeImages = createServerFn({ method: 'POST' })
  .inputValidator((data: RemoveImagesInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    // Verify all paths belong to this user
    for (const path of data.storagePaths) {
      if (!path.startsWith(`${user.id}/`)) {
        throw new Error(
          'Storage paths must be scoped to the authenticated user',
        )
      }
    }

    if (data.storagePaths.length === 0) return
    const storage = createImageStorage()
    await storage.remove(data.storagePaths)
  })
