import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'
import { createImageStorage } from '@/lib/image-storage'

interface UploadImageInput {
  accessToken: string
  storagePath: string
  base64Data: string
  contentType: string
}

export const uploadImage = createServerFn({ method: 'POST' })
  .inputValidator((data: UploadImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    // Verify the storage path belongs to this user
    if (!data.storagePath.startsWith(`${user.id}/`)) {
      throw new Error('Storage path must be scoped to the authenticated user')
    }

    const buffer = Buffer.from(data.base64Data, 'base64')
    const supabase = getSupabaseAdmin()
    const storage = createImageStorage(supabase)

    await storage.upload(data.storagePath, buffer, {
      contentType: data.contentType,
    })

    return { storagePath: data.storagePath }
  })
