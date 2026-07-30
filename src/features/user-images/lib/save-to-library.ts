'use client'

import { createImageRecord } from '../server/images.actions'
import { removeImages } from '../server/remove-images.server'
import { uploadImage } from '../server/upload-image.server'
import type { UserImage } from '../types'

/** Exported for the other upload path in this feature, which #215 folds in. */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export interface SaveToLibraryInput {
  userId: string
  file: File
  title: string
  description?: string | null
  /** Optional: hashing is best-effort, and a row without one is still valid. */
  fileHash?: string
}

/** Put a file in the library: object to storage, then the row.
 *
 *  Standalone rather than a hook so a caller that only needs to *write* one
 *  image does not have to mount `useUserImages`, which fetches the whole
 *  library on mount. Two callers already did that on the same page.
 *
 *  Storage first, row second, with a rollback: a row without an object is a
 *  card that can never render, which is worse than an orphaned object. */
export async function saveFileToLibrary({
  userId,
  file,
  title,
  description = null,
  fileHash,
}: SaveToLibraryInput): Promise<UserImage> {
  if (!userId) throw new Error('User not authenticated')

  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `${userId}/${Date.now()}_${crypto.randomUUID()}_${sanitizedFileName}`

  await uploadImage({
    storagePath,
    base64Data: await fileToBase64(file),
    contentType: file.type,
  })

  try {
    return await createImageRecord({
      title,
      description,
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileHash,
    })
  } catch (insertError) {
    // Rollback, or the object is orphaned in storage with nothing pointing at it.
    await removeImages({ storagePaths: [storagePath] }).catch(() => {})
    throw new Error(
      `Failed to create image record: ${(insertError as Error).message}`,
    )
  }
}
