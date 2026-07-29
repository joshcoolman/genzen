'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  EyeOff,
  Info,
  LayoutGrid,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Trash2,
  Unlink,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { ImageGallery } from '../../../../_components/image-gallery/image-gallery'
import { GeneratorPanel } from '../../../../_components/generator-panel/generator-panel'
import { DescribeDialog } from '../../../../_components/describe-dialog/describe-dialog'
import { VariationPromptsDialog } from '../../../../_components/variation-prompts-dialog/variation-prompts-dialog'
import { ExistingImagePicker } from '../../../../_components/existing-image-picker/existing-image-picker'
import { CircularIconButton } from '../circular-icon-button/circular-icon-button'
import { useEditPage } from '../../use-edit-page'
import { useADContext } from '../../use-ad-context'
import styles from './edit-page.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { usePersistedState } from '#/lib/use-persisted-state'
import {
  Button,
  Dialog,
  DialogContent,
  Lightbox,
  MobileDialogHeader,
  SelectionDrawer,
} from '#/components'
import { useIsMobile } from '#/lib/hooks/use-is-mobile'
import { useSelection } from '#/lib/use-selection'
import { createImageStorage, getR2PublicUrl } from '#/lib/image-storage'
import { useADOpen } from '#/lib/use-ad-open'
import { cx } from '#/lib/utils'

const THUMB_SIZES = ['lg', 'md', 'sm'] as const
const THUMB_LABELS: Record<(typeof THUMB_SIZES)[number], string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

interface EditPrefs {
  thumbSize: 'lg' | 'md' | 'sm'
  showInfo: boolean
  sortAsc: boolean
}

const PREFS_KEY = 'genzen:edit-page-prefs'

const DEFAULT_PREFS: EditPrefs = {
  thumbSize: 'lg',
  showInfo: true,
  sortAsc: false,
}

// Only ever called from an effect, never during render -- see usePersistedState.
function getStoredPrefs(): EditPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_PREFS
}

function storePrefs(partial: Partial<EditPrefs>) {
  try {
    const current = getStoredPrefs()
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...partial }))
  } catch {}
}

