'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDock } from './_hooks/use-dock'
import { useDownload } from './_hooks/use-download'
import { usePrefs } from './_hooks/use-prefs'
import { useUploads } from './_hooks/use-uploads'
import type { SavedAiImage } from '#/features/ai-images/types'
import { useAuth } from '#/lib/auth'
import { getR2PublicUrl } from '#/lib/image-storage'
import { useImages } from '#/features/ai-images/hooks/use-images'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { useGenerator } from '#/features/ai-images/hooks/use-generator'
import { useLightbox } from '#/features/ai-images/hooks/use-lightbox'
import { useVariations } from '#/features/ai-images/hooks/use-variations'
import { useUserImages } from '#/features/user-images/hooks/useUserImages'
import { useDescribeJson } from '#/features/ai-images/hooks/use-describe-json'
import { useSelection } from '#/lib/use-selection'

/**
 * The state `view.tsx` renders.
 *
 * The first read is the server component's -- `page.tsx` runs
 * `listGalleryImages()` and hands the rows in as `initial`, so there is no
 * loading state and no empty first paint. `useImages` owns every read after
 * that, and its 5s poll is the only signal that anything changed.
 */
export function useView(initial: Array<SavedAiImage>) {
  const { user } = useAuth()

  const gallery = useImages({ userId: user.id, initial })
  const userImages = useUserImages(user.id)
  const prefs = usePrefs()
  const dock = useDock()
  const download = useDownload()
  const { uploadFiles } = useUploads(user.id, gallery)

  const modelSelector = useModelSelector({
    capability: 'sidebar',
    mode: 'multi',
  })

  const [error, setError] = useState<string | null>(null)

  const generator = useGenerator({
    selectedModels: modelSelector.selectedIds,
    gensPerModel: modelSelector.gensPerModel,
    setError,
    // A submit inserts pending rows server-side. The gallery used to hear about
    // them on the realtime INSERT (#174); it now asks once the submits land,
    // and the 5s poll takes over from there until they settle.
    onAfterSubmit: () => {
      void gallery.refresh({ silent: true })
    },
  })

  const completedImages = gallery.images.filter(
    (img) => img.status === 'completed',
  )

  const images = prefs.sortAsc ? [...gallery.images].reverse() : gallery.images

  // The highlight (#205). A highlighted image is the primary reference for
  // whatever you prompt next; clicking it again takes the highlight off and
  // you are back to plain generation. This replaced the /edit route, which
  // answered "which image is the source" -- state wearing a URL as a costume.
  //
  // It is one flag. The generator already knows what to do with a source
  // image, including picking the model's image-input endpoint, so "edit" vs
  // "generate" stays a detail of building the request.
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)

  const clearHighlight = useCallback(() => {
    setSelectedImageId(null)
    generator.handleClearSourceImage()
  }, [generator])

  const toggleHighlight = useCallback(
    (img: SavedAiImage) => {
      if (img.id === selectedImageId) {
        clearHighlight()
        return
      }
      if (!img.storage_path) return
      setSelectedImageId(img.id)
      // The URL is for the panel's preview only. The submit sends the id, and
      // the server resolves the object and uploads the bytes to FAL -- handing
      // FAL a URL to fetch cannot work locally, where it is `localhost:9010`.
      generator.setSourceFromLibrary(
        img.id,
        getR2PublicUrl(img.storage_path),
        img.title,
      )
    },
    [selectedImageId, clearHighlight, generator],
  )

  // The panel's own clear button has to take the highlight with it, or the
  // border would outlive the reference it stands for.
  const generatorWithHighlight = useMemo(
    () => ({ ...generator, handleClearSourceImage: clearHighlight }),
    [generator, clearHighlight],
  )

  const lightbox = useLightbox(completedImages, gallery.deleteImage)
  const variations = useVariations({ setError })

  // Describe JSON for the generator's source image -- appends to prompt
  const describe = useDescribeJson({
    imageUrl: generator.sourceImage?.base64,
    onResult: useCallback(
      (json: string) => {
        generator.setPrompt((prev: string) =>
          prev ? `${prev}\n\n${json}` : json,
        )
      },
      [generator],
    ),
  })

  const selection = useSelection({ items: images.map((img) => img.id) })

  // A selected completed image is an automatic reference for the next prompt.
  useEffect(() => {
    const ids = Array.from(selection.selectedIds).filter(
      (id) => gallery.images.find((i) => i.id === id)?.status === 'completed',
    )
    generator.setAutoRefImageIds(ids)
  }, [selection.selectedIds, gallery.images])

  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  const deleteSelected = useCallback(async () => {
    const targets = images.filter((img) => selection.selectedIds.has(img.id))
    setIsBatchDeleting(true)
    try {
      for (const img of targets) await gallery.deleteImage(img)
      selection.clearSelection()
    } finally {
      setIsBatchDeleting(false)
    }
  }, [images, selection, gallery])

  const [describeTarget, setDescribeTarget] = useState<SavedAiImage | null>(
    null,
  )

  const loadPrompt = useCallback(
    (img: SavedAiImage) => {
      const prompt = img.generation_metadata?.prompt
      if (prompt) generator.setPrompt(prompt)
    },
    [generator],
  )

  /** The lightbox's Edit: close it, and highlight what was on screen. */
  const highlightFromLightbox = useCallback(() => {
    const item = lightbox.items[lightbox.index!]
    const img = completedImages.find((i) => i.id === item.id)
    lightbox.close()
    if (img) toggleHighlight(img)
  }, [lightbox, completedImages, toggleHighlight])

  /** The source image's URL, for the variation dialog's preview. */
  const variationSourceUrl = variations.pendingSourceImage
    ? gallery.imageUrls[variations.pendingSourceImage.id]
    : undefined

  return {
    images,
    gallery,
    userImages,
    modelSelector,
    generator: generatorWithHighlight,
    prefs,
    dock,
    download,
    uploadFiles,
    selection,
    isBatchDeleting,
    deleteSelected,
    selectedImageId,
    toggleHighlight,
    lightbox,
    highlightFromLightbox,
    variations,
    variationSourceUrl,
    describe,
    describeTarget,
    setDescribeTarget,
    loadPrompt,
    error,
    setError,
  }
}
