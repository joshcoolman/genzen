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
 * Getting an image into the gallery. **Paste is the only way in** (#491).
 *
 * There was a file picker in the toolbar, and an "Upload to group" flow beside
 * it that asked where the batch was headed before opening the OS dialog. Both
 * are gone: the library picker inside the generator panel took over choosing
 * files from disk (#489), which left the toolbar offering a second route to the
 * same thing, one click further from where the images are used.
 *
 * So the paste is the upload, and what it does is deliberately the whole
 * gesture: the file lands in the library *and* goes to the front of the
 * reference strip, because a screenshot pasted into this route is almost always
 * about to be generated from. `onDone` is where the second half happens.
 *
 * Three steps -- optimistic card, upload, swap for the real row. A paste is one
 * image the user is holding in mind, so it gets a blob preview immediately.
 *
 * The swap is by the upload's own return value. It used to match on title
 * against a realtime INSERT (#174), which two files of the same name broke.
 */
export function useUploads(
  userId: string | undefined,
  gallery: GalleryState,
  /** The open group, which a paste lands in (#348's rule -- standing in a
   *  group makes it the destination). Null at top level. */
  activeGroupId: string | null,
  {
    onStart,
    onDone,
  }: {
    /** Before the optimistic card appears, so the grid is showing the bucket
     *  the card is about to land in. */
    onStart: () => void
    /** The row, once it exists. */
    onDone: (image: { id: string; title: string }) => void
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
  // neither callback is stable, and re-attaching a document handler on every
  // keystroke elsewhere on the page is work for nothing.
  const handlers = useRef({ onStart, onDone })
  handlers.current = { onStart, onDone }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        handlers.current.onStart()
        void ingest(file, activeGroupId).then((created) => {
          if (created)
            handlers.current.onDone({ id: created.id, title: created.title })
        })
        return
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [ingest, activeGroupId])
}
