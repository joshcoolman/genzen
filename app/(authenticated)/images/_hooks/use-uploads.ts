'use client'

import { useCallback, useEffect } from 'react'
import type { GalleryState } from './use-gallery'
import type { SavedAiImage } from '#/features/ai-images/types'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { imageUrl } from '#/lib/image-url'

/** The placeholder a card shows while its bytes are still in flight. */
function skeletonCard(id: string, title: string): SavedAiImage {
  return {
    id,
    title,
    // An in-flight upload is already an upload, so the card sits in the same
    // filter bucket the real row will land in and does not vanish on swap.
    origin: 'upload',
    storage_path: null,
    created_at: new Date().toISOString(),
    status: 'completed',
    generation_error: null,
    generation_metadata: null,
  }
}

/**
 * Getting an image into the gallery, from the file picker or from a paste.
 *
 * Both paths are the same three steps -- optimistic card, upload, swap for the
 * real row -- and differ only in the preview. A paste is one image the user is
 * holding in mind, so it gets a blob preview immediately. The picker takes many
 * at once and shows none: previews would land in upload order and the cards
 * would appear to shuffle.
 *
 * The swap is by the upload's own return value. It used to match on title
 * against a realtime INSERT (#174), which two files of the same name broke.
 */
export function useUploads(
  userId: string | undefined,
  gallery: GalleryState,
  /**
   * Widen the gallery's scope so the upload is visible. The default scope is
   * generations (#207), and an upload is an `upload` wherever it happened --
   * so without this the card the user just created would be filtered out of the
   * view they created it in. Uploading is an implicit request to see uploads.
   */
  revealUploads: () => void,
) {
  const ingest = useCallback(
    (file: File, { preview }: { preview: boolean }) => {
      if (!userId) return
      revealUploads()
      const tempId = `upload-${Date.now()}-${crypto.randomUUID()}`
      gallery.addOptimisticCard(skeletonCard(tempId, file.name))

      const previewUrl = preview ? URL.createObjectURL(file) : null
      if (previewUrl) gallery.setImageUrl(tempId, previewUrl)

      void (async () => {
        try {
          const created = await saveFileToLibrary({
            userId,
            file,
            title: file.name,
          })
          gallery.replaceOptimisticCard(
            tempId,
            skeletonCard(created.id, created.title),
          )
          // Hold the blob preview until the refresh brings a real URL --
          // swapping to nothing would blink the card empty.
          const url = created.storage_path
            ? imageUrl(created.id, 'thumb')
            : previewUrl
          if (url) gallery.setImageUrl(created.id, url)
          void gallery.refresh({ silent: true })
        } catch {
          gallery.removeOptimisticCard(tempId)
        }
      })()
    },
    [userId, gallery, revealUploads],
  )

  const uploadFiles = useCallback(
    (files: Array<File>) => {
      for (const file of files) ingest(file, { preview: false })
    },
    [ingest],
  )

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        ingest(file, { preview: true })
        return
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [ingest])

  return { uploadFiles }
}
