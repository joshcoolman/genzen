'use client'

import { useEffect } from 'react'
import { getLibraryImage } from '#/features/user-images/server/library-index.actions'
import { readImageRef } from '#/lib/image-clipboard'
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
 * Pasting an image copied from the search overlay (#213).
 *
 * On this route "the current context" is the generator's reference strip, so
 * that is where the image lands -- as a reference to the row that already
 * exists, not as a copy of it. `use-uploads.ts` handles the other paste, the
 * one carrying actual bytes from outside, and the two never collide: this
 * listener only acts on our own marker, and it runs first so that a clipboard
 * holding both the marker and a picture is read as the reference it is.
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
      const id = readImageRef(text)
      if (!id) return
      e.preventDefault()
      e.stopPropagation()

      // Say why nothing happened, before doing the round trip. A paste that
      // reports success and adds nothing is worse than one that refuses.
      if (maxRefImages === 0) {
        toast('The selected model does not take reference images')
        return
      }
      if (refCount >= maxRefImages) {
        toast(`Reference images are full (${maxRefImages})`)
        return
      }

      void getLibraryImage(id)
        .then((record) => {
          if (!record) return
          addRefImages([
            { id: record.id, url: imageUrl(record.id), title: record.title },
          ])
          toast('Added as a reference', { variant: 'success' })
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
