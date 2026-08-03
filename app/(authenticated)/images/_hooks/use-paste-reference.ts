'use client'

import { useEffect } from 'react'
import { getLibraryImage } from '#/features/user-images/server/library-index.action'
import { readImageRefs } from '#/lib/image-clipboard'
import { imageUrl } from '#/lib/image-url'
import { toast } from '#/components'

interface UsePasteReferenceArgs {
  addRefImages: (
    images: Array<{ id: string; url: string; title: string }>,
  ) => void
  /**
   * How many references the selected model can hold. Zero for a model with no
   * image input at all -- and `addRefImages` slices silently to it, so without
   * this the paste would report success and add nothing.
   */
  maxRefImages: number
  /** How many are already in the strip. */
  refCount: number
}

/**
 * Pasting one or more images copied from the search overlay (#213,
 * multi-select #250).
 *
 * On this route "the current context" is the generator's reference strip, so
 * that is where the images land -- as references to rows that already
 * exist, not copies of them. `use-uploads.ts` handles the other paste, the
 * one carrying actual bytes from outside, and the two never collide: this
 * listener only acts on our own marker, and it runs first so that a clipboard
 * holding both the marker and a picture is read as the reference it is.
 *
 * The overlay caps a copy from Images at 3 (its own reference limit), but the
 * strip may already hold some of that headroom by the time the paste lands --
 * so this still fits to whatever capacity remains rather than assuming the
 * copy fits.
 */
export function usePasteReference({
  addRefImages,
  maxRefImages,
  refCount,
}: UsePasteReferenceArgs) {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')
      if (!text) return
      const ids = readImageRefs(text)
      if (!ids) return
      e.preventDefault()
      e.stopPropagation()

      // Say why nothing happened, before doing the round trip. A paste that
      // reports success and adds nothing is worse than one that refuses.
      if (maxRefImages === 0) {
        toast('The selected model does not take reference images')
        return
      }
      const capacity = maxRefImages - refCount
      if (capacity <= 0) {
        toast(`Reference images are full (${maxRefImages})`)
        return
      }

      const toFetch = ids.slice(0, capacity)
      const dropped = ids.length - toFetch.length

      void Promise.all(toFetch.map((id) => getLibraryImage(id)))
        .then((records) => {
          const found = records.filter((r) => r !== null)
          if (found.length === 0) return
          addRefImages(
            found.map((record) => ({
              id: record.id,
              url: imageUrl(record.id),
              title: record.title,
            })),
          )
          const added = found.length === 1 ? 'reference' : 'references'
          toast(
            dropped > 0
              ? `Added ${found.length} ${added} -- references full (${maxRefImages})`
              : `Added ${found.length} ${added}`,
            { variant: 'success' },
          )
        })
        .catch(() => {
          toast('Could not add that image', { variant: 'error' })
        })
    }
    // Capture phase, so the marker is claimed before `use-uploads` inspects the
    // clipboard for bytes.
    document.addEventListener('paste', onPaste, true)
    return () => document.removeEventListener('paste', onPaste, true)
  }, [addRefImages, maxRefImages, refCount])
}