export function EditPage() {
  const { imageId } = useParams<{ imageId: string }>()
  const initialSourceId = useSearchParams().get('sourceId') ?? undefined

  // Mobile detection
  const isMobile = useIsMobile()
  const { isOpen: isADOpen } = useADOpen()

  const [panelPinned, setPanelPinned, panelPinnedHydrated] = usePersistedState(
    () => localStorage.getItem('genzen:edit-panel-pinned') !== 'false',
    true,
  )

  useEffect(() => {
    if (!panelPinnedHydrated) return
    localStorage.setItem('genzen:edit-panel-pinned', String(panelPinned))
  }, [panelPinned, panelPinnedHydrated])

  const [panelOpen, setPanelOpen, panelOpenHydrated] = usePersistedState(
    () => localStorage.getItem('genzen:edit-panel-open') !== 'false',
    true,
  )

  useEffect(() => {
    if (!panelOpenHydrated) return
    localStorage.setItem('genzen:edit-panel-open', String(panelOpen))
  }, [panelOpen, panelOpenHydrated])

  // View prefs — same controls as main view
  const [thumbSize, setThumbSize] = usePersistedState<'lg' | 'md' | 'sm'>(
    () => getStoredPrefs().thumbSize,
    DEFAULT_PREFS.thumbSize,
  )
  const [showInfo, setShowInfo] = usePersistedState(
    () => getStoredPrefs().showInfo,
    DEFAULT_PREFS.showInfo,
  )
  const [sortAsc, setSortAsc] = usePersistedState(
    () => getStoredPrefs().sortAsc,
    DEFAULT_PREFS.sortAsc,
  )

  // Selection state (initialized early so it can be passed to useEditPage)
  const [selectionItems, setSelectionItems] = useState<Array<string>>([])
  const selection = useSelection({ items: selectionItems })
  const selectionActive = selection.count > 0

  const page = useEditPage(imageId, selection.selectedIds)

  // Register edit page context with AD (image + metadata)
  useADContext({
    sourceImageMeta: page.sourceImageMeta,
    generator: page.generator,
    modelSelector: page.modelSelector,
    chainImageCount: page.chainImages.length,
    activeSourceId: page.activeSourceId,
    isChained: page.isChained,
  })

  const handleToggleThumbSize = () => {
    setThumbSize((v) => {
      const idx = THUMB_SIZES.indexOf(v)
      const next = THUMB_SIZES[(idx + 1) % THUMB_SIZES.length]
      storePrefs({ thumbSize: next })
      return next
    })
  }

  const handleToggleInfo = () => {
    setShowInfo((v) => {
      storePrefs({ showInfo: !v })
      return !v
    })
  }

  const handleToggleSort = () => {
    setSortAsc((v) => {
      storePrefs({ sortAsc: !v })
      return !v
    })
  }

  // Ref image picker state
  const [refPickerOpen, setRefPickerOpen] = useState(false)

  // Describe dialog
  const [describeTarget, setDescribeTarget] = useState<SavedAiImage | null>(
    null,
  )

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Sort chain images — parent always stays at position 0
  const sortedChainImages = sortAsc
    ? page.chainImages.length > 1
      ? [page.chainImages[0], ...[...page.chainImages.slice(1)].reverse()]
      : page.chainImages
    : page.chainImages

  // Update selection items when images change
  useEffect(() => {
    setSelectionItems(sortedChainImages.map((img) => img.id))
  }, [sortedChainImages])

  // Pre-select child when navigating from main page thumb click
  const didApplyInitialSource = useRef(false)
  useEffect(() => {
    if (!initialSourceId || didApplyInitialSource.current || page.pageLoading)
      return
    didApplyInitialSource.current = true
    void page.selectImageById(initialSourceId)
  }, [initialSourceId, page.pageLoading, page.selectImageById])

  // Card click = promote to source (not navigate)
  const handleOpen = useCallback(
    (img: SavedAiImage) => {
      if (img.id === page.activeSourceId) return
      void page.selectImageById(img.id)
    },
    [page.activeSourceId, page.selectImageById],
  )

  // Child thumbnail click = promote that child to source
  const handleChildOpen = useCallback(
    (childId: string) => {
      void page.selectImageById(childId)
    },
    [page.selectImageById],
  )

  // Delete — auto-select next image if deleting active source
  const handleDelete = useCallback(
    (img: SavedAiImage) => {
      // If deleting the active source, select the next available image first
      if (img.id === page.activeSourceId) {
        const currentIndex = sortedChainImages.findIndex((i) => i.id === img.id)
        const next =
          sortedChainImages[currentIndex + 1] ??
          sortedChainImages[currentIndex - 1]
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- index may be out of bounds
        if (next) {
          void page.selectImageById(next.id)
        }
      }
      void page.results.deleteResult(img.id)
    },
    [
      page.activeSourceId,
      page.results.deleteResult,
      sortedChainImages,
      page.selectImageById,
    ],
  )

  // Unlink — prevent unlinking the original parent
  const handleUnlink = useCallback(
    (img: SavedAiImage) => {
      if (img.id === imageId) return
      void page.detachResult(img.id)
    },
    [imageId, page],
  )

  // Download single image
  const handleDownload = useCallback(async (img: SavedAiImage) => {
    const path = img.storage_path
    if (!path) return
    const url = await createImageStorage().getUrl(path)
    if (!url) return
    saveAs(url, `${img.title}.png`)
  }, [])

  // Batch download selected
  const handleDownloadSelected = useCallback(async () => {
    const selected = sortedChainImages.filter(
      (img) => selection.selectedIds.has(img.id) && img.storage_path,
    )
    if (selected.length === 0) return
    if (selected.length === 1) {
      await handleDownload(selected[0])
      selection.clearSelection()
      return
    }
    const zip = new JSZip()
    await Promise.all(
      selected.map(async (img) => {
        const url = await createImageStorage().getUrl(img.storage_path!)
        if (!url) return
        const resp = await fetch(url)
        const blob = await resp.blob()
        zip.file(`${img.title}.png`, blob)
      }),
    )
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, 'edit-images.zip')
    selection.clearSelection()
  }, [sortedChainImages, selection, handleDownload])

  // Batch delete selected
  const handleDeleteSelected = useCallback(async () => {
    const toDelete = Array.from(selection.selectedIds).filter(
      (id) => id !== page.activeSourceId,
    )
    await Promise.all(toDelete.map((id) => page.results.deleteResult(id)))
    selection.clearSelection()
  }, [selection, page.activeSourceId, page.results.deleteResult])

  // Batch unlink selected
  const handleUnlinkSelected = useCallback(async () => {
    const toUnlink = Array.from(selection.selectedIds).filter(
      (id) => id !== imageId, // Don't unlink the original parent
    )
    await Promise.all(toUnlink.map((id) => page.detachResult(id)))
    selection.clearSelection()
  }, [selection, imageId, page])

  // Lightbox images (completed only) -- always use full-res storage_path URLs
  const lightboxImages = sortedChainImages
    .filter((img) => img.status === 'completed' && img.storage_path)
    .map((img) => ({
      id: img.id,
      url: getR2PublicUrl(img.storage_path!),
      title: img.title,
    }))

  const lightboxImageUrls = useMemo(() => {
    const urls: Record<string, string> = {}
    for (const img of lightboxImages) {
      urls[img.id] = img.url
    }
    return urls
  }, [lightboxImages])

  const handleGallery = useCallback(
    (img: SavedAiImage) => {
      const idx = lightboxImages.findIndex((i) => i.id === img.id)
      if (idx >= 0) setLightboxIndex(idx)
    },
    [lightboxImages],
  )

  if (page.pageLoading) {
    return (
      <div className={styles.placeholder}>
        <p className={styles.placeholderText}>Loading image...</p>
      </div>
    )
  }

  if (!page.sourceImageMeta) {
    return (
      <div className={styles.body}>
        <CircularIconButton
          icon={ArrowLeft}
          to="/images"
          title="Back to Images"
        />
        <div className={styles.notFound}>
          <h3 className={styles.notFoundTitle}>Image not found</h3>
          <p className={styles.placeholderText}>
            {page.error ?? 'This image may have been deleted.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cx(
        styles.page,
        panelPinned && !isMobile && !isADOpen && styles.pagePushed,
        panelPinned && !isMobile && isADOpen && styles.pagePushedBoth,
        !panelPinned && isADOpen && !isMobile && styles.pagePushed,
      )}
    >
      <div className={styles.body}>
        {/* Header */}
        <div className={styles.header}>
          <CircularIconButton
            icon={ArrowLeft}
            to="/images"
            title="Back to Images"
          />
          {/* Desktop: full controls, Mobile: just generate button */}
          {isMobile ? (
            !panelOpen && (
              <button
                onClick={() => setPanelOpen(true)}
                className={styles.openPanel}
                title="Open edit panel"
              >
                <Plus className={styles.icon} />
              </button>
            )
          ) : (
            <div className={styles.headerTools}>
              {/* View controls — same as main view */}
              <div className={styles.viewToggles}>
                <button
                  onClick={handleToggleThumbSize}
                  className={cx(styles.viewToggle, styles.thumbSizeToggle)}
                  aria-label={`Thumbnail size: ${THUMB_LABELS[thumbSize]}`}
                >
                  <LayoutGrid className={styles.smallIcon} />
                  <span className={styles.thumbSizeLabel}>
                    {THUMB_LABELS[thumbSize]}
                  </span>
                </button>
                <button
                  onClick={handleToggleSort}
                  className={styles.viewToggle}
                  aria-label={
                    sortAsc ? 'Sort newest first' : 'Sort oldest first'
                  }
                >
                  {sortAsc ? (
                    <ArrowUp className={styles.icon} />
                  ) : (
                    <ArrowDown className={styles.icon} />
                  )}
                </button>
                <button
                  onClick={handleToggleInfo}
                  className={styles.viewToggle}
                  aria-label={showInfo ? 'Hide info' : 'Show info'}
                >
                  {showInfo ? (
                    <Info className={styles.icon} />
                  ) : (
                    <EyeOff className={styles.icon} />
                  )}
                </button>
              </div>

              {page.isChained && (
                <button
                  onClick={page.resetToOriginal}
                  className={styles.textAction}
                >
                  <RotateCcw className={styles.smallIcon} />
                  Reset
                </button>
              )}
              {page.hasParent && (
                <button
                  onClick={() => void page.detachFromParent()}
                  className={styles.textAction}
                >
                  <Unlink className={styles.smallIcon} />
                  Detach
                </button>
              )}
              {!panelOpen && (
                <button
                  onClick={() => setPanelOpen(true)}
                  className={styles.openPanel}
                  title="Open edit panel"
                >
                  <Plus className={styles.icon} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Image gallery — same component as main view, scoped to edit chain */}
        <ImageGallery
          images={sortedChainImages}
          imageUrls={page.chainImageUrls}
          rootImageMeta={page.rootImageMeta}
          editChildrenMap={{}}
          loadingGallery={false}
          thumbSize={thumbSize}
          showInfo={showInfo}
          onDelete={handleDelete}
          onRetry={page.retryImage}
          onRestoreRoot={() => {}}
          onDownload={handleDownload}
          onUnlink={handleUnlink}
          onDescribe={(img) => setDescribeTarget(img)}
          onGallery={handleGallery}
          onOpen={handleOpen}
          onChildOpen={handleChildOpen}
          selectionActive={selectionActive}
          isSelected={selection.isSelected}
          onSelect={(id, shiftKey) => selection.toggle(id, shiftKey)}
          activeId={page.activeSourceId}
          parentId={imageId}
        />
      </div>

      {/* Edit panel — full-screen dialog on mobile, right sidebar on desktop */}
      {isMobile ? (
        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogContent size="fullscreen" showCloseButton={false}>
            <MobileDialogHeader
              title="Edit"
              onClose={() => setPanelOpen(false)}
            />
            <div className={styles.mobilePanelBody}>
              <GeneratorPanel
                generator={page.generator}
                modelSelector={page.modelSelector}
                userImages={page.existingImages}
                describe={page.describe}
                mode={selectionActive ? 'generate' : 'edit'}
                refImagesReadOnly={selectionActive}
                libraryFilterIds={
                  new Set(sortedChainImages.map((img) => img.id))
                }
              />

              {/* Variations button */}
              <Button
                variant="secondary"
                onClick={page.handleOpenVariationDialog}
                loading={page.variationPromptsLoading}
                className={styles.variations}
              >
                {page.variationPromptsLoading
                  ? 'Generating...'
                  : 'Generate Variations'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div
          className={cx(
            styles.panel,
            isADOpen && styles.panelBesideAD,
            !panelPinned && styles.panelFloating,
          )}
        >
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Edit</span>
            <div className={styles.panelHeaderActions}>
              <button
                onClick={() => setPanelPinned((p) => !p)}
                className={styles.panelButton}
                title={panelPinned ? 'Unpin (overlay)' : 'Pin (inline)'}
              >
                {panelPinned ? (
                  <Pin className={styles.smallIcon} />
                ) : (
                  <PinOff className={styles.smallIcon} />
                )}
              </button>
            </div>
          </div>
          <div className={styles.panelBody}>
            <GeneratorPanel
              generator={page.generator}
              modelSelector={page.modelSelector}
              userImages={page.existingImages}
              describe={page.describe}
              mode={selectionActive ? 'generate' : 'edit'}
              refImagesReadOnly={selectionActive}
              libraryFilterIds={new Set(sortedChainImages.map((img) => img.id))}
            />

            {/* Variations button */}
            <Button
              variant="secondary"
              onClick={page.handleOpenVariationDialog}
              loading={page.variationPromptsLoading}
              className={styles.variations}
            >
              {page.variationPromptsLoading
                ? 'Generating...'
                : 'Generate Variations'}
            </Button>
          </div>
        </div>
      )}

      {/* Batch selection drawer — unlink, delete, download */}
      <SelectionDrawer
        count={selection.count}
        onClear={selection.clearSelection}
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleUnlinkSelected()}
        >
          <Unlink className={styles.actionIcon} />
          Unlink
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleDownloadSelected()}
        >
          <Download className={styles.actionIcon} />
          Download
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleDeleteSelected()}
        >
          <Trash2 className={styles.actionIcon} />
          Delete
        </Button>
      </SelectionDrawer>

      {/* Variation prompts dialog */}
      <VariationPromptsDialog
        open={page.variationDialogOpen}
        onOpenChange={page.setVariationDialogOpen}
        prompts={page.variationPrompts}
        loading={page.variationPromptsLoading}
        onGenerate={(guidance, count) =>
          void page.handleGenerateVariations(guidance, count)
        }
        onApply={(prompts) => {
          page.generator.pastePrompts(prompts)
          page.setVariationDialogOpen(false)
        }}
        sourceImageUrl={page.sourceImageMeta.url}
        referenceImages={page.generator.refImages}
        onAddReference={() => setRefPickerOpen(true)}
        onRemoveReference={(id) => page.generator.removeRefImage(id)}
      />

      {/* Ref image picker */}
      <ExistingImagePicker
        open={refPickerOpen}
        onOpenChange={setRefPickerOpen}
        images={page.existingImages.images}
        imageUrls={page.existingImages.imageUrls}
        isLoading={page.existingImages.isLoading}
        alreadyCollectedIds={new Set(page.generator.refImages.map((r) => r.id))}
        onConfirm={(selected) =>
          page.generator.addRefImages(
            selected.map((s) => ({
              id: s.id,
              url: s.url,
              title: s.title,
            })),
          )
        }
        max={page.generator.maxRefImages - page.generator.refImages.length}
      />

      {/* Describe dialog */}
      {describeTarget && (
        <DescribeDialog
          open={!!describeTarget}
          onOpenChange={(open) => {
            if (!open) setDescribeTarget(null)
          }}
          imageUrl={page.chainImageUrls[describeTarget.id]}
          imageId={describeTarget.id}
          currentDescription={describeTarget.description}
        />
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          imageUrls={lightboxImageUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((i) =>
              i === null ? 0 : (i + 1) % lightboxImages.length,
            )
          }
          onPrev={() =>
            setLightboxIndex((i) =>
              i === null
                ? 0
                : (i - 1 + lightboxImages.length) % lightboxImages.length,
            )
          }
          onDelete={() => {
            const img = lightboxImages[lightboxIndex]
            void page.results.deleteResult(img.id)
            if (lightboxImages.length <= 1) {
              setLightboxIndex(null)
            } else if (lightboxIndex >= lightboxImages.length - 1) {
              setLightboxIndex(lightboxIndex - 1)
            }
          }}
        />
      )}
    </div>
  )
}
