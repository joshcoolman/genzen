'use client'

import { useCallback, useEffect } from 'react'
import type { GalleryState } from './use-gallery'
import type { SavedAiImage } from '#/features/ai-images/types'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { imageUrl } from '#/lib/image-url'
import { optimisticId } from '#/lib/optimistic-id'

/** The placeholder a card shows while its bytes are still in flight. */
function skeletonCard(
  id: string,
  title: string,
  groupId: string | null,
): SavedAiImage {
  return {
    id,
    title,
    // Carried from the first frame (#350). An upload aimed at a group used to
    // be born loose and moved in once the whole batch had landed, so every
    // file appeared at top level and was then taken away again. A card that
    // knows where it is going is filtered out of top level immediately, and
    // there is nothing to retract.
    group_id: groupId,
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
  /** The open group, which a paste lands in the same way a picked file does
   *  (#348's rule -- standing in a group makes it the destination). Null at
   *  top level. */
  activeGroupId: string | null,
) {
  const ingest = useCallback(
    async (
      file: File,
      { preview, groupId }: { preview: boolean; groupId: string | null },
    ) => {
      if (!userId) return null
      const tempId = optimisticId()
      gallery.addOptimisticCard(skeletonCard(tempId, file.name, groupId))

      const previewUrl = preview ? URL.createObjectURL(file) : null
      if (previewUrl) gallery.setImageUrl(tempId, previewUrl)

      try {
        const created = await saveFileToLibrary({
          userId,
          file,
          title: file.name,
          groupId,
        })
        gallery.replaceOptimisticCard(tempId, () =>
          skeletonCard(created.id, created.title, groupId),
        )
        // Hold the blob preview until the refresh brings a real URL --
        // swapping to nothing would blink the card empty.
        const url = created.storage_path
          ? imageUrl(created.id, 'thumb')
          : previewUrl
        if (url) gallery.setImageUrl(created.id, url)
        void gallery.refresh({ silent: true })
        return created.id
      } catch {
        gallery.removeOptimisticCard(tempId)
        return null
      }
    },
    [userId, gallery],
  )

  /**
   * `groupId` is the destination, and it travels with each file (#350).
   *
   * There is no filing step any more. The batch used to upload loose and then
   * make one `addImagesToGroup` call -- one write rather than one per file,
   * which was the right instinct about round trips and the wrong answer for
   * what it looked like: every thumbnail landed at top level and was pulled
   * out again a moment later. The insert takes the group now, so the cards are
   * never anywhere they should not be, and the group's own summary is re-read
   * once when the batch drains (`use-view`).
   */
  const uploadFiles = useCallback(
    async (files: Array<File>, groupId: string | null = null) => {
      const ids = (
        await Promise.all(
          files.map((file) => ingest(file, { preview: false, groupId })),
        )
      ).filter((id): id is string => id !== null)
      return ids
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
        void ingest(file, { preview: true, groupId: activeGroupId })
        return
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [ingest, activeGroupId])

  return { uploadFiles }
}
