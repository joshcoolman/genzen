'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { GalleryState } from './use-gallery'
import type { SavedAiImage } from '#/features/ai-images/types'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { toast } from '#/components'
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
 * Getting images into the gallery.
 *
 * **A paste uploads, and stops there** (#550). It used to also push the file to
 * the front of the reference strip, on the reading that a screenshot pasted
 * into this route is almost always about to be generated from. That was fair
 * while paste was the only way in and it was always one screenshot; #489 gave
 * references their own deliberate route, and the inference stopped carrying a
 * workflow that had no alternative.
 *
 * The cost was never symmetric, which is the part that settled it. An unwanted
 * reference is not clutter you click away -- unnoticed, it is a real generation
 * with real spend in the activity log. All a paste tells us is that you want
 * the images in the system.
 *
 * **Every image on the clipboard, not the first** (#550). Five files copied in
 * Finder arriving as one upload was the old behaviour's other half: it took the
 * first and dropped the rest silently, which only looked reasonable while the
 * gesture meant "this one picture I am about to generate from".
 *
 * Three steps per file -- optimistic card, upload, swap for the real row --
 * with a blob preview immediately, because the images are ones you are holding
 * in mind. The swap is by the upload's own return value; it used to match on
 * title against a realtime INSERT (#174), which two files of the same name
 * broke.
 */
export function useUploads(
  userId: string | undefined,
  gallery: GalleryState,
  /** The open group, which a paste lands in (#348's rule -- standing in a
   *  group makes it the destination). Null at top level. */
  activeGroupId: string | null,
  {
    onStart,
  }: {
    /** Before the optimistic card appears, so the grid is showing the bucket
     *  the card is about to land in. */
    onStart: () => void
  },
) {
  const ingest = useCallback(
    async (file: File, groupId: string | null) => {
      if (!userId) return null
      const tempId = optimisticId()
      gallery.addOptimisticCard(skeletonCard(tempId, file.name, groupId))

      const previewUrl = URL.createObjectURL(file)
      gallery.setImageUrl(tempId, previewUrl)

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
        gallery.setImageUrl(
          created.id,
          created.storage_path ? imageUrl(created.id, 'thumb') : previewUrl,
        )
        void gallery.refresh({ silent: true })
        return created
      } catch (err) {
        gallery.removeOptimisticCard(tempId)
        // **Say why** (#482). A failed upload used to take its card away and
        // nothing else, so a file over the limit read as the app declining
        // without comment -- which is exactly how a 9MB reference sheet
        // presented itself. The size message is a sentence worth showing; the
        // rest reads the same to whoever dropped the file.
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : `Could not upload ${file.name}`,
        )
        return null
      }
    },
    [userId, gallery],
  )

  // Held in a ref so the listener binds once per gallery, not once per render:
  // the callback is not stable, and re-attaching a document handler on every
  // keystroke elsewhere on the page is work for nothing.
  const handlers = useRef({ onStart })
  handlers.current = { onStart }

  /** The same ingest the paste uses, for the Upload button (#550). Sequential
   *  rather than parallel: a batch of large files all in flight at once is the
   *  upload ceiling's worst case, and nothing here is waiting on the last one. */
  const uploadFiles = useCallback(
    async (files: Array<File>) => {
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      handlers.current.onStart()
      for (const file of images) await ingest(file, activeGroupId)
    },
    [ingest, activeGroupId],
  )

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files = Array.from(items)
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null)
      if (files.length === 0) return
      e.preventDefault()
      void uploadFiles(files)
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [uploadFiles])

  return { uploadFiles }
}
