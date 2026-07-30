'use client'

import { createThumbnail } from '../server/create-thumbnail.server'
import { createImageRecord } from '../server/images.actions'
import { removeImages } from '../server/remove-images.server'
import { uploadImage } from '../server/upload-image.server'
import type { UserImage } from '../types'

async function fileToBase64(file: File): Promise<string> {
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

/** Put a file in the library: object to storage, then the row, then a thumbnail.
 *
 *  **The only way a file enters the library.** There were three of these and
 *  only one made a thumbnail (#215), so whether a grid downloaded full-size
 *  objects came down to which caller you happened to go through. A thumbnail is
 *  not a caller's decision, so it lives here.
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
    const image = await createImageRecord({
      title,
      description,
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileHash,
    })

    // Background, and failure is tolerated: reads fall back to the full-size
    // object, so a missing thumbnail is slower, never broken.
    void createThumbnail({ imageId: image.id, storagePath }).catch(() => {})

    return image
  } catch (insertError) {
    // Rollback, or the object is orphaned in storage with nothing pointing at it.
    await removeImages({ storagePaths: [storagePath] }).catch(() => {})
    throw new Error(
      `Failed to create image record: ${(insertError as Error).message}`,
    )
  }
}
