'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useADContext } from './use-ad-context'
import { useDownloads } from './use-downloads'
import { useEditPage } from './use-edit-page'
import { usePanel } from './use-panel'
import { usePrefs } from './use-prefs'
import type { SavedAiImage } from '#/features/ai-images/types'
import type { LightboxImage } from '#/components'
import { useIsMobile } from '#/lib/hooks/use-is-mobile'
import { useSelection } from '#/lib/use-selection'
import { getR2PublicUrl } from '#/lib/image-storage'
import { useADOpen } from '#/lib/use-ad-open'

export function useView() {
  const { imageId } = useParams<{ imageId: string }>()
  const initialSourceId = useSearchParams().get('sourceId') ?? undefined

  const isMobile = useIsMobile()
  const { isOpen: isADOpen } = useADOpen()
  const panel = usePanel()
  const prefs = usePrefs()
  const downloads = useDownloads()

  // Selection is created before the page hook because the page hook takes the
  // selected ids -- a selection turns the generator into multi-reference mode.
  const [selectionItems, setSelectionItems] = useState<Array<string>>([])
  const selection = useSelection({ items: selectionItems })
  const selectionActive = selection.count > 0

  const page = useEditPage(imageId, selection.selectedIds)

  useADContext({
    sourceImageMeta: page.sourceImageMeta,
    generator: page.generator,
    modelSelector: page.modelSelector,
    chainImageCount: page.chainImages.length,
    activeSourceId: page.activeSourceId,
    isChained: page.isChained,
  })

  const [refPickerOpen, setRefPickerOpen] = useState(false)
  const [describeTarget, setDescribeTarget] = useState<SavedAiImage | null>(
    null,
  )
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Sort the chain -- the parent always stays at position 0.
  const images = prefs.sortAsc
    ? page.chainImages.length > 1
      ? [page.chainImages[0], ...[...page.chainImages.slice(1)].reverse()]
      : page.chainImages
    : page.chainImages

  useEffect(() => {
    setSelectionItems(images.map((img) => img.id))
  }, [images])

  // Pre-select a child when arriving from a thumbnail click on Images.
  const didApplyInitialSource = useRef(false)
  useEffect(() => {
    if (!initialSourceId || didApplyInitialSource.current || page.pageLoading)
      return
    didApplyInitialSource.current = true
    void page.selectImageById(initialSourceId)
  }, [initialSourceId, page.pageLoading, page.selectImageById])

  // A card click promotes that image to source rather than navigating.
  const open = useCallback(
    (img: SavedAiImage) => {
      if (img.id === page.activeSourceId) return
      void page.selectImageById(img.id)
    },
    [page.activeSourceId, page.selectImageById],
  )

  const openChild = useCallback(
    (childId: string) => {
      void page.selectImageById(childId)
    },
    [page.selectImageById],
  )

  // Deleting the active source moves the source on first, so the page is never
  // left pointing at a row that is gone.
  const remove = useCallback(
    (img: SavedAiImage) => {
      if (img.id === page.activeSourceId) {
        const i = images.findIndex((image) => image.id === img.id)
        const next = images[i + 1] ?? images[i - 1]
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- index may be out of bounds
        if (next) void page.selectImageById(next.id)
      }
      void page.results.deleteResult(img.id)
    },
    [
      page.activeSourceId,
      page.results.deleteResult,
      images,
      page.selectImageById,
    ],
  )

  // The original parent is the one image that cannot be unlinked.
  const unlink = useCallback(
    (img: SavedAiImage) => {
      if (img.id === imageId) return
      void page.detachResult(img.id)
    },
    [imageId, page],
  )

  const downloadSelected = useCallback(async () => {
    await downloads.downloadMany(
      images.filter((img) => selection.selectedIds.has(img.id)),
    )
    selection.clearSelection()
  }, [images, selection, downloads])

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selection.selectedIds).filter(
      (id) => id !== page.activeSourceId,
    )
    await Promise.all(ids.map((id) => page.results.deleteResult(id)))
    selection.clearSelection()
  }, [selection, page.activeSourceId, page.results.deleteResult])

  const unlinkSelected = useCallback(async () => {
    const ids = Array.from(selection.selectedIds).filter((id) => id !== imageId)
    await Promise.all(ids.map((id) => page.detachResult(id)))
    selection.clearSelection()
  }, [selection, imageId, page])

  // The lightbox shows completed images only, always at full resolution.
  const lightboxImages: Array<LightboxImage> = images
    .filter((img) => img.status === 'completed' && img.storage_path)
    .map((img) => ({
      id: img.id,
      url: getR2PublicUrl(img.storage_path!),
      title: img.title,
    }))

  const lightboxImageUrls = useMemo(() => {
    const urls: Record<string, string> = {}
    for (const img of lightboxImages) urls[img.id] = img.url
    return urls
  }, [lightboxImages])

  const openLightbox = useCallback(
    (img: SavedAiImage) => {
      const i = lightboxImages.findIndex((entry) => entry.id === img.id)
      if (i >= 0) setLightboxIndex(i)
    },
    [lightboxImages],
  )

  const deleteFromLightbox = useCallback(() => {
    if (lightboxIndex === null) return
    void page.results.deleteResult(lightboxImages[lightboxIndex].id)
    if (lightboxImages.length <= 1) setLightboxIndex(null)
    else if (lightboxIndex >= lightboxImages.length - 1)
      setLightboxIndex(lightboxIndex - 1)
  }, [lightboxIndex, lightboxImages, page.results.deleteResult])

  // 20rem per docked panel: the generator when pinned, the AD when open, and
  // neither docks on mobile.
  const docked = ((!isMobile && panel.pinned ? 1 : 0) +
    (!isMobile && isADOpen ? 1 : 0)) as 0 | 1 | 2

  return {
    imageId,
    page,
    images,
    isMobile,
    isADOpen,
    docked,
    panel,
    prefs,
    selection,
    selectionActive,
    open,
    openChild,
    remove,
    unlink,
    downloadOne: downloads.downloadOne,
    downloadSelected,
    deleteSelected,
    unlinkSelected,
    refPickerOpen,
    setRefPickerOpen,
    describeTarget,
    setDescribeTarget,
    lightboxIndex,
    setLightboxIndex,
    lightboxImages,
    lightboxImageUrls,
    openLightbox,
    deleteFromLightbox,
  }
}
