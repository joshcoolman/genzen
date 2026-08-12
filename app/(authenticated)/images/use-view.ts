'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDock } from './_hooks/use-dock'
import { useDownload } from './_hooks/use-download'
import { usePrefs } from './_hooks/use-prefs'
import { useUploads } from './_hooks/use-uploads'
import { useGallery } from './_hooks/use-gallery'
import { useLightbox } from './_hooks/use-lightbox'
import { useVariations } from './_hooks/use-variations'
import { usePasteReference } from './_hooks/use-paste-reference'
import type { SavedAiImage } from '#/features/ai-images/types'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { useGenerator } from '#/features/ai-images/hooks/use-generator'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useSelection } from '#/lib/use-selection'
import { toast } from '#/components'

/**
 * The state `view.tsx` renders.
 *
 * The first read is the server component's -- `page.tsx` runs
 * `listGalleryImages()` and hands the rows in as `initial`, so there is no
 * loading state and no empty first paint. `useGallery` owns every read after
 * that, and its 5s poll is the only signal that anything changed.
 */
export function useView(initial: Array<SavedAiImage>) {
  const { user } = useAuth()
  const router = useRouter()

  const gallery = useGallery({ userId: user.id, initial })
  const userImages = useUserImages(user.id)
  const prefs = usePrefs()
  const dock = useDock()
  const download = useDownload()
  // Making something is an implicit request to see it. The scope defaults to
  // generations (#207), so without these a card the user just created lands in
  // a bucket the current pill hides -- an upload while scoped to generations, a
  // generation while scoped to uploads. Only widens; never narrows.
  const reveal = useCallback(
    (filter: 'uploads' | 'images') => {
      if (prefs.originFilter !== filter && prefs.originFilter !== 'all') {
        prefs.setOriginFilter(filter)
      }
    },
    [prefs],
  )

  const revealUploads = useCallback(() => reveal('uploads'), [reveal])

  const { uploadFiles } = useUploads(user.id, gallery, revealUploads)

  const modelSelector = useModelSelector({
    capability: 'sidebar',
    mode: 'multi',
  })

  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    origin: 'images',
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    setError,
    // A submit inserts pending rows server-side. The gallery used to hear about
    // them on the realtime INSERT (#174); it now asks once the submits land,
    // and the 5s poll takes over from there until they settle.
    onAfterSubmit: () => {
      reveal('images')
      void gallery.refresh({ silent: true })
    },
  })

  // Scope, then order. The filter is client-side on purpose: the gallery already
  // holds every row, so switching pills is instant and costs no round trip --
  // and `origin` is immutable, so a filtered-out row cannot become stale.
  const scoped = useMemo(() => {
    if (prefs.originFilter === 'all') return gallery.images
    const origin =
      prefs.originFilter === 'uploads' ? 'upload' : prefs.originFilter
    return gallery.images.filter((img) => img.origin === origin)
  }, [gallery.images, prefs.originFilter])

  const images = prefs.sortAsc ? [...scoped].reverse() : scoped

  // An image copied from the search overlay pastes in as a reference (#213).
  usePasteReference({
    addRefImages: generator.addRefImages,
    maxRefImages: generator.maxRefImages,
    refCount: generator.refImages.length,
  })

  // The list the grid renders, minus the cards with nothing to look at (#270).
  // Scoped and sorted like the grid, because the filmstrip shows this list and
  // a lightbox cycling something else is visibly wrong, not subtly wrong.
  const lightboxImages = useMemo(
    () => images.filter((img) => img.status === 'completed'),
    [images],
  )

  const lightbox = useLightbox(lightboxImages, gallery.deleteImage)
  // The same cursor over the same list, driving the in-place preview instead of
  // the overlay. Its own instance so the two do not share a position: stepping
  // through one is not meant to move the other.
  const experiment = useLightbox(lightboxImages)
  const variations = useVariations({ setError })

  const selection = useSelection({ items: images.map((img) => img.id) })

  // Select mode (#284). A mode rather than a circle per card: the use that
  // justifies selection is bulk, and per-card circles make clearing twelve of
  // sixteen twelve precise clicks on a small corner. The cost is modality, paid
  // for by a toolbar toggle that reads as on and by Escape always leaving.
  //
  // Selecting attaches nothing to the next generation. It used to feed
  // `setAutoRefImageIds`, so looking through images silently changed what the
  // next prompt was built from; references have their own surface, which says
  // what it has collected.
  const [selectMode, setSelectMode] = useState(false)

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    selection.clearSelection()
  }, [selection])

  const toggleSelectMode = useCallback(() => {
    if (selectMode) {
      exitSelectMode()
      return
    }
    setSelectMode(true)
  }, [selectMode, exitSelectMode])

  // Always, and never automatically after a batch action: "delete three, then
  // select four more" is a real pattern, and auto-exit punishes it by silently
  // changing what the next click does.
  useEffect(() => {
    if (!selectMode) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitSelectMode()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectMode, exitSelectMode])

  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  const deleteSelected = useCallback(async () => {
    const targets = images.filter((img) => selection.selectedIds.has(img.id))
    setIsBatchDeleting(true)
    try {
      for (const img of targets) await gallery.deleteImage(img)
      // The mode stays on -- see exitSelectMode.
      selection.clearSelection()
    } finally {
      setIsBatchDeleting(false)
    }
  }, [images, selection, gallery])

  const [describeTarget, setDescribeTarget] = useState<SavedAiImage | null>(
    null,
  )

  // The two power moves: Cmd-click a card to add its image, Cmd-click its prompt
  // for its text -- so "these images, my words" is a handful of clicks from
  // anywhere in the grid. Neither touches anything else: not the count, not the
  // additional prompts, not the model selection.
  //
  // Both open the panel. A power move whose entire effect is inside a closed
  // panel has no feedback at all, which is the reason #284 refused to put a
  // "use as source" button on the card.
  //
  // **One modifier, not two.** Cmd-click used to replace the first image and
  // Cmd-Shift-click push onto the rest -- a real distinction only while a source
  // slot existed to be replaced. Over one set (#297) they were the same gesture
  // with a rule to remember, and the replacing one was the wrong default:
  // clicking three cards left one image, not three.
  const addReference = useCallback(
    (img: SavedAiImage) => {
      if (!img.storage_path) return
      // Refusing out loud, the same way the paste path does (#213): the set
      // caps at the selected model's `maxRefImages`, and a gesture that reports
      // nothing and adds nothing is worse than one that says no.
      if (generator.maxRefImages === 0) {
        toast('The selected model does not take images')
        return
      }
      dock.setOpen(true)
      // Onto the front, evicting the last. A full set is the normal case for
      // this gesture, not the exception -- see `pushRef`.
      //
      // Adding is its own feedback: the set visibly gains an image. Dropping
      // one is not, and it is the half you would want to know about, so it is
      // the only outcome that says anything. At capacity 1 every click evicts,
      // which is correct and also why a single-image model made the old
      // replace-slot-0 binding impossible to tell apart from this one.
      const evicts =
        generator.refImages.length >= generator.maxRefImages &&
        !generator.refImages.some((r) => r.id === img.id)
      generator.pushRefImage({
        id: img.id,
        url: imageUrl(img.id),
        title: img.title,
      })
      if (evicts) {
        toast(
          `Image added; the last one dropped (max ${generator.maxRefImages})`,
        )
      }
    },
    [generator, dock],
  )

  const usePromptText = useCallback(
    (text: string) => {
      dock.setOpen(true)
      // `setPrompt` is prompts[0] only, so a second prompt row someone is
      // holding on to survives this.
      generator.setPrompt(text)
    },
    [generator, dock],
  )

  /** Take a still to /video as its first frame (#305). A navigation rather
   *  than a panel: video is its own route, and the image travels as an id in
   *  the URL so the target needs no shared state. */
  const animate = useCallback(
    (img: SavedAiImage) => {
      router.push(`/video?image=${img.id}`)
    },
    [router],
  )

  /** The source image's URL, for the variation dialog's preview. */
  const variationSourceUrl = variations.pendingSourceImage
    ? gallery.imageUrls[variations.pendingSourceImage.id]
    : undefined

  return {
    images,
    gallery,
    userImages,
    modelSelector,
    generator,
    prefs,
    dock,
    download,
    uploadFiles,
    selection,
    selectMode,
    toggleSelectMode,
    isBatchDeleting,
    deleteSelected,
    lightbox,
    experiment,
    variations,
    variationSourceUrl,
    describeTarget,
    setDescribeTarget,
    addReference,
    usePromptText,
    animate,
    error,
    setError,
  }
}
